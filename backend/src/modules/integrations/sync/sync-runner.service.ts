import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  CredentialPayload,
  EffectiveCapabilityService,
} from '../effective-capability.service';
import { MirrorUpsertService } from '../mirrors/mirror-upsert.service';
import { AdapterRegistry } from './adapters/adapter.registry';
import type {
  AdapterOperationResult,
  AdapterSyncItem,
  AdapterSyncResult,
  AdapterWebhookResult,
} from './adapters/adapter.types';
import { asRecord } from './adapters/credential-resolve';
import { IntegrationErrorsService } from './integration-errors.service';
import { mapOrderStatus } from '../mirrors/status-mapper';
import type {
  OperationJobPayload,
  SyncJobPayload,
  WebhookJobPayload,
} from './queue.constants';

@Injectable()
export class SyncRunnerService {
  private readonly logger = new Logger(SyncRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly adapters: AdapterRegistry,
    private readonly errors: IntegrationErrorsService,
    private readonly effectiveCapabilities: EffectiveCapabilityService,
    private readonly mirrors: MirrorUpsertService,
  ) {}

  async runSync(payload: SyncJobPayload) {
    this.tenant.setBypass(true);
    try {
      const job = await this.prisma.integrationJob.findUnique({
        where: { id: payload.integrationJobId },
      });
      if (!job) {
        this.logger.warn(`Sync job missing ${payload.integrationJobId}`);
        return;
      }
      if (job.status === 'CANCELLED' || job.status === 'SUCCEEDED') {
        return;
      }

      const project = await this.prisma.connectedProject.findUnique({
        where: { id: payload.connectedProjectId },
        include: {
          provider: true,
          credentials: true,
        },
      });
      if (!project || !project.credentials) {
        await this.failJob(job.id, 'Project or credentials missing', true);
        return;
      }

      await this.prisma.integrationJob.update({
        where: { id: job.id },
        data: {
          status: 'RUNNING',
          startedAt: job.startedAt ?? new Date(),
          attemptCount: { increment: 1 },
        },
      });

      await this.prisma.projectSyncState.upsert({
        where: {
          connectedProjectId_entityType_direction: {
            connectedProjectId: project.id,
            entityType: payload.entityType,
            direction: 'IMPORT',
          },
        },
        create: {
          connectedProjectId: project.id,
          entityType: payload.entityType,
          direction: 'IMPORT',
          lastStatus: 'RUNNING',
        },
        update: { lastStatus: 'RUNNING' },
      });

      const credentials = this.decryptCredentials(
        project.credentials.credentialsCiphertext,
      );
      const adapter = this.adapters.get(project.provider.code);
      const syncState = await this.prisma.projectSyncState.findUnique({
        where: {
          connectedProjectId_entityType_direction: {
            connectedProjectId: project.id,
            entityType: payload.entityType,
            direction: 'IMPORT',
          },
        },
      });

      let cursor =
        payload.jobType === 'FULL_SYNC' ? null : (syncState?.cursor ?? null);
      let upserted = 0;
      let pages = 0;
      let hasMore = true;
      let nextCursor: string | null = cursor;

      while (hasMore && pages < 20) {
        const result = await adapter.syncEntity({
          connectedProjectId: project.id,
          providerCode: project.provider.code,
          credentials,
          environment: project.environment,
          entityType: payload.entityType,
          cursor,
          fullSync: payload.jobType === 'FULL_SYNC',
        });

        if (payload.entityType === 'location') {
          upserted += await this.upsertLocations(project.id, result.items);
        } else {
          upserted += await this.applyMirrorResult(project.id, result);
        }

        nextCursor = result.nextCursor;
        hasMore = result.hasMore;
        cursor = result.nextCursor;
        pages += 1;
      }

      const finishedAt = new Date();
      await this.prisma.projectSyncState.update({
        where: {
          connectedProjectId_entityType_direction: {
            connectedProjectId: project.id,
            entityType: payload.entityType,
            direction: 'IMPORT',
          },
        },
        data: {
          cursor: nextCursor,
          lastSyncedAt: finishedAt,
          lastStatus: 'SUCCESS',
          consecutiveFailures: 0,
          lastErrorAt: null,
        },
      });

      await this.prisma.integrationJob.update({
        where: { id: job.id },
        data: {
          status: 'SUCCEEDED',
          finishedAt,
          activeSyncKey: null,
          metrics: {
            upserted,
            pages,
            entityType: payload.entityType,
          } as Prisma.InputJsonValue,
        },
      });

      await this.prisma.connectedProject.update({
        where: { id: project.id },
        data: { lastSuccessfulSyncAt: finishedAt },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.failJob(payload.integrationJobId, message, true);
      await this.errors.record({
        connectedProjectId: payload.connectedProjectId,
        integrationJobId: payload.integrationJobId,
        errorCode: 'SYNC_FAILED',
        message,
        isRetryable: true,
      });
      throw error;
    } finally {
      this.tenant.setBypass(false);
    }
  }

  async processWebhook(payload: WebhookJobPayload) {
    this.tenant.setBypass(true);
    try {
      const event = await this.prisma.webhookEvent.findUnique({
        where: { id: payload.webhookEventId },
      });
      if (!event) {
        return;
      }
      if (event.status === 'PROCESSED' || event.status === 'IGNORED') {
        return;
      }

      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: 'PROCESSING' },
      });

      const project = await this.prisma.connectedProject.findUnique({
        where: { id: event.connectedProjectId },
        include: { provider: true, credentials: true },
      });
      if (!project?.credentials) {
        await this.prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            status: 'FAILED',
            errorMessage: 'Project credentials missing',
            processedAt: new Date(),
          },
        });
        return;
      }

      if (event.signatureValid === false) {
        await this.prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            status: 'FAILED',
            errorMessage: 'Invalid webhook signature',
            processedAt: new Date(),
          },
        });
        return;
      }

      const credentials = this.decryptCredentials(
        project.credentials.credentialsCiphertext,
      );
      const adapter = this.adapters.get(project.provider.code);
      const result = await adapter.processWebhook({
        connectedProjectId: project.id,
        providerCode: project.provider.code,
        credentials,
        environment: project.environment,
        eventType: event.eventType,
        payload: event.payload as Record<string, unknown>,
        providerEventId: event.providerEventId,
      });

      if (result.ignored) {
        await this.prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            status: 'IGNORED',
            errorMessage: result.reason ?? null,
            processedAt: new Date(),
          },
        });
        return;
      }

      if (result.entityType === 'location' && result.items?.length) {
        await this.upsertLocations(project.id, result.items);
      } else {
        await this.applyMirrorResult(project.id, result, 'WEBHOOK');
      }

      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.webhookEvent.update({
        where: { id: payload.webhookEventId },
        data: {
          status: 'FAILED',
          errorMessage: message,
          processedAt: new Date(),
        },
      });
      await this.errors.record({
        connectedProjectId: payload.connectedProjectId,
        errorCode: 'WEBHOOK_PROCESS_FAILED',
        message,
        isRetryable: true,
        payloadExcerpt: payload.webhookEventId,
      });
      throw error;
    } finally {
      this.tenant.setBypass(false);
    }
  }

  async executeOperation(
    payload: OperationJobPayload,
  ): Promise<AdapterOperationResult | null> {
    this.tenant.setBypass(true);
    try {
      const operation = await this.prisma.providerOperationRequest.findUnique({
        where: { id: payload.operationRequestId },
        include: { capability: true },
      });
      if (!operation) {
        return null;
      }
      if (
        operation.status === 'SUCCEEDED' ||
        operation.status === 'CANCELLED'
      ) {
        return null;
      }

      await this.prisma.providerOperationRequest.update({
        where: { id: operation.id },
        data: { status: 'PROCESSING' },
      });

      const effective = await this.effectiveCapabilities.listForProject(
        operation.connectedProjectId,
      );
      const match = effective.find(
        (item) => item.capabilityId === operation.capabilityId,
      );
      if (!match?.effective) {
        await this.prisma.providerOperationRequest.update({
          where: { id: operation.id },
          data: {
            status: 'FAILED',
            failureMessage: `Capability not effective (${match?.reason ?? 'missing'})`,
            processedAt: new Date(),
          },
        });
        return null;
      }

      const project = await this.prisma.connectedProject.findUnique({
        where: { id: operation.connectedProjectId },
        include: { provider: true, credentials: true },
      });
      if (!project?.credentials) {
        await this.prisma.providerOperationRequest.update({
          where: { id: operation.id },
          data: {
            status: 'FAILED',
            failureMessage: 'Project credentials missing',
            processedAt: new Date(),
          },
        });
        return null;
      }

      const credentials = this.decryptCredentials(
        project.credentials.credentialsCiphertext,
      );
      const adapter = this.adapters.get(project.provider.code);
      const result = await adapter.executeOperation({
        connectedProjectId: project.id,
        providerCode: project.provider.code,
        credentials,
        environment: project.environment,
        capabilityCode: operation.capability.code,
        operationType: operation.operationType,
        externalTargetId: operation.externalTargetId,
        payload: operation.payload as Record<string, unknown>,
        idempotencyKey: operation.idempotencyKey,
      });

      await this.prisma.providerOperationRequest.update({
        where: { id: operation.id },
        data: {
          status: 'SUCCEEDED',
          responseExternalId: result.responseExternalId ?? null,
          processedAt: new Date(),
          failureMessage: null,
        },
      });

      const mirroredStatus = String(
        asRecord(result.rawResponse).mirroredStatus ??
          asRecord(result.rawResponse).status ??
          '',
      ).trim();
      if (operation.externalTargetId && mirroredStatus) {
        await this.prisma.externalOrder.updateMany({
          where: {
            connectedProjectId: project.id,
            externalId: operation.externalTargetId,
          },
          data: {
            status: mapOrderStatus(mirroredStatus),
            lastSyncedAt: new Date(),
          },
        });
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.providerOperationRequest.update({
        where: { id: payload.operationRequestId },
        data: {
          status: 'FAILED',
          failureMessage: message,
          processedAt: new Date(),
        },
      });
      await this.errors.record({
        connectedProjectId: payload.connectedProjectId,
        operationRequestId: payload.operationRequestId,
        errorCode: 'OPERATION_FAILED',
        message,
        isRetryable: true,
      });
      throw error;
    } finally {
      this.tenant.setBypass(false);
    }
  }

  private async applyMirrorResult(
    connectedProjectId: string,
    result: AdapterSyncResult | AdapterWebhookResult,
    source: 'POLL' | 'WEBHOOK' = 'POLL',
  ): Promise<number> {
    let upserted = 0;
    if (result.categories?.length) {
      upserted += await this.mirrors.upsertCategories(
        connectedProjectId,
        result.categories,
      );
    }
    if (result.products?.length) {
      upserted += await this.mirrors.upsertProducts(
        connectedProjectId,
        result.products,
      );
    }
    if (result.customers?.length) {
      upserted += await this.mirrors.upsertCustomers(
        connectedProjectId,
        result.customers,
      );
    }
    if (result.orders?.length) {
      upserted += await this.mirrors.upsertOrders(
        connectedProjectId,
        result.orders,
        source,
      );
    }
    if (result.promotions?.length) {
      upserted += await this.mirrors.upsertPromotions(
        connectedProjectId,
        result.promotions,
      );
    }
    if (result.settlements?.length) {
      upserted += await this.mirrors.upsertSettlements(
        connectedProjectId,
        result.settlements,
      );
    }
    if (result.installments?.length) {
      upserted += await this.mirrors.upsertInstallments(
        connectedProjectId,
        result.installments,
      );
    }
    return upserted;
  }

  private decryptCredentials(
    ciphertext: Uint8Array | Buffer,
  ): CredentialPayload {
    return this.effectiveCapabilities.decryptCredentials(
      Buffer.from(ciphertext),
    );
  }

  private async upsertLocations(
    connectedProjectId: string,
    items: AdapterSyncItem[],
  ): Promise<number> {
    let count = 0;
    for (const item of items) {
      await this.prisma.projectLocation.upsert({
        where: {
          connectedProjectId_externalId: {
            connectedProjectId,
            externalId: item.externalId,
          },
        },
        create: {
          connectedProjectId,
          externalId: item.externalId,
          name: item.name ?? item.externalId,
          code: item.code ?? null,
          status: item.status ?? 'ACTIVE',
          city: item.city ?? null,
          addressLine: item.addressLine ?? null,
          timezone: item.timezone ?? null,
          rawPayload: item.rawPayload as Prisma.InputJsonValue,
          lastSyncedAt: new Date(),
        },
        update: {
          name: item.name ?? item.externalId,
          code: item.code ?? null,
          status: item.status ?? 'ACTIVE',
          city: item.city ?? null,
          addressLine: item.addressLine ?? null,
          timezone: item.timezone ?? null,
          rawPayload: item.rawPayload as Prisma.InputJsonValue,
          lastSyncedAt: new Date(),
        },
      });
      count += 1;
    }
    return count;
  }

  private async failJob(
    jobId: string,
    message: string,
    clearActiveKey: boolean,
  ) {
    const job = await this.prisma.integrationJob.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      return;
    }

    if (job.entityType) {
      await this.prisma.projectSyncState.upsert({
        where: {
          connectedProjectId_entityType_direction: {
            connectedProjectId: job.connectedProjectId,
            entityType: job.entityType,
            direction: 'IMPORT',
          },
        },
        create: {
          connectedProjectId: job.connectedProjectId,
          entityType: job.entityType,
          direction: 'IMPORT',
          lastStatus: 'FAILED',
          consecutiveFailures: 1,
          lastErrorAt: new Date(),
        },
        update: {
          lastStatus: 'FAILED',
          consecutiveFailures: { increment: 1 },
          lastErrorAt: new Date(),
        },
      });
    }

    await this.prisma.integrationJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        activeSyncKey: clearActiveKey ? null : undefined,
        metrics: {
          ...(typeof job.metrics === 'object' && job.metrics
            ? (job.metrics as object)
            : {}),
          lastError: message,
        } as Prisma.InputJsonValue,
      },
    });
  }
}
