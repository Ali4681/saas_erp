import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  list(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.subscription.findMany({
      where: { companyId },
      include: { plan: { include: { features: true } } },
      orderBy: { startsAt: 'desc' },
    });
  }

  async current(companyId: string) {
    this.tenant.setCompanyId(companyId);
    // Prefer live subscriptions; fall back to latest suspended so admin UI can show it.
    const sub =
      (await this.prisma.subscription.findFirst({
        where: {
          companyId,
          status: { in: ['ACTIVE', 'TRIALING'] },
        },
        include: { plan: { include: { features: true } } },
        orderBy: { startsAt: 'desc' },
      })) ??
      (await this.prisma.subscription.findFirst({
        where: { companyId, status: 'SUSPENDED' },
        include: { plan: { include: { features: true } } },
        orderBy: { startsAt: 'desc' },
      }));
    if (!sub) throw new NotFoundException('No active subscription');
    return sub;
  }

  async changePlan(companyId: string, planCode: string) {
    this.tenant.setCompanyId(companyId);
    const plan = await this.prisma.plan.findFirst({
      where: { code: planCode, isActive: true },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    const current = await this.prisma.subscription.findFirst({
      where: { companyId, status: { in: ['ACTIVE', 'TRIALING'] } },
    });

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    if (plan.billingInterval === 'YEARLY') {
      endsAt.setFullYear(endsAt.getFullYear() + 1);
    } else if (plan.billingInterval === 'QUARTERLY') {
      endsAt.setMonth(endsAt.getMonth() + 3);
    } else {
      endsAt.setMonth(endsAt.getMonth() + 1);
    }

    return this.prisma.$transaction(async (tx) => {
      if (current) {
        await tx.subscription.update({
          where: { id: current.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: startsAt,
            activeCompanyId: null,
          },
        });
      }
      const subscription = await tx.subscription.create({
        data: {
          companyId,
          planId: plan.id,
          status: 'ACTIVE',
          startsAt,
          endsAt,
          activeCompanyId: companyId,
        },
        include: { plan: { include: { features: true } } },
      });
      await tx.company.update({
        where: { id: companyId },
        data: { status: 'ACTIVE' },
      });
      return subscription;
    });
  }

  async cancel(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const current = await this.prisma.subscription.findFirst({
      where: { companyId, status: { in: ['ACTIVE', 'TRIALING'] } },
    });
    if (!current) throw new NotFoundException('No active subscription');
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.update({
        where: { id: current.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          autoRenew: false,
          activeCompanyId: null,
        },
        include: { plan: true },
      });
      await tx.company.update({
        where: { id: companyId },
        data: { status: 'SUSPENDED' },
      });
      return subscription;
    });
  }

  async suspend(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const current = await this.prisma.subscription.findFirst({
      where: { companyId, status: { in: ['ACTIVE', 'TRIALING', 'SUSPENDED'] } },
    });
    if (!current) throw new NotFoundException('No active subscription');
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.update({
        where: { id: current.id },
        data: {
          status: 'SUSPENDED',
          activeCompanyId: null,
        },
        include: { plan: true },
      });
      await tx.company.update({
        where: { id: companyId },
        data: { status: 'SUSPENDED' },
      });
      return subscription;
    });
  }

  async renew(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const current = await this.prisma.subscription.findFirst({
      where: {
        companyId,
        status: { in: ['ACTIVE', 'TRIALING', 'SUSPENDED', 'EXPIRED'] },
      },
      include: { plan: true },
      orderBy: { startsAt: 'desc' },
    });
    if (!current) throw new NotFoundException('No subscription to renew');
    if (!current.plan) throw new BadRequestException('Plan missing');

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    if (current.plan.billingInterval === 'YEARLY') {
      endsAt.setFullYear(endsAt.getFullYear() + 1);
    } else if (current.plan.billingInterval === 'QUARTERLY') {
      endsAt.setMonth(endsAt.getMonth() + 3);
    } else {
      endsAt.setMonth(endsAt.getMonth() + 1);
    }

    return this.prisma.$transaction(async (tx) => {
      // Clear other active markers for this company
      await tx.subscription.updateMany({
        where: {
          companyId,
          activeCompanyId: companyId,
          id: { not: current.id },
        },
        data: { activeCompanyId: null },
      });

      const subscription = await tx.subscription.update({
        where: { id: current.id },
        data: {
          status: 'ACTIVE',
          startsAt,
          endsAt,
          cancelledAt: null,
          autoRenew: true,
          activeCompanyId: companyId,
        },
        include: { plan: { include: { features: true } } },
      });
      await tx.company.update({
        where: { id: companyId },
        data: { status: 'ACTIVE' },
      });
      return subscription;
    });
  }

  listInvoices(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.subscriptionInvoice.findMany({
      where: { subscription: { companyId } },
      include: {
        subscription: { select: { id: true, planId: true, status: true } },
        payments: true,
      },
      orderBy: { issuedAt: 'desc' },
      take: 100,
    });
  }
}
