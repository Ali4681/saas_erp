import { Injectable } from '@nestjs/common';
import {
  i18nForbidden,
  i18nNotFound,
} from '../../common/i18n/localized-exception';
import { PrismaService } from '../../database/prisma.service';

export const FEATURE_CODES = {
  USER_LIMIT: 'USER_LIMIT',
  PROJECT_LIMIT: 'PROJECT_LIMIT',
  /** Highest plan (ENTERPRISE) — AI module 16.x */
  AI_ASSISTANT: 'AI_ASSISTANT',
} as const;

@Injectable()
export class PlanLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveSubscription(companyId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        companyId,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      include: {
        plan: { include: { features: true } },
      },
    });

    if (!subscription) {
      throw i18nNotFound('errors.plans.noSubscription');
    }

    return subscription;
  }

  async assertFeatureEnabled(
    companyId: string,
    featureCode: string,
  ): Promise<void> {
    const subscription = await this.getActiveSubscription(companyId);
    const feature = subscription.plan.features.find(
      (item) => item.featureCode === featureCode,
    );
    if (!feature || !feature.isEnabled) {
      throw i18nForbidden('errors.plans.featureRequiresPlan', {
        feature: featureCode,
      });
    }
  }

  async assertAiEnabled(companyId: string): Promise<void> {
    await this.assertFeatureEnabled(companyId, FEATURE_CODES.AI_ASSISTANT);
  }

  async assertWithinLimit(
    companyId: string,
    featureCode: string,
    currentCount: number,
  ): Promise<void> {
    const subscription = await this.getActiveSubscription(companyId);
    const feature = subscription.plan.features.find(
      (item) => item.featureCode === featureCode,
    );

    if (!feature || !feature.isEnabled) {
      throw i18nForbidden('errors.plans.featureDisabled', {
        feature: featureCode,
      });
    }

    if (feature.limitValue != null && currentCount >= feature.limitValue) {
      throw i18nForbidden('errors.plans.limitReached', {
        feature: featureCode,
        limit: feature.limitValue,
      });
    }
  }

  async assertCanAddUser(companyId: string): Promise<void> {
    const count = await this.prisma.companyUser.count({
      where: { companyId, status: { in: ['ACTIVE', 'INVITED'] } },
    });
    await this.assertWithinLimit(companyId, FEATURE_CODES.USER_LIMIT, count);
  }

  async assertCanAddProject(companyId: string): Promise<void> {
    const count = await this.prisma.connectedProject.count({
      where: {
        companyId,
        status: { notIn: ['REVOKED', 'DISABLED'] },
      },
    });
    await this.assertWithinLimit(companyId, FEATURE_CODES.PROJECT_LIMIT, count);
  }
}
