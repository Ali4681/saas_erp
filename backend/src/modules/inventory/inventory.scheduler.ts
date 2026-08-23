import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClsService } from 'nestjs-cls';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { InventoryOpsService } from './inventory-ops.service';

@Injectable()
export class InventoryScheduler {
  private readonly logger = new Logger(InventoryScheduler.name);

  constructor(
    private readonly cls: ClsService,
    private readonly tenant: TenantContextService,
    private readonly ops: InventoryOpsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async releaseExpiredReservations() {
    await this.cls.run(async () => {
      this.tenant.setBypass(true);
      try {
        const result = await this.ops.expireReservations();
        if (result.released > 0) {
          this.logger.log(`Released ${result.released} expired reservations`);
        }
      } finally {
        this.tenant.setBypass(false);
      }
    });
  }
}
