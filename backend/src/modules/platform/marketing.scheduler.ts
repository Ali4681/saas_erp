import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClsService } from 'nestjs-cls';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { PlatformService } from './platform.service';

/**
 * Picks up SCHEDULED posts whose scheduledAt <= now and attempts publish.
 */
@Injectable()
export class MarketingSchedulerService {
  private readonly logger = new Logger(MarketingSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly platform: PlatformService,
    private readonly cls: ClsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async flushDuePosts() {
    await this.cls.run(async () => {
      this.tenant.setBypass(true);
      try {
        const due = await this.prisma.marketingPost.findMany({
          where: {
            status: 'SCHEDULED',
            scheduledAt: { lte: new Date() },
          },
          take: 50,
          orderBy: { scheduledAt: 'asc' },
        });
        for (const post of due) {
          try {
            await this.platform.publishPost(post.companyId, post.id);
          } catch (error) {
            this.logger.warn(
              `Scheduled publish failed for ${post.id}: ${
                error instanceof Error ? error.message : error
              }`,
            );
          }
        }
      } finally {
        this.tenant.setBypass(false);
      }
    });
  }
}
