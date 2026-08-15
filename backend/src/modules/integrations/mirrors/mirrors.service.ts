import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';

const ENTITY_HANDLERS = [
  'categories',
  'products',
  'customers',
  'orders',
  'promotions',
  'settlements',
  'drivers',
  'refunds',
  'fulfillments',
  'installments',
] as const;

export type MirrorEntity = (typeof ENTITY_HANDLERS)[number];

@Injectable()
export class MirrorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async list(companyId: string, projectId: string, entity: string, take = 50) {
    this.tenant.setCompanyId(companyId);
    await this.ensureProject(companyId, projectId);
    const limit = Math.min(Math.max(take, 1), 200);

    switch (entity as MirrorEntity) {
      case 'categories':
        return this.prisma.externalCategory.findMany({
          where: { connectedProjectId: projectId },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          take: limit,
        });
      case 'products':
        return this.prisma.externalProduct.findMany({
          where: { connectedProjectId: projectId },
          include: { variants: true, category: true },
          orderBy: { name: 'asc' },
          take: limit,
        });
      case 'customers':
        return this.prisma.externalCustomer.findMany({
          where: { connectedProjectId: projectId },
          select: {
            id: true,
            externalId: true,
            displayName: true,
            status: true,
            dataRetentionUntil: true,
            lastSyncedAt: true,
            rawPayload: true,
          },
          orderBy: { lastSyncedAt: 'desc' },
          take: limit,
        });
      case 'orders':
        return this.prisma.externalOrder.findMany({
          where: { connectedProjectId: projectId },
          include: {
            items: true,
            customer: {
              select: { id: true, externalId: true, displayName: true },
            },
          },
          orderBy: { placedAt: 'desc' },
          take: limit,
        });
      case 'promotions':
        return this.prisma.externalPromotion.findMany({
          where: { connectedProjectId: projectId },
          orderBy: { name: 'asc' },
          take: limit,
        });
      case 'settlements':
        return this.prisma.externalSettlement.findMany({
          where: { connectedProjectId: projectId },
          orderBy: { periodEnd: 'desc' },
          take: limit,
        });
      case 'drivers':
        return this.prisma.externalDriver.findMany({
          where: { connectedProjectId: projectId },
          select: {
            id: true,
            externalId: true,
            name: true,
            status: true,
            vehicleType: true,
            lastSyncedAt: true,
            rawPayload: true,
          },
          orderBy: { name: 'asc' },
          take: limit,
        });
      case 'refunds':
        return this.prisma.externalRefund.findMany({
          where: { connectedProjectId: projectId },
          orderBy: { requestedAt: 'desc' },
          take: limit,
        });
      case 'fulfillments':
        return this.prisma.externalFulfillment.findMany({
          where: { connectedProjectId: projectId },
          orderBy: { pickupAt: 'desc' },
          take: limit,
        });
      case 'installments':
        return this.prisma.installmentTransaction.findMany({
          where: { connectedProjectId: projectId },
          include: { events: true, refunds: true, disputes: true },
          orderBy: { lastSyncedAt: 'desc' },
          take: limit,
        });
      default:
        throw new NotFoundException(
          `Unknown mirror entity. Use one of: ${ENTITY_HANDLERS.join(', ')}`,
        );
    }
  }

  async getOrder(companyId: string, projectId: string, orderId: string) {
    this.tenant.setCompanyId(companyId);
    await this.ensureProject(companyId, projectId);
    return this.prisma.externalOrder.findFirstOrThrow({
      where: { id: orderId, connectedProjectId: projectId },
      include: {
        items: true,
        statusHistory: { orderBy: { occurredAt: 'asc' } },
        refunds: true,
        fulfillments: true,
        customer: {
          select: { id: true, externalId: true, displayName: true },
        },
      },
    });
  }

  private async ensureProject(companyId: string, projectId: string) {
    const project = await this.prisma.connectedProject.findFirst({
      where: { id: projectId, companyId },
    });
    if (!project) {
      throw new NotFoundException('Connected project not found');
    }
    return project;
  }
}
