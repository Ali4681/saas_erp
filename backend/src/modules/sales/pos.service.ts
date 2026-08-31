import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  listBranches(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.companyBranch.findMany({
      where: { companyId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  listPointsOfSale(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.pointOfSale.findMany({
      where: { companyId },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        cashiers: {
          where: { status: 'ACTIVE' },
          include: {
            employee: {
              select: { id: true, fullName: true, employeeNumber: true },
            },
            user: { select: { id: true, email: true, fullName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { cashiers: true, invoices: true } },
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  async createPointOfSale(input: {
    companyId: string;
    code: string;
    name: string;
    companyBranchId?: string;
    locationNote?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const code = input.code.trim().toUpperCase();
    if (!code || !input.name.trim()) {
      throw new BadRequestException('Code and name are required');
    }
    if (input.companyBranchId) {
      const branch = await this.prisma.companyBranch.findFirst({
        where: { id: input.companyBranchId, companyId: input.companyId },
      });
      if (!branch) throw new BadRequestException('Branch not found');
    }
    const existing = await this.prisma.pointOfSale.findFirst({
      where: { companyId: input.companyId, code },
    });
    if (existing) throw new BadRequestException('POS code already exists');

    return this.prisma.pointOfSale.create({
      data: {
        companyId: input.companyId,
        code,
        name: input.name.trim(),
        companyBranchId: input.companyBranchId || null,
        locationNote: input.locationNote?.trim() || null,
      },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        cashiers: true,
        _count: { select: { cashiers: true, invoices: true } },
      },
    });
  }

  async updatePointOfSale(
    companyId: string,
    posId: string,
    input: {
      name?: string;
      companyBranchId?: string | null;
      locationNote?: string | null;
      status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
    },
  ) {
    this.tenant.setCompanyId(companyId);
    const pos = await this.prisma.pointOfSale.findFirst({
      where: { id: posId, companyId },
    });
    if (!pos) throw new NotFoundException('Point of sale not found');

    if (input.companyBranchId) {
      const branch = await this.prisma.companyBranch.findFirst({
        where: { id: input.companyBranchId, companyId },
      });
      if (!branch) throw new BadRequestException('Branch not found');
    }

    return this.prisma.pointOfSale.update({
      where: { id: posId },
      data: {
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.companyBranchId !== undefined
          ? { companyBranchId: input.companyBranchId }
          : {}),
        ...(input.locationNote !== undefined
          ? { locationNote: input.locationNote?.trim() || null }
          : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        cashiers: {
          include: {
            employee: {
              select: { id: true, fullName: true, employeeNumber: true },
            },
          },
        },
        _count: { select: { cashiers: true, invoices: true } },
      },
    });
  }

  listCashiers(companyId: string, pointOfSaleId?: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.posCashier.findMany({
      where: {
        companyId,
        ...(pointOfSaleId ? { pointOfSaleId } : {}),
      },
      include: {
        pointOfSale: { select: { id: true, code: true, name: true } },
        employee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        user: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addCashier(input: {
    companyId: string;
    pointOfSaleId: string;
    employeeId: string;
    displayName?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const pos = await this.prisma.pointOfSale.findFirst({
      where: { id: input.pointOfSaleId, companyId: input.companyId },
    });
    if (!pos) throw new NotFoundException('Point of sale not found');
    if (pos.status !== 'ACTIVE') {
      throw new BadRequestException('Point of sale is not active');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: input.employeeId, companyId: input.companyId },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (!employee.userId) {
      throw new BadRequestException(
        'Employee must have a login user to be a cashier',
      );
    }

    const duplicate = await this.prisma.posCashier.findFirst({
      where: {
        pointOfSaleId: input.pointOfSaleId,
        OR: [{ employeeId: input.employeeId }, { userId: employee.userId }],
      },
    });
    if (duplicate) {
      throw new BadRequestException('Cashier already assigned to this POS');
    }

    return this.prisma.posCashier.create({
      data: {
        companyId: input.companyId,
        pointOfSaleId: input.pointOfSaleId,
        employeeId: input.employeeId,
        userId: employee.userId,
        displayName: input.displayName?.trim() || employee.fullName,
      },
      include: {
        pointOfSale: { select: { id: true, code: true, name: true } },
        employee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  async updateCashier(
    companyId: string,
    cashierId: string,
    input: {
      displayName?: string | null;
      status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
    },
  ) {
    this.tenant.setCompanyId(companyId);
    const cashier = await this.prisma.posCashier.findFirst({
      where: { id: cashierId, companyId },
    });
    if (!cashier) throw new NotFoundException('Cashier not found');

    return this.prisma.posCashier.update({
      where: { id: cashierId },
      data: {
        ...(input.displayName !== undefined
          ? { displayName: input.displayName?.trim() || null }
          : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      include: {
        pointOfSale: { select: { id: true, code: true, name: true } },
        employee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  async removeCashier(companyId: string, cashierId: string) {
    this.tenant.setCompanyId(companyId);
    const cashier = await this.prisma.posCashier.findFirst({
      where: { id: cashierId, companyId },
    });
    if (!cashier) throw new NotFoundException('Cashier not found');
    return this.prisma.posCashier.update({
      where: { id: cashierId },
      data: { status: 'INACTIVE' },
    });
  }

  /** Resolve POS + cashier for invoice create; may set branch from POS. */
  async resolveSaleAttribution(
    companyId: string,
    pointOfSaleId?: string,
    posCashierId?: string,
  ): Promise<{
    pointOfSaleId?: string;
    posCashierId?: string;
    companyBranchId?: string;
  }> {
    if (!pointOfSaleId && !posCashierId) return {};

    let posId = pointOfSaleId;
    let cashierId = posCashierId;
    let branchId: string | undefined;

    if (cashierId) {
      const cashier = await this.prisma.posCashier.findFirst({
        where: { id: cashierId, companyId, status: 'ACTIVE' },
        include: { pointOfSale: true },
      });
      if (!cashier) throw new BadRequestException('Cashier not found or inactive');
      if (posId && cashier.pointOfSaleId !== posId) {
        throw new BadRequestException('Cashier does not belong to this POS');
      }
      posId = cashier.pointOfSaleId;
      branchId = cashier.pointOfSale.companyBranchId ?? undefined;
    }

    if (posId) {
      const pos = await this.prisma.pointOfSale.findFirst({
        where: { id: posId, companyId, status: 'ACTIVE' },
      });
      if (!pos) throw new BadRequestException('Point of sale not found or inactive');
      branchId = branchId ?? pos.companyBranchId ?? undefined;
    }

    return {
      pointOfSaleId: posId,
      posCashierId: cashierId,
      companyBranchId: branchId,
    };
  }
}
