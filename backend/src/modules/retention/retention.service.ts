import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

export type RetentionPurgeResult = {
  ranAt: string;
  dryRun: boolean;
  deleted: Record<string, number>;
  cutoffs: Record<string, string>;
};

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly config: ConfigService,
    private readonly cls: ClsService,
  ) {}

  private days(envKey: string, fallback: number): number {
    const raw = this.config.get<string>(envKey);
    const parsed = raw != null ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private cutoff(days: number): Date {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    return d;
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledPurge(): Promise<void> {
    if (this.config.get<string>('RETENTION_CRON_ENABLED', 'true') === 'false') {
      return;
    }
    const result = await this.purgeExpired({ dryRun: false });
    this.logger.log(
      `Retention purge complete: ${JSON.stringify(result.deleted)}`,
    );
  }

  async purgeExpired(opts?: {
    dryRun?: boolean;
  }): Promise<RetentionPurgeResult> {
    if (!this.cls.isActive()) {
      return this.cls.run(() => this.purgeExpired(opts));
    }

    const dryRun = opts?.dryRun === true;
    const ttls = {
      auditLogs: this.days('RETENTION_AUDIT_DAYS', 365),
      apiRequestLogs: this.days('RETENTION_API_REQUEST_LOG_DAYS', 90),
      webhookDeliveries: this.days('RETENTION_WEBHOOK_DELIVERY_DAYS', 90),
      webhookEvents: this.days('RETENTION_WEBHOOK_EVENT_DAYS', 90),
      messageDeliveries: this.days('RETENTION_MESSAGE_DELIVERY_DAYS', 180),
      aiUsageLogs: this.days('RETENTION_AI_USAGE_DAYS', 365),
      integrationErrors: this.days('RETENTION_INTEGRATION_ERROR_DAYS', 180),
      automationRuns: this.days('RETENTION_AUTOMATION_RUN_DAYS', 180),
    };

    const cutoffs = {
      auditLogs: this.cutoff(ttls.auditLogs),
      apiRequestLogs: this.cutoff(ttls.apiRequestLogs),
      webhookDeliveries: this.cutoff(ttls.webhookDeliveries),
      webhookEvents: this.cutoff(ttls.webhookEvents),
      messageDeliveries: this.cutoff(ttls.messageDeliveries),
      aiUsageLogs: this.cutoff(ttls.aiUsageLogs),
      integrationErrors: this.cutoff(ttls.integrationErrors),
      automationRuns: this.cutoff(ttls.automationRuns),
    };

    this.tenant.setBypass(true);
    this.tenant.setAppendOnlyPurge(true);

    const deleted: Record<string, number> = {};

    try {
      deleted.auditLogs = await this.purgeModel(
        'auditLogs',
        dryRun,
        () =>
          this.prisma.auditLog.count({
            where: { createdAt: { lt: cutoffs.auditLogs } },
          }),
        () =>
          this.prisma.auditLog.deleteMany({
            where: { createdAt: { lt: cutoffs.auditLogs } },
          }),
      );

      deleted.apiRequestLogs = await this.purgeModel(
        'apiRequestLogs',
        dryRun,
        () =>
          this.prisma.apiRequestLog.count({
            where: { createdAt: { lt: cutoffs.apiRequestLogs } },
          }),
        () =>
          this.prisma.apiRequestLog.deleteMany({
            where: { createdAt: { lt: cutoffs.apiRequestLogs } },
          }),
      );

      deleted.webhookDeliveries = await this.purgeModel(
        'webhookDeliveries',
        dryRun,
        () =>
          this.prisma.webhookDelivery.count({
            where: { createdAt: { lt: cutoffs.webhookDeliveries } },
          }),
        () =>
          this.prisma.webhookDelivery.deleteMany({
            where: { createdAt: { lt: cutoffs.webhookDeliveries } },
          }),
      );

      deleted.webhookEvents = await this.purgeModel(
        'webhookEvents',
        dryRun,
        () =>
          this.prisma.webhookEvent.count({
            where: { receivedAt: { lt: cutoffs.webhookEvents } },
          }),
        () =>
          this.prisma.webhookEvent.deleteMany({
            where: { receivedAt: { lt: cutoffs.webhookEvents } },
          }),
      );

      deleted.messageDeliveries = await this.purgeModel(
        'messageDeliveries',
        dryRun,
        () =>
          this.prisma.messageDelivery.count({
            where: { createdAt: { lt: cutoffs.messageDeliveries } },
          }),
        () =>
          this.prisma.messageDelivery.deleteMany({
            where: { createdAt: { lt: cutoffs.messageDeliveries } },
          }),
      );

      deleted.aiUsageLogs = await this.purgeModel(
        'aiUsageLogs',
        dryRun,
        () =>
          this.prisma.aiUsageLog.count({
            where: { createdAt: { lt: cutoffs.aiUsageLogs } },
          }),
        () =>
          this.prisma.aiUsageLog.deleteMany({
            where: { createdAt: { lt: cutoffs.aiUsageLogs } },
          }),
      );

      deleted.integrationErrors = await this.purgeModel(
        'integrationErrors',
        dryRun,
        () =>
          this.prisma.integrationError.count({
            where: { lastSeenAt: { lt: cutoffs.integrationErrors } },
          }),
        () =>
          this.prisma.integrationError.deleteMany({
            where: { lastSeenAt: { lt: cutoffs.integrationErrors } },
          }),
      );

      deleted.automationRuns = await this.purgeModel(
        'automationRuns',
        dryRun,
        () =>
          this.prisma.automationRun.count({
            where: { startedAt: { lt: cutoffs.automationRuns } },
          }),
        () =>
          this.prisma.automationRun.deleteMany({
            where: { startedAt: { lt: cutoffs.automationRuns } },
          }),
      );
    } finally {
      this.tenant.setAppendOnlyPurge(false);
      this.tenant.setBypass(false);
    }

    return {
      ranAt: new Date().toISOString(),
      dryRun,
      deleted,
      cutoffs: Object.fromEntries(
        Object.entries(cutoffs).map(([k, v]) => [k, v.toISOString()]),
      ),
    };
  }

  private async purgeModel(
    _name: string,
    dryRun: boolean,
    countFn: () => Promise<number>,
    deleteFn: () => Promise<{ count: number }>,
  ): Promise<number> {
    if (dryRun) {
      return countFn();
    }
    const result = await deleteFn();
    return result.count;
  }
}
