import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  list(includeInactive = false) {
    return this.prisma.plan.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: { features: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  getByCode(code: string) {
    return this.prisma.plan.findUniqueOrThrow({
      where: { code },
      include: { features: true },
    });
  }

  async create(input: {
    code: string;
    name: string;
    billingInterval?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    price: string | number;
    currency?: string;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    const code = input.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,40}$/.test(code)) {
      throw new BadRequestException(
        'Plan code must be 2-40 chars: A-Z, 0-9, _ or -',
      );
    }

    const existing = await this.prisma.plan.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException('Plan code already exists');
    }

    const price = Number(input.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException('Invalid price');
    }

    return this.prisma.plan.create({
      data: {
        code,
        name: input.name.trim(),
        billingInterval: input.billingInterval ?? 'MONTHLY',
        price: new Prisma.Decimal(price.toFixed(2)),
        currency: (input.currency ?? 'SAR').toUpperCase().slice(0, 3),
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
      include: { features: true },
    });
  }

  async update(
    code: string,
    input: {
      name?: string;
      billingInterval?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
      price?: string | number;
      currency?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    await this.requirePlan(code);

    const data: Prisma.PlanUpdateInput = {};
    if (input.name != null) data.name = input.name.trim();
    if (input.billingInterval != null) {
      data.billingInterval = input.billingInterval;
    }
    if (input.price != null) {
      const price = Number(input.price);
      if (!Number.isFinite(price) || price < 0) {
        throw new BadRequestException('Invalid price');
      }
      data.price = new Prisma.Decimal(price.toFixed(2));
    }
    if (input.currency != null) {
      data.currency = input.currency.toUpperCase().slice(0, 3);
    }
    if (input.isActive != null) data.isActive = input.isActive;
    if (input.sortOrder != null) data.sortOrder = input.sortOrder;

    return this.prisma.plan.update({
      where: { code },
      data,
      include: { features: true },
    });
  }

  async remove(code: string) {
    const plan = await this.requirePlan(code);
    const usage = await this.prisma.subscription.count({
      where: { planId: plan.id },
    });

    if (usage > 0) {
      // Soft-delete when plan is referenced by subscriptions
      return this.prisma.plan.update({
        where: { code },
        data: { isActive: false },
        include: { features: true },
      });
    }

    await this.prisma.planFeature.deleteMany({ where: { planId: plan.id } });
    return this.prisma.plan.delete({ where: { code } });
  }

  private async requirePlan(code: string) {
    const plan = await this.prisma.plan.findUnique({ where: { code } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }
}
