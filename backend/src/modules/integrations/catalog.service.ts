import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories() {
    return this.prisma.platformCategory.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  listProviders(categoryCode?: string) {
    return this.prisma.platformProvider.findMany({
      where: {
        isActive: true,
        ...(categoryCode
          ? { category: { code: categoryCode } }
          : undefined),
      },
      include: {
        category: true,
        _count: { select: { capabilities: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getProvider(code: string) {
    return this.prisma.platformProvider.findUniqueOrThrow({
      where: { code },
      include: {
        category: true,
        capabilities: {
          include: { capability: true },
          orderBy: { capabilityId: 'asc' },
        },
      },
    });
  }

  listCapabilities() {
    return this.prisma.capability.findMany({
      orderBy: [{ entityType: 'asc' }, { code: 'asc' }],
    });
  }
}
