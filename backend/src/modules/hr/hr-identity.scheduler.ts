import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClsService } from 'nestjs-cls';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HrService } from './hr.service';

@Injectable()
export class HrIdentityScheduler {
  private readonly logger = new Logger(HrIdentityScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly notifications: NotificationsService,
    private readonly cls: ClsService,
    private readonly hr: HrService,
  ) {}

  /** Residency / national ID expiry: alert employee + HR at 15/7/4/1 days before. */
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async notifyIdentityExpiry() {
    await this.withBypass(async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      // Notify once per window when the document is exactly N days from expiry.
      const windows = [15, 7, 4, 1];

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
            identityType: true,
            identityExpiresOn: true,
            identityNumber: true,
          },
        });

        for (const employee of employees) {
          const docLabel =
            employee.identityType === 'CITIZEN'
              ? 'National ID'
              : employee.identityType === 'RESIDENT'
                ? 'Residency (Iqama)'
                : 'Residency / ID';
          const title = `${docLabel} expires in ${days} days`;
          const body = `${employee.fullName}'s ${docLabel.toLowerCase()} expires on ${dayKey}.`;
          const actionUrl = `/c/${employee.companyId}/hr/employees/${employee.id}`;
          const data = {
            employeeId: employee.id,
            daysUntilExpiry: days,
            identityExpiresOn: dayKey,
            identityType: employee.identityType,
          };

          const recipientIds = new Set<string>();
          // Employee themselves (when linked to a login user)
          if (employee.userId) recipientIds.add(employee.userId);

          // HR / anyone with hr.write (owners, admins, ops/HR roles)
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
              // Skip if we already notified this user for this employee + window today
              const existing = await this.prisma.notification.findMany({
                where: {
                  companyId: employee.companyId,
                  userId,
                  type: 'hr.identity.expiry',
                  createdAt: { gte: today },
                },
                select: { id: true, data: true },
              });
              const already = existing.some((n) => {
                const d = n.data as {
                  employeeId?: string;
                  daysUntilExpiry?: number;
                } | null;
                return (
                  d?.employeeId === employee.id && d?.daysUntilExpiry === days
                );
              });
              if (already) continue;

              await this.notifications.createAndPush({
                companyId: employee.companyId,
                userId,
                type: 'hr.identity.expiry',
                title,
                body,
                actionUrl,
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

  /** After workday: mark ACTIVE employees with no punch as ABSENT (Fri/Sat skipped). */
  @Cron(CronExpression.EVERY_DAY_AT_11PM)
  async markAbsentWithoutPunch() {
    await this.withBypass(async () => {
      const now = new Date();
      const dow = now.getUTCDay();
      // Skip writing absence for Friday/Saturday (Saudi weekend default)
      if (dow === 5 || dow === 6) {
        this.logger.debug('Skip auto-absent on weekend');
        return;
      }
      const dayKey = now.toISOString().slice(0, 10);
      const day = new Date(`${dayKey}T00:00:00.000Z`);
      const companies = await this.prisma.company.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
      for (const company of companies) {
        const employees = await this.prisma.employee.findMany({
          where: { companyId: company.id, employmentStatus: 'ACTIVE' },
          select: { id: true },
        });
        if (!employees.length) continue;
        try {
          await this.hr.markMissingDaysAbsent(
            company.id,
            employees.map((e) => e.id),
            day,
            day,
          );
        } catch (error) {
          this.logger.warn(
            `auto-absent company ${company.id}: ${
              error instanceof Error ? error.message : error
            }`,
          );
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
