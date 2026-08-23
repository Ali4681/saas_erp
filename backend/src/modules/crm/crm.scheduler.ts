import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClsService } from 'nestjs-cls';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { CrmService } from './crm.service';
import { CrmOpsService } from './crm-ops.service';

@Injectable()
export class CrmScheduler {
  private readonly logger = new Logger(CrmScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cls: ClsService,
    private readonly crm: CrmService,
    private readonly ops: CrmOpsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async autoRenewAndAlert() {
    await this.cls.run(async () => {
      this.tenant.setBypass(true);
      try {
      const today = new Date();
      const due = await this.prisma.crmContract.findMany({
        where: {
          autoRenew: true,
          status: 'ACTIVE',
          endsOn: { lte: today },
        },
        include: { contact: true },
      });
      for (const contract of due) {
        try {
          this.tenant.setCompanyId(contract.companyId);
          await this.crm.renewContract(contract.companyId, contract.id);
          await this.ops.notifyContact(
            contract.companyId,
            contract.contact.phone,
            contract.contact.email,
            contract.contact.ownerUserId,
            `تم تجديد العقد ${contract.contractNumber} تلقائياً.`,
            'تجديد عقد',
          );
        } catch (error) {
          this.logger.warn(
            `auto-renew ${contract.id}: ${
              error instanceof Error ? error.message : 'unknown'
            }`,
          );
        }
      }

      const soon = new Date();
      soon.setDate(soon.getDate() + 14);
      const expiring = await this.prisma.crmContract.findMany({
        where: {
          status: 'ACTIVE',
          autoRenew: false,
          endsOn: { gte: today, lte: soon },
        },
        include: { contact: true },
      });
      for (const contract of expiring) {
        await this.ops.notifyContact(
          contract.companyId,
          contract.contact.phone,
          contract.contact.email,
          contract.contact.ownerUserId,
          `العقد ${contract.contractNumber} ينتهي قريباً.`,
          'تنبيه انتهاء عقد',
        );
      }
      } finally {
        this.tenant.setBypass(false);
      }
    });
  }
}
