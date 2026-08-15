import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StockMovementType } from '../../generated/prisma/client';
import { DocumentNumberService } from '../../common/documents/document-number.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { AutomationEngine } from '../automation/automation.engine';

const OUTBOUND_TYPES = new Set<StockMovementType>([
  'SALE_ISSUE',
  'RETURN_OUT',
  'TRANSFER_OUT',
]);

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly docNumbers: DocumentNumberService,
    @Inject(forwardRef(() => AutomationEngine))
    private readonly automation: AutomationEngine,
  ) {}

  private emit(
    companyId: string,
    event: string,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>,
  ) {
    void this.automation
      .dispatch({ companyId, event, entityType, entityId, payload })
      .catch((error) => {
        this.logger.warn(
          `automation ${event} failed: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      });
  }

  // --- Categories / Units / Items / Warehouses ---

  listCategories(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.itemCategory.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(input: {
    companyId: string;
    name: string;
    code?: string;
    parentId?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const code = input.code?.trim() || null;
    return this.prisma.itemCategory.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        code,
        codeKey: code ?? '',
        parentId: input.parentId,
      },
    });
  }

  listUnits(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.unit.findMany({ orderBy: { code: 'asc' } });
  }

  async createUnit(input: {
    companyId: string;
    code: string;
    name: string;
    decimalPlaces?: number;
  }) {
    this.tenant.setCompanyId(input.companyId);
    return this.prisma.unit.create({
      data: {
        companyId: input.companyId,
        code: input.code,
        name: input.name,
        decimalPlaces: input.decimalPlaces ?? 0,
      },
    });
  }

  listItems(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.item.findMany({
      include: {
        unit: true,
        category: { select: { id: true, name: true, parentId: true } },
        parentItem: { select: { id: true, name: true, sku: true } },
        childItems: { select: { id: true, name: true, sku: true } },
      },
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  async createItem(input: {
    companyId: string;
    unitId: string;
    name: string;
    itemCategoryId?: string;
    parentItemId?: string;
    sku?: string;
    barcode?: string;
    cost?: string | number;
    salePrice?: string | number;
    minStock?: string | number;
    taxRate?: string | number;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const unit = await this.prisma.unit.findFirst({
      where: { id: input.unitId, companyId: input.companyId },
    });
    if (!unit) {
      throw new BadRequestException('Unit not found');
    }
    if (input.parentItemId) {
      const parent = await this.prisma.item.findFirst({
        where: { id: input.parentItemId, companyId: input.companyId },
      });
      if (!parent) {
        throw new BadRequestException('Parent item not found');
      }
    }

    const sku = input.sku?.trim() || null;
    const barcode = input.barcode?.trim() || null;
    // Empty string collides on @@unique([companyId, skuKey|barcodeKey]);
    // use a per-row sentinel when optional codes are omitted.
    const skuKey = sku ?? `sku:${randomUUID()}`;
    const barcodeKey = barcode ?? `bc:${randomUUID()}`;
    return this.prisma.item.create({
      data: {
        companyId: input.companyId,
        unitId: input.unitId,
        itemCategoryId: input.itemCategoryId,
        parentItemId: input.parentItemId,
        name: input.name,
        sku,
        skuKey,
        barcode,
        barcodeKey,
        cost: input.cost != null ? String(input.cost) : undefined,
        salePrice:
          input.salePrice != null ? String(input.salePrice) : undefined,
        minStock: input.minStock != null ? String(input.minStock) : undefined,
        taxRate: input.taxRate != null ? String(input.taxRate) : undefined,
      },
      include: {
        unit: true,
        parentItem: { select: { id: true, name: true } },
      },
    });
  }

  listWarehouses(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.warehouse.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { code: 'asc' },
    });
  }

  async createWarehouse(input: {
    companyId: string;
    code: string;
    name: string;
    companyBranchId?: string;
    addressLine?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    return this.prisma.warehouse.create({
      data: {
        companyId: input.companyId,
        code: input.code,
        name: input.name,
        companyBranchId: input.companyBranchId,
        addressLine: input.addressLine,
      },
    });
  }

  listBalances(companyId: string, warehouseId?: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.stockBalance.findMany({
      where: {
        warehouse: { companyId },
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: {
        item: { select: { id: true, name: true, sku: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      take: 500,
    });
  }

  listMovements(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.stockMovement.findMany({
      include: {
        item: { select: { id: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }

  async createMovement(input: {
    companyId: string;
    createdById: string;
    warehouseId: string;
    itemId: string;
    movementType: StockMovementType;
    quantity: string | number;
    unitCost?: string | number;
    notes?: string;
    occurredAt?: string;
    referenceType?: string;
    referenceId?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const qty = Number(input.quantity);
    if (qty === 0) {
      throw new BadRequestException('Quantity cannot be zero');
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: input.warehouseId, companyId: input.companyId },
    });
    if (!warehouse) {
      throw new BadRequestException('Warehouse not found');
    }
    const item = await this.prisma.item.findFirst({
      where: { id: input.itemId, companyId: input.companyId },
    });
    if (!item) {
      throw new BadRequestException('Item not found');
    }

    const signedQty = this.signedQuantity(input.movementType, qty);
    const storedQty = Math.abs(qty);

    return this.prisma
      .$transaction(async (tx) => {
        const movement = await tx.stockMovement.create({
          data: {
            companyId: input.companyId,
            warehouseId: input.warehouseId,
            itemId: input.itemId,
            movementType: input.movementType,
            quantity: storedQty.toFixed(3),
            unitCost:
              input.unitCost != null ? String(input.unitCost) : undefined,
            notes: input.notes,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            occurredAt: input.occurredAt
              ? new Date(input.occurredAt)
              : new Date(),
            createdById: input.createdById,
          },
        });

        const balance = await tx.stockBalance.findUnique({
          where: {
            warehouseId_itemId: {
              warehouseId: input.warehouseId,
              itemId: input.itemId,
            },
          },
        });
        const nextQty = Number(balance?.quantityOnHand ?? 0) + signedQty;
        if (nextQty < -0.0001) {
          throw new BadRequestException('Insufficient stock for this movement');
        }

        await tx.stockBalance.upsert({
          where: {
            warehouseId_itemId: {
              warehouseId: input.warehouseId,
              itemId: input.itemId,
            },
          },
          create: {
            warehouseId: input.warehouseId,
            itemId: input.itemId,
            quantityOnHand: nextQty.toFixed(3),
          },
          update: {
            quantityOnHand: nextQty.toFixed(3),
          },
        });

        return movement;
      })
      .then(async (movement) => {
        await this.emitLowStockIfNeeded(
          input.companyId,
          input.itemId,
          input.warehouseId,
        );
        return movement;
      });
  }

  private async emitLowStockIfNeeded(
    companyId: string,
    itemId: string,
    warehouseId: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, companyId },
    });
    if (!item) return;

    const aggregates = await this.prisma.stockBalance.aggregate({
      where: { itemId, warehouse: { companyId } },
      _sum: { quantityOnHand: true },
    });
    const onHand = Number(aggregates._sum.quantityOnHand ?? 0);
    const minStock = Number(item.minStock ?? 0);
    if (minStock <= 0) return;
    if (onHand > minStock) return;

    this.emit(companyId, 'inventory.stock.low', 'item', item.id, {
      itemId: item.id,
      itemName: item.name,
      sku: item.sku,
      warehouseId,
      onHand,
      minStock,
      atOrBelowMin: onHand <= minStock,
    });
  }

  // --- Stock counts ---

  listCounts(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.stockCount.findMany({
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        items: true,
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  async createStockCount(input: {
    companyId: string;
    createdById: string;
    warehouseId: string;
    itemIds?: string[];
  }) {
    this.tenant.setCompanyId(input.companyId);
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: input.warehouseId, companyId: input.companyId },
    });
    if (!warehouse) {
      throw new BadRequestException('Warehouse not found');
    }

    const open = await this.prisma.stockCount.findFirst({
      where: {
        warehouseId: input.warehouseId,
        status: { in: ['DRAFT', 'IN_PROGRESS'] },
      },
    });
    if (open) {
      throw new BadRequestException(
        'An open stock count already exists for this warehouse',
      );
    }

    const balances = await this.prisma.stockBalance.findMany({
      where: {
        warehouseId: input.warehouseId,
        ...(input.itemIds?.length ? { itemId: { in: input.itemIds } } : {}),
      },
    });

    return this.prisma.$transaction(async (tx) => {
      const countNumber = await this.docNumbers.nextSequence(
        tx,
        input.companyId,
        'stockCount',
      );
      return tx.stockCount.create({
        data: {
          companyId: input.companyId,
          warehouseId: input.warehouseId,
          countNumber,
          status: 'IN_PROGRESS',
          openWarehouseId: input.warehouseId,
          startedAt: new Date(),
          createdById: input.createdById,
          items: {
            create: balances.map((balance) => ({
              itemId: balance.itemId,
              systemQuantity: balance.quantityOnHand,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  async submitCountLine(
    companyId: string,
    stockCountId: string,
    itemId: string,
    countedQuantity: string | number,
  ) {
    this.tenant.setCompanyId(companyId);
    const count = await this.prisma.stockCount.findFirst({
      where: { id: stockCountId, companyId },
    });
    if (!count) {
      throw new NotFoundException('Stock count not found');
    }
    if (!['DRAFT', 'IN_PROGRESS'].includes(count.status)) {
      throw new BadRequestException('Stock count is not open');
    }

    const line = await this.prisma.stockCountItem.findFirst({
      where: { stockCountId, itemId },
    });
    if (!line) {
      throw new NotFoundException('Count line not found');
    }

    const counted = Number(countedQuantity);
    const variance = counted - Number(line.systemQuantity);
    return this.prisma.stockCountItem.update({
      where: { id: line.id },
      data: {
        countedQuantity: counted.toFixed(3),
        varianceQuantity: variance.toFixed(3),
      },
    });
  }

  async approveStockCount(
    companyId: string,
    stockCountId: string,
    approvedById: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const count = await this.prisma.stockCount.findFirst({
      where: { id: stockCountId, companyId },
      include: { items: true },
    });
    if (!count) {
      throw new NotFoundException('Stock count not found');
    }
    if (!['IN_PROGRESS', 'SUBMITTED'].includes(count.status)) {
      throw new BadRequestException('Stock count cannot be approved');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const line of count.items) {
        if (line.countedQuantity == null || line.varianceQuantity == null) {
          continue;
        }
        const variance = Number(line.varianceQuantity);
        if (variance === 0) {
          continue;
        }

        await tx.stockMovement.create({
          data: {
            companyId,
            warehouseId: count.warehouseId,
            itemId: line.itemId,
            movementType: 'COUNT_ADJUSTMENT',
            quantity: Math.abs(variance).toFixed(3),
            referenceType: 'stock_count',
            referenceId: count.id,
            occurredAt: new Date(),
            createdById: approvedById,
            notes: `Count ${count.countNumber} adjustment`,
          },
        });

        await tx.stockBalance.upsert({
          where: {
            warehouseId_itemId: {
              warehouseId: count.warehouseId,
              itemId: line.itemId,
            },
          },
          create: {
            warehouseId: count.warehouseId,
            itemId: line.itemId,
            quantityOnHand: String(line.countedQuantity),
          },
          update: {
            quantityOnHand: String(line.countedQuantity),
          },
        });
      }

      return tx.stockCount.update({
        where: { id: count.id },
        data: {
          status: 'APPROVED',
          openWarehouseId: null,
          completedAt: new Date(),
          approvedById,
        },
        include: { items: true },
      });
    });
  }

  private signedQuantity(type: StockMovementType, quantity: number): number {
    if (type === 'COUNT_ADJUSTMENT' || type === 'MANUAL_ADJUSTMENT') {
      return quantity;
    }
    if (OUTBOUND_TYPES.has(type)) {
      return -Math.abs(quantity);
    }
    return Math.abs(quantity);
  }
}
