import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClsService } from 'nestjs-cls';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class HrIdentityScheduler {
  private readonly logger = new Logger(HrIdentityScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly notifications: NotificationsService,
    private readonly cls: ClsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async notifyIdentityExpiry() {
    await this.withBypass(async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const windows = [30, 14, 7];

      for (const days of windows) {
        const target = new Date(today);
        target.setUTCDate(target.getUTCDate() + days);
        const dayKey = target.toISOString().slice(0, 10);
        const dayStart = new Date(`${dayKey}T00:00:00.000Z`);
        const dayEnd = new Date(`${dayKey}T23:59:59.999Z`);

        const employees = await this.prisma.employee.findMany({
          where: {
            identityExpiresOn: { gte: dayStart, lte: dayEnd },
            employmentStatus: { not: 'TERMINATED' },
          },
          select: {
            id: true,
            companyId: true,
            fullName: true,
            userId: true,
            identityExpiresOn: true,
            identityNumber: true,
          },
        });

        for (const employee of employees) {
          const title = `Identity expires in ${days} days`;
          const body = `${employee.fullName}'s identity document expires on ${dayKey}.`;
          const data = {
            employeeId: employee.id,
            daysUntilExpiry: days,
            identityExpiresOn: dayKey,
          };

          const recipientIds = new Set<string>();
          if (employee.userId) recipientIds.add(employee.userId);

          const hrUsers = await this.prisma.companyUser.findMany({
            where: {
              companyId: employee.companyId,
              status: 'ACTIVE',
              role: {
                permissions: {
                  some: { permission: { code: 'hr.write' } },
                },
              },
            },
            select: { userId: true },
          });
          for (const row of hrUsers) recipientIds.add(row.userId);

          for (const userId of recipientIds) {
            try {
              await this.notifications.createAndPush({
                companyId: employee.companyId,
                userId,
                type: 'hr.identity.expiry',
                title,
                body,
                data,
              });
            } catch (error) {
              this.logger.warn(
                `identity expiry notify ${employee.id} → ${userId}: ${
                  error instanceof Error ? error.message : error
                }`,
              );
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
