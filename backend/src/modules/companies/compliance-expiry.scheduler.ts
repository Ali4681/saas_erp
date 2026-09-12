import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClsService } from 'nestjs-cls';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ComplianceExpiryScheduler {
  private readonly logger = new Logger(ComplianceExpiryScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly notifications: NotificationsService,
    private readonly cls: ClsService,
  ) {}

  /** Alert on compliance document expiry windows (default 60 and 30 days). */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async notifyComplianceExpiry() {
    await this.withBypass(async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const defaultWindows = [60, 30];

      const companies = await this.prisma.company.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        select: {
          id: true,
          displayName: true,
          settings: { select: { settings: true } },
        },
      });

      for (const company of companies) {
        const bag =
          company.settings?.settings &&
          typeof company.settings.settings === 'object' &&
          !Array.isArray(company.settings.settings)
            ? (company.settings.settings as Record<string, unknown>)
            : {};
        const windows = Array.isArray(bag.complianceAlertDays)
          ? bag.complianceAlertDays
              .map((n) => Number(n))
              .filter((n) => Number.isFinite(n) && n > 0)
          : defaultWindows;

        for (const days of windows) {
          const target = new Date(today);
          target.setUTCDate(target.getUTCDate() + days);
          const dayKey = target.toISOString().slice(0, 10);
          const dayStart = new Date(`${dayKey}T00:00:00.000Z`);
          const dayEnd = new Date(`${dayKey}T23:59:59.999Z`);

          const docs = await this.prisma.companyComplianceDocument.findMany({
            where: {
              companyId: company.id,
              expiresOn: { gte: dayStart, lte: dayEnd },
            },
          });

          if (!docs.length) continue;

          const recipients = await this.prisma.companyUser.findMany({
            where: {
              companyId: company.id,
              status: 'ACTIVE',
              role: {
                permissions: {
                  some: { permission: { code: 'companies.write' } },
                },
              },
            },
            select: { userId: true },
          });

          for (const doc of docs) {
            const title = `Document expires in ${days} days`;
            const body = `${doc.documentType} for ${company.displayName} expires on ${dayKey}.`;
            const actionUrl = `/c/${company.id}/onboarding?step=2`;
            const data = {
              documentId: doc.id,
              documentType: doc.documentType,
              daysUntilExpiry: days,
              expiresOn: dayKey,
            };

            for (const r of recipients) {
              try {
                const existing = await this.prisma.notification.findMany({
                  where: {
                    companyId: company.id,
                    userId: r.userId,
                    type: 'onboarding.compliance.expiry',
                    createdAt: { gte: today },
                  },
                  select: { data: true },
                });
                const already = existing.some((n) => {
                  const d = n.data as Record<string, unknown> | null;
                  return (
                    d?.documentId === doc.id && d?.daysUntilExpiry === days
                  );
                });
                if (already) continue;

                await this.notifications.createAndPush({
                  companyId: company.id,
                  userId: r.userId,
                  type: 'onboarding.compliance.expiry',
                  title,
                  body,
                  actionUrl,
                  data,
                  sendPush: true,
                });
              } catch (err) {
                this.logger.warn(
                  `Failed compliance notify ${company.id}/${r.userId}: ${String(err)}`,
                );
              }
            }
          }
        }
      }
    });
  }

  private async withBypass(fn: () => Promise<void>) {
    await this.cls.run(async () => {
      this.tenant.setBypass(true);
      try {
        await fn();
      } finally {
        this.tenant.setBypass(false);
      }
    });
  }
}
