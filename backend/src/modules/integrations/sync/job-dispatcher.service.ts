import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, type ConnectionOptions, type JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import { ClsService } from 'nestjs-cls';
import {
  JOB_EXECUTE_OPERATION,
  JOB_FULL_SYNC,
  JOB_INCREMENTAL_SYNC,
  JOB_PROCESS_WEBHOOK,
  QUEUE_OPERATIONS,
  QUEUE_SYNC,
  QUEUE_WEBHOOKS,
  type OperationJobPayload,
  type SyncJobPayload,
  type WebhookJobPayload,
} from './queue.constants';
import { SyncRunnerService } from './sync-runner.service';

type AnyPayload = SyncJobPayload | WebhookJobPayload | OperationJobPayload;

@Injectable()
export class JobDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobDispatcherService.name);
  private driver: 'bullmq' | 'inline' = 'inline';
  private connection: IORedis | null = null;
  private queues = new Map<string, Queue>();
  private workers: Worker[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly runner: SyncRunnerService,
    private readonly cls: ClsService,
  ) {}

  get mode(): 'bullmq' | 'inline' {
    return this.driver;
  }

  async onModuleInit() {
    const configured =
      this.config.get<string>('SYNC_ENGINE_DRIVER')?.toLowerCase() ?? 'auto';

    if (configured === 'inline') {
      this.driver = 'inline';
      this.logger.log('Sync engine driver: inline');
      return;
    }

    const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
    const forceBull = configured === 'bullmq';

    try {
      const probe = new IORedis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        connectTimeout: 1500,
        lazyConnect: true,
        retryStrategy: () => null,
      });
      probe.on('error', () => undefined);
      await probe.connect();
      await probe.ping();
      await probe.quit();

      this.connection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
      });
      this.connection.on('error', (error) => {
        this.logger.error(`Redis connection error: ${error.message}`);
      });
      this.driver = 'bullmq';
      await this.startBullWorkers();
      this.logger.log('Sync engine driver: bullmq');
    } catch (error) {
      if (forceBull) {
        throw error;
      }
      this.driver = 'inline';
      this.logger.warn(
        `Redis unavailable (${String(error)}); falling back to inline sync engine`,
      );
    }
  }

  async onModuleDestroy() {
    for (const worker of this.workers) {
      await worker.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    if (this.connection) {
      await this.connection.quit();
    }
  }

  async enqueueSync(payload: SyncJobPayload, opts?: JobsOptions) {
    const name =
      payload.jobType === 'FULL_SYNC' ? JOB_FULL_SYNC : JOB_INCREMENTAL_SYNC;
    return this.enqueue(QUEUE_SYNC, name, payload, {
      jobId: `sync:${payload.integrationJobId}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      ...opts,
    });
  }

  async enqueueWebhook(payload: WebhookJobPayload, opts?: JobsOptions) {
    return this.enqueue(QUEUE_WEBHOOKS, JOB_PROCESS_WEBHOOK, payload, {
      jobId: `webhook:${payload.webhookEventId}`,
      attempts: 8,
      backoff: { type: 'exponential', delay: 1000 },
      ...opts,
    });
  }

  async enqueueOperation(payload: OperationJobPayload, opts?: JobsOptions) {
    return this.enqueue(QUEUE_OPERATIONS, JOB_EXECUTE_OPERATION, payload, {
      jobId: `operation:${payload.operationRequestId}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      ...opts,
    });
  }

  private async enqueue(
    queueName: string,
    jobName: string,
    payload: AnyPayload,
    opts?: JobsOptions,
  ) {
    if (this.driver === 'inline') {
      // Await so callers (e.g. refresh panel) see upserted mirrors.
      await this.cls.run(async () => {
        await this.dispatchInline(queueName, jobName, payload);
      });
      return { driver: 'inline' as const, queued: true };
    }

    const queue = this.getQueue(queueName);
    await queue.add(jobName, payload, opts);
    return { driver: 'bullmq' as const, queued: true };
  }

  private async dispatchInline(
    queueName: string,
    jobName: string,
    payload: AnyPayload,
  ) {
    if (queueName === QUEUE_SYNC) {
      await this.runner.runSync(payload as SyncJobPayload);
      return;
    }
    if (queueName === QUEUE_WEBHOOKS) {
      await this.runner.processWebhook(payload as WebhookJobPayload);
      return;
    }
    if (queueName === QUEUE_OPERATIONS) {
      await this.runner.executeOperation(payload as OperationJobPayload);
      return;
    }
    this.logger.warn(`Unknown inline queue ${queueName}/${jobName}`);
  }

  private getQueue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, {
        connection: this.connection as ConnectionOptions,
      });
      this.queues.set(name, queue);
    }
    return queue;
  }

  private async startBullWorkers() {
    const connection = this.connection as ConnectionOptions;

    this.workers.push(
      new Worker(
        QUEUE_SYNC,
        async (job) => {
          await this.cls.run(async () => {
            await this.runner.runSync(job.data as SyncJobPayload);
          });
        },
        { connection },
      ),
      new Worker(
        QUEUE_WEBHOOKS,
        async (job) => {
          await this.cls.run(async () => {
            await this.runner.processWebhook(job.data as WebhookJobPayload);
          });
        },
        { connection },
      ),
      new Worker(
        QUEUE_OPERATIONS,
        async (job) => {
          await this.cls.run(async () => {
            await this.runner.executeOperation(
              job.data as OperationJobPayload,
            );
          });
        },
        { connection },
      ),
    );

    for (const worker of this.workers) {
      worker.on('failed', (job, error) => {
        this.logger.error(
          `BullMQ job failed ${job?.queueName}/${job?.name}: ${error.message}`,
        );
      });
    }
  }
}
