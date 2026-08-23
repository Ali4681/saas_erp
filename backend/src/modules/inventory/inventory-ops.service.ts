import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import { DocumentNumberService } from '../../common/documents/document-number.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { GlService } from '../finance/gl.service';
import { InventoryService } from './inventory.service';

@Injectable()
export class InventoryOpsService {
  private readonly logger = new Logger(InventoryOpsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly docNumbers: DocumentNumberService,
    private readonly inventory: InventoryService,
    private readonly gl: GlService,
  ) {}

  /** Resolve effective tax from item → category tree inheritance. */
  async resolveEffectiveTaxRate(companyId: string, itemId: string) {
    this.tenant.setCompanyId(companyId);
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, companyId },
      include: { category: true },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (!item.inheritTaxFromCategory || Number(item.taxRate) > 0) {
      return Number(item.taxRate);
    }
    let cat = item.category;
    while (cat) {
      if (cat.inheritedTaxRate != null) return Number(cat.inheritedTaxRate);
      if (!cat.parentId) break;
      cat = await this.prisma.itemCategory.findFirst({
        where: { id: cat.parentId, companyId },
      });
    }
    return Number(item.taxRate);
  }

  async updateCategoryInheritance(
    companyId: string,
    categoryId: string,
    data: {
      inheritedTaxRate?: number | null;
      inheritedAttributes?: Record<string, unknown>;
      abcClass?: string | null;
      shelfLifeDaysAlert?: number | null;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    const cat = await this.prisma.itemCategory.findFirst({
      where: { id: categoryId, companyId },
    });
    if (!cat) throw new NotFoundException('Category not found');
    return this.prisma.itemCategory.update({
      where: { id: categoryId },
      data: {
        inheritedTaxRate:
          data.inheritedTaxRate === undefined
            ? undefined
            : data.inheritedTaxRate,
        inheritedAttributes:
          data.inheritedAttributes === undefined
            ? undefined
            : (data.inheritedAttributes as object),
        abcClass: data.abcClass === undefined ? undefined : data.abcClass,
        shelfLifeDaysAlert:
          data.shelfLifeDaysAlert === undefined
            ? undefined
            : data.shelfLifeDaysAlert,
      },
    });
  }

  async linkItemCategories(
    companyId: string,
    itemId: string,
    categoryIds: string[],
    primaryCategoryId?: string,
  ) {
    this.tenant.setCompanyId(companyId);
    await this.requireItem(companyId, itemId);
    await this.prisma.itemCategoryLink.deleteMany({ where: { itemId } });
    for (const categoryId of categoryIds) {
      await this.prisma.itemCategoryLink.create({
        data: {
          companyId,
          itemId,
          categoryId,
          isPrimary: categoryId === (primaryCategoryId ?? categoryIds[0]),
        },
      });
    }
    if (primaryCategoryId) {
      await this.prisma.item.update({
        where: { id: itemId },
        data: { itemCategoryId: primaryCategoryId },
      });
    }
    return this.prisma.itemCategoryLink.findMany({
      where: { itemId },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async addItemRelation(input: {
    companyId: string;
    fromItemId: string;
    toItemId: string;
    relationType: 'SUBSTITUTE' | 'CROSS_SELL' | 'COMPLEMENT';
    priority?: number;
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.requireItem(input.companyId, input.fromItemId);
    await this.requireItem(input.companyId, input.toItemId);
    return this.prisma.itemRelation.create({
      data: {
        companyId: input.companyId,
        fromItemId: input.fromItemId,
        toItemId: input.toItemId,
        relationType: input.relationType,
        priority: input.priority ?? 0,
      },
      include: {
        toItem: { select: { id: true, name: true, sku: true } },
      },
    });
  }

  listItemRelations(companyId: string, itemId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.itemRelation.findMany({
      where: { companyId, fromItemId: itemId },
      include: { toItem: { select: { id: true, name: true, sku: true } } },
      orderBy: [{ relationType: 'asc' }, { priority: 'desc' }],
    });
  }

  async createAttributeDef(input: {
    companyId: string;
    code: string;
    name: string;
    dataType?: string;
    categoryId?: string;
    isRequired?: boolean;
    options?: unknown;
  }) {
    this.tenant.setCompanyId(input.companyId);
    return this.prisma.itemAttributeDef.create({
      data: {
        companyId: input.companyId,
        code: input.code,
        name: input.name,
        dataType: input.dataType ?? 'TEXT',
        categoryId: input.categoryId,
        isRequired: input.isRequired ?? false,
        optionsJson: input.options as object | undefined,
      },
    });
  }

  listAttributeDefs(companyId: string, categoryId?: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.itemAttributeDef.findMany({
      where: {
        companyId,
        OR: categoryId
          ? [{ categoryId }, { categoryId: null }]
          : undefined,
      },
      orderBy: { code: 'asc' },
    });
  }

  async setItemAttribute(
    companyId: string,
    itemId: string,
    attributeDefId: string,
    valueText: string,
  ) {
    this.tenant.setCompanyId(companyId);
    await this.requireItem(companyId, itemId);
    return this.prisma.itemAttributeValue.upsert({
      where: {
        itemId_attributeDefId: { itemId, attributeDefId },
      },
      create: { itemId, attributeDefId, valueText },
      update: { valueText },
    });
  }

  async addUnitConversion(input: {
    companyId: string;
    itemId: string;
    unitId: string;
    factorToBase: number;
    barcode?: string;
    isSellUnit?: boolean;
    isPurchaseUnit?: boolean;
  }) {
    this.tenant.setCompanyId(input.companyId);
    if (!(input.factorToBase > 0)) {
      throw new BadRequestException('factorToBase must be > 0');
    }
    await this.requireItem(input.companyId, input.itemId);
    return this.prisma.itemUnitConversion.create({
      data: {
        companyId: input.companyId,
        itemId: input.itemId,
        unitId: input.unitId,
        factorToBase: input.factorToBase,
        barcode: input.barcode,
        isSellUnit: input.isSellUnit ?? false,
        isPurchaseUnit: input.isPurchaseUnit ?? false,
      },
      include: { unit: true },
    });
  }

  listUnitConversions(companyId: string, itemId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.itemUnitConversion.findMany({
      where: { companyId, itemId },
      include: { unit: true },
    });
  }

  /** Generate matrix variants from axes e.g. { Color: ['Red','Blue'], Size: ['S','M'] } */
  async generateMatrixVariants(input: {
    companyId: string;
    parentItemId: string;
    axes: Record<string, string[]>;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const parent = await this.prisma.item.findFirst({
      where: { id: input.parentItemId, companyId: input.companyId },
    });
    if (!parent) throw new NotFoundException('Parent item not found');
    const keys = Object.keys(input.axes);
    if (!keys.length) throw new BadRequestException('axes required');
    const combos = this.cartesian(
      keys.map((k) => input.axes[k].map((v) => ({ [k]: v }))),
    ).map((parts) => Object.assign({}, ...parts));

    await this.prisma.item.update({
      where: { id: parent.id },
      data: {
        isMatrixParent: true,
        matrixAxes: input.axes as object,
      },
    });

    const created: Array<{ id: string; name: string }> = [];
    for (const combo of combos) {
      const suffix = Object.values(combo).join('-');
      const name = `${parent.name} / ${suffix}`;
      const sku = parent.sku ? `${parent.sku}-${suffix}` : null;
      const skuKey = sku ?? `sku:${randomUUID()}`;
      const existing = sku
        ? await this.prisma.item.findFirst({
            where: { companyId: input.companyId, skuKey: sku },
          })
        : null;
      if (existing) {
        created.push({ id: existing.id, name: existing.name });
        continue;
      }
      const child = await this.prisma.item.create({
        data: {
          companyId: input.companyId,
          unitId: parent.unitId,
          itemCategoryId: parent.itemCategoryId,
          parentItemId: parent.id,
          name,
          nameAr: parent.nameAr,
          nameEn: parent.nameEn,
          sku,
          skuKey,
          barcodeKey: `bc:${randomUUID()}`,
          cost: parent.cost,
          salePrice: parent.salePrice,
          taxRate: parent.taxRate,
          inheritTaxFromCategory: parent.inheritTaxFromCategory,
          minStock: parent.minStock,
          reorderQty: parent.reorderQty,
        },
      });
      created.push({ id: child.id, name: child.name });
    }
    return { parentId: parent.id, count: created.length, variants: created };
  }

  async listBarcodes(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.itemBarcode.findMany({
      where: { companyId },
      include: { item: { select: { id: true, name: true } } },
      orderBy: { barcode: 'asc' },
      take: 200,
    });
  }

  async generateBarcode(input: {
    companyId: string;
    itemId: string;
    barcodeType?: string;
    unitId?: string;
    serialBased?: boolean;
    quantity?: number;
    payload?: Record<string, unknown>;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const item = await this.requireItem(input.companyId, input.itemId);
    const qty = Math.max(1, input.quantity ?? 1);
    const rows: Array<{ id: string; barcode: string }> = [];
    for (let i = 0; i < qty; i++) {
      const barcode = input.serialBased
        ? `SN${Date.now().toString(36).toUpperCase()}${randomInt(1000, 9999)}`
        : this.ean13FromSku(item.sku ?? item.id, i);
      const row = await this.prisma.itemBarcode.create({
        data: {
          companyId: input.companyId,
          itemId: input.itemId,
          barcode,
          barcodeType: input.barcodeType ?? (input.serialBased ? 'SERIAL' : 'RETAIL'),
          unitId: input.unitId,
          isPrimary: i === 0 && !input.serialBased,
          payloadJson: input.payload as object | undefined,
        },
      });
      rows.push({ id: row.id, barcode: row.barcode });
      if (!item.barcode && i === 0 && !input.serialBased) {
        await this.prisma.item.update({
          where: { id: item.id },
          data: { barcode, barcodeKey: barcode },
        });
      }
      if (input.serialBased) {
        await this.prisma.itemSerial.create({
          data: {
            companyId: input.companyId,
            itemId: input.itemId,
            serialNumber: barcode,
            status: 'IN_STOCK',
          },
        });
      }
    }
    return rows;
  }

  async lookupBarcode(companyId: string, barcode: string) {
    this.tenant.setCompanyId(companyId);
    const row = await this.prisma.itemBarcode.findFirst({
      where: { companyId, barcode },
      include: {
        item: {
          include: {
            unit: true,
            relationsFrom: {
              include: { toItem: { select: { id: true, name: true } } },
            },
          },
        },
        unit: true,
      },
    });
    if (row) {
      const balances = await this.prisma.stockBalance.findMany({
        where: { itemId: row.itemId, warehouse: { companyId, isSellable: true } },
      });
      const reserved = balances.reduce((s, b) => s + Number(b.quantityReserved), 0);
      const onHand = balances.reduce((s, b) => s + Number(b.quantityOnHand), 0);
      const activeRes = await this.prisma.stockReservation.findFirst({
        where: { companyId, itemId: row.itemId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });
      return {
        ...row,
        available: onHand - reserved,
        liveStatus: activeRes
          ? { reserved: true, sourceType: activeRes.sourceType, sourceId: activeRes.sourceId }
          : { reserved: false },
      };
    }
    const byItem = await this.prisma.item.findFirst({
      where: { companyId, barcode },
      include: { unit: true },
    });
    if (!byItem) throw new NotFoundException('Barcode not found');
    return { barcode, barcodeType: 'RETAIL', item: byItem, isPrimary: true };
  }

  async createTransfer(input: {
    companyId: string;
    requestedById: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    notes?: string;
    items: Array<{ itemId: string; quantity: number }>;
  }) {
    this.tenant.setCompanyId(input.companyId);
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new BadRequestException('Warehouses must differ');
    }
    if (!input.items?.length) throw new BadRequestException('Items required');
    const transferNumber = await this.docNumbers.nextSequence(
      this.prisma,
      input.companyId,
      'stockTransfer',
    );
    return this.prisma.stockTransfer.create({
      data: {
        companyId: input.companyId,
        transferNumber,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        status: 'DRAFT',
        requestedById: input.requestedById,
        notes: input.notes,
        items: {
          create: input.items.map((l) => ({
            itemId: l.itemId,
            quantity: l.quantity,
          })),
        },
      },
      include: { items: true },
    });
  }

  listTransfers(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.stockTransfer.findMany({
      where: { companyId },
      include: {
        fromWarehouse: { select: { id: true, code: true, name: true } },
        toWarehouse: { select: { id: true, code: true, name: true } },
        items: { include: { item: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async shipTransfer(companyId: string, transferId: string, userId: string) {
    this.tenant.setCompanyId(companyId);
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id: transferId, companyId },
      include: { items: true },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== 'DRAFT' && transfer.status !== 'REQUESTED') {
      throw new BadRequestException(`Cannot ship from ${transfer.status}`);
    }
    for (const line of transfer.items) {
      await this.inventory.createMovement({
        companyId,
        createdById: userId,
        warehouseId: transfer.fromWarehouseId,
        itemId: line.itemId,
        movementType: 'TRANSFER_OUT',
        quantity: Number(line.quantity),
        referenceType: 'STOCK_TRANSFER',
        referenceId: transfer.id,
      });
    }
    return this.prisma.stockTransfer.update({
      where: { id: transfer.id },
      data: { status: 'IN_TRANSIT', shippedAt: new Date() },
      include: { items: true },
    });
  }

  async receiveTransfer(companyId: string, transferId: string, userId: string) {
    this.tenant.setCompanyId(companyId);
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id: transferId, companyId },
      include: { items: true },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== 'IN_TRANSIT') {
      throw new BadRequestException(`Cannot receive from ${transfer.status}`);
    }
    for (const line of transfer.items) {
      const qty = Number(line.quantityReceived ?? line.quantity);
      await this.inventory.createMovement({
        companyId,
        createdById: userId,
        warehouseId: transfer.toWarehouseId,
        itemId: line.itemId,
        movementType: 'TRANSFER_IN',
        quantity: qty,
        referenceType: 'STOCK_TRANSFER',
        referenceId: transfer.id,
      });
      await this.prisma.stockTransferItem.update({
        where: { id: line.id },
        data: { quantityReceived: qty },
      });
    }
    return this.prisma.stockTransfer.update({
      where: { id: transfer.id },
      data: { status: 'RECEIVED', receivedAt: new Date() },
      include: { items: true },
    });
  }

  async reserveStock(input: {
    companyId: string;
    warehouseId: string;
    itemId: string;
    quantity: number;
    sourceType: string;
    sourceId: string;
    expiresInMinutes?: number;
  }) {
    this.tenant.setCompanyId(input.companyId);
    if (!(input.quantity > 0)) throw new BadRequestException('quantity > 0');
    const balance = await this.prisma.stockBalance.findUnique({
      where: {
        warehouseId_itemId: {
          warehouseId: input.warehouseId,
          itemId: input.itemId,
        },
      },
    });
    const available =
      Number(balance?.quantityOnHand ?? 0) -
      Number(balance?.quantityReserved ?? 0);
    if (available + 0.0001 < input.quantity) {
      throw new BadRequestException('Insufficient available stock to reserve');
    }
    const expiresAt = input.expiresInMinutes
      ? new Date(Date.now() + input.expiresInMinutes * 60_000)
      : null;
    const reservation = await this.prisma.stockReservation.create({
      data: {
        companyId: input.companyId,
        warehouseId: input.warehouseId,
        itemId: input.itemId,
        quantity: input.quantity,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        expiresAt,
        status: 'ACTIVE',
      },
    });
    await this.prisma.stockBalance.upsert({
      where: {
        warehouseId_itemId: {
          warehouseId: input.warehouseId,
          itemId: input.itemId,
        },
      },
      create: {
        warehouseId: input.warehouseId,
        itemId: input.itemId,
        quantityOnHand: 0,
        quantityReserved: input.quantity,
      },
      update: { quantityReserved: { increment: input.quantity } },
    });
    return reservation;
  }

  async releaseReservation(companyId: string, reservationId: string) {
    this.tenant.setCompanyId(companyId);
    const row = await this.prisma.stockReservation.findFirst({
      where: { id: reservationId, companyId },
    });
    if (!row) throw new NotFoundException('Reservation not found');
    if (row.status !== 'ACTIVE') return row;
    const bal = await this.prisma.stockBalance.findUnique({
      where: {
        warehouseId_itemId: {
          warehouseId: row.warehouseId,
          itemId: row.itemId,
        },
      },
    });
    const nextReserved = Math.max(
      0,
      Number(bal?.quantityReserved ?? 0) - Number(row.quantity),
    );
    if (bal) {
      await this.prisma.stockBalance.update({
        where: {
          warehouseId_itemId: {
            warehouseId: row.warehouseId,
            itemId: row.itemId,
          },
        },
        data: { quantityReserved: nextReserved },
      });
    }
    return this.prisma.stockReservation.update({
      where: { id: row.id },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
  }

  async expireReservations(companyId?: string) {
    const where = {
      status: 'ACTIVE',
      expiresAt: { lte: new Date() },
      ...(companyId ? { companyId } : {}),
    };
    const due = await this.prisma.stockReservation.findMany({ where });
    for (const row of due) {
      this.tenant.setCompanyId(row.companyId);
      try {
        await this.releaseReservation(row.companyId, row.id);
      } catch (e) {
        this.logger.warn(
          `expire reservation ${row.id}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    return { released: due.length };
  }

  async createAdjustment(input: {
    companyId: string;
    warehouseId: string;
    requestedById: string;
    reasonCode: string;
    notes?: string;
    items: Array<{ itemId: string; quantityDelta: number; unitCost?: number }>;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const allowed = [
      'DAMAGE',
      'EXPIRY',
      'THEFT',
      'SHRINKAGE',
      'DOC_ERROR',
      'WEIGHT_VARIANCE',
      'WRITE_DOWN',
    ];
    if (!allowed.includes(input.reasonCode)) {
      throw new BadRequestException(`Invalid reasonCode`);
    }
    const adjustmentNumber = await this.docNumbers.nextSequence(
      this.prisma,
      input.companyId,
      'stockAdjustment',
    );
    return this.prisma.stockAdjustment.create({
      data: {
        companyId: input.companyId,
        warehouseId: input.warehouseId,
        adjustmentNumber,
        reasonCode: input.reasonCode,
        notes: input.notes,
        requestedById: input.requestedById,
        status: 'PENDING',
        items: {
          create: input.items.map((l) => ({
            itemId: l.itemId,
            quantityDelta: l.quantityDelta,
            unitCost: l.unitCost,
          })),
        },
      },
      include: { items: true },
    });
  }

  listAdjustments(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.stockAdjustment.findMany({
      where: { companyId },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        items: { include: { item: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async approveAdjustment(
    companyId: string,
    adjustmentId: string,
    approverId: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const adj = await this.prisma.stockAdjustment.findFirst({
      where: { id: adjustmentId, companyId },
      include: { items: true },
    });
    if (!adj) throw new NotFoundException('Adjustment not found');
    if (adj.status !== 'PENDING') {
      throw new BadRequestException(`Cannot approve ${adj.status}`);
    }
    if (adj.requestedById === approverId) {
      throw new BadRequestException('Requester cannot approve (SoD)');
    }

    for (const line of adj.items) {
      const delta = Number(line.quantityDelta);
      if (delta === 0) continue;
      // MANUAL_ADJUSTMENT uses signed quantity as-is
      await this.inventory.createMovement({
        companyId,
        createdById: approverId,
        warehouseId: adj.warehouseId,
        itemId: line.itemId,
        movementType: 'MANUAL_ADJUSTMENT',
        quantity: delta,
        unitCost: line.unitCost != null ? Number(line.unitCost) : undefined,
        notes: `ADJ ${adj.adjustmentNumber} ${adj.reasonCode}`,
        referenceType: 'STOCK_ADJUSTMENT',
        referenceId: adj.id,
      });
    }

    try {
      await this.gl.ensureChartOfAccounts(companyId);
      const mapping = await this.gl.getMapping(companyId);
      let shrinkage = 0;
      for (const line of adj.items) {
        const delta = Number(line.quantityDelta);
        if (delta >= 0) continue;
        const item = await this.prisma.item.findUnique({
          where: { id: line.itemId },
        });
        const cost = Number(line.unitCost ?? item?.cost ?? 0);
        shrinkage += Math.abs(delta) * cost;
      }
      if (shrinkage > 0) {
        await this.gl.postJournal({
          companyId,
          userId: approverId,
          entryType: 'INVENTORY_ADJUSTMENT',
          entryDate: new Date(),
          currency: 'SAR',
          memo: `Stock adjustment ${adj.adjustmentNumber} (${adj.reasonCode})`,
          sourceType: 'STOCK_ADJUSTMENT',
          sourceId: adj.id,
          lines: [
            {
              code: mapping.inventoryShrinkageCode || mapping.cogsCode,
              debit: shrinkage,
              credit: 0,
              memo: adj.reasonCode,
            },
            {
              code: mapping.inventoryGoodsCode,
              debit: 0,
              credit: shrinkage,
              memo: 'Inventory write-off',
            },
          ],
        });
      }
    } catch (e) {
      this.logger.warn(
        `adjustment GL: ${e instanceof Error ? e.message : e}`,
      );
    }

    return this.prisma.stockAdjustment.update({
      where: { id: adj.id },
      data: {
        status: 'APPROVED',
        approvedById: approverId,
        approvedAt: new Date(),
      },
      include: { items: true },
    });
  }

  async allocateLandedCost(input: {
    companyId: string;
    purchaseOrderId: string;
    createdById: string;
    goodsReceiptId?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId, companyId: input.companyId },
      include: { items: true },
    });
    if (!po) throw new NotFoundException('PO not found');
    const extras =
      Number(po.freightAmount ?? 0) +
      Number(po.insuranceAmount ?? 0) +
      Number(po.customsAmount ?? 0) +
      Number(po.portFeesAmount ?? 0);
    const lineBases = po.items.map((l) => ({
      itemId: l.itemId,
      qty: Number(l.quantity),
      lineValue: Number(l.quantity) * Number(l.unitCost ?? 0),
    }));
    const totalValue = lineBases.reduce((s, l) => s + l.lineValue, 0) || 1;
    const allocation: Array<{
      itemId: string;
      allocatedExtras: number;
      unitLandedCost: number;
    }> = [];
    for (const line of lineBases) {
      const share = (line.lineValue / totalValue) * extras;
      const unitLanded =
        line.qty > 0 ? Number(line.lineValue / line.qty) + share / line.qty : 0;
      allocation.push({
        itemId: line.itemId,
        allocatedExtras: share,
        unitLandedCost: unitLanded,
      });
      await this.prisma.item.update({
        where: { id: line.itemId },
        data: { cost: unitLandedCostSafe(unitLanded) },
      });
    }
    return this.prisma.landedCostAllocation.create({
      data: {
        companyId: input.companyId,
        purchaseOrderId: input.purchaseOrderId,
        goodsReceiptId: input.goodsReceiptId,
        totalLanded: extras + totalValue,
        allocationJson: allocation,
        createdById: input.createdById,
      },
    });
  }

  simulateCostImpact(
    currentCost: number,
    salePrice: number,
    purchaseChangePct: number,
  ) {
    const newCost = currentCost * (1 + purchaseChangePct / 100);
    const marginBefore = salePrice - currentCost;
    const marginAfter = salePrice - newCost;
    return {
      currentCost,
      newCost,
      salePrice,
      marginBefore,
      marginAfter,
      marginPctBefore: salePrice ? (marginBefore / salePrice) * 100 : 0,
      marginPctAfter: salePrice ? (marginAfter / salePrice) * 100 : 0,
    };
  }

  async bulkImportItems(
    companyId: string,
    rows: Array<{
      name: string;
      unitCode: string;
      sku?: string;
      barcode?: string;
      categoryCode?: string;
      cost?: number;
      salePrice?: number;
      taxRate?: number;
      minStock?: number;
    }>,
  ) {
    this.tenant.setCompanyId(companyId);
    const errors: Array<{ row: number; message: string }> = [];
    const created: Array<{ id: string; name: string }> = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const unit = await this.prisma.unit.findFirst({
          where: { companyId, code: r.unitCode },
        });
        if (!unit) throw new Error(`Unknown unit ${r.unitCode}`);
        if (r.barcode) {
          const dup = await this.prisma.item.findFirst({
            where: { companyId, barcodeKey: r.barcode },
          });
          if (dup) throw new Error(`Duplicate barcode ${r.barcode}`);
        }
        let categoryId: string | undefined;
        if (r.categoryCode) {
          const cat = await this.prisma.itemCategory.findFirst({
            where: { companyId, codeKey: r.categoryCode },
          });
          if (!cat) throw new Error(`Unknown category ${r.categoryCode}`);
          categoryId = cat.id;
        }
        const item = await this.inventory.createItem({
          companyId,
          unitId: unit.id,
          name: r.name,
          sku: r.sku,
          barcode: r.barcode,
          itemCategoryId: categoryId,
          cost: r.cost,
          salePrice: r.salePrice,
          taxRate: r.taxRate,
          minStock: r.minStock,
        });
        created.push({ id: item.id, name: item.name });
      } catch (e) {
        errors.push({
          row: i + 1,
          message: e instanceof Error ? e.message : 'error',
        });
      }
    }
    return { created: created.length, errors };
  }

  async intelligenceAlerts(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const items = await this.prisma.item.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: { balances: true, category: true },
    });
    const lowStock: Array<{
      itemId: string;
      name: string;
      onHand: number;
      minStock: number;
      suggestedQty: number;
    }> = [];
    const slowMoving: Array<{
      itemId: string;
      name: string;
      onHand: number;
      frozenValue: number;
      daysWithoutSale: number;
    }> = [];
    for (const item of items) {
      const onHand = item.balances.reduce(
        (s, b) => s + Number(b.quantityOnHand),
        0,
      );
      if (onHand <= Number(item.minStock)) {
        lowStock.push({
          itemId: item.id,
          name: item.name,
          onHand,
          minStock: Number(item.minStock),
          suggestedQty: Number(item.reorderQty) || Number(item.minStock),
        });
      }
      const days = item.slowMovingDays ?? 90;
      const lastMove = await this.prisma.stockMovement.findFirst({
        where: { companyId, itemId: item.id, movementType: 'SALE_ISSUE' },
        orderBy: { occurredAt: 'desc' },
      });
      const cutoff = new Date(Date.now() - days * 86400000);
      if ((!lastMove || lastMove.occurredAt < cutoff) && onHand > 0) {
        slowMoving.push({
          itemId: item.id,
          name: item.name,
          onHand,
          frozenValue: onHand * Number(item.cost ?? 0),
          daysWithoutSale: days,
        });
      }
    }
    const soon = new Date();
    soon.setDate(soon.getDate() + 60);
    const expiring = await this.prisma.itemBatch.findMany({
      where: {
        companyId,
        expiresOn: { lte: soon, gte: new Date() },
      },
      include: { item: { select: { id: true, name: true } } },
      take: 100,
    });
    const topMoversRaw = await this.prisma.stockMovement.groupBy({
      by: ['itemId'],
      where: {
        companyId,
        movementType: 'SALE_ISSUE',
        occurredAt: { gte: new Date(Date.now() - 30 * 86400000) },
      },
      _sum: { quantity: true },
    });
    const topMovers = topMoversRaw
      .sort(
        (a, b) =>
          Number(b._sum.quantity ?? 0) - Number(a._sum.quantity ?? 0),
      )
      .slice(0, 20);
    return { lowStock, slowMoving, expiring, topMovers };
  }

  async ensureDefaultTemplates(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const labels = [
      {
        code: 'FLOWERS',
        name: 'Floral small',
        industryKey: 'flowers',
        widthMm: 40,
        heightMm: 30,
      },
      {
        code: 'BUILDING',
        name: 'Thermal durable',
        industryKey: 'building',
        widthMm: 70,
        heightMm: 50,
      },
      {
        code: 'RETAIL',
        name: 'Retail standard',
        industryKey: 'retail',
        widthMm: 50,
        heightMm: 30,
      },
    ];
    for (const l of labels) {
      await this.prisma.labelTemplate.upsert({
        where: { companyId_code: { companyId, code: l.code } },
        create: {
          companyId,
          ...l,
          layoutJson: {
            fields: ['name', 'nameAr', 'price', 'barcode', 'batch'],
          },
          isDefault: l.code === 'RETAIL',
        },
        update: {},
      });
    }
    const invoices = [
      { code: 'THERMAL', name: 'Thermal 80mm', layoutKind: 'VERTICAL' },
      { code: 'A4', name: 'A4 landscape B2B', layoutKind: 'LANDSCAPE' },
      { code: 'SQUARE', name: 'Square compact', layoutKind: 'SQUARE' },
    ];
    for (const t of invoices) {
      await this.prisma.invoicePrintTemplate.upsert({
        where: { companyId_code: { companyId, code: t.code } },
        create: {
          companyId,
          ...t,
          isDefault: t.code === 'THERMAL',
          bodyHtml: null,
        },
        update: {},
      });
    }
    return { ok: true };
  }

  listLabelTemplates(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.labelTemplate.findMany({ where: { companyId } });
  }

  listInvoiceTemplates(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.invoicePrintTemplate.findMany({ where: { companyId } });
  }

  renderLabel(companyId: string, itemId: string, templateCode?: string) {
    return this.buildLabelPayload(companyId, itemId, templateCode);
  }

  private async buildLabelPayload(
    companyId: string,
    itemId: string,
    templateCode?: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, companyId },
      include: { barcodes: { take: 1 }, batches: { take: 1 } },
    });
    if (!item) throw new NotFoundException('Item not found');
    const template = await this.prisma.labelTemplate.findFirst({
      where: {
        companyId,
        ...(templateCode ? { code: templateCode } : { isDefault: true }),
      },
    });
    return {
      template,
      label: {
        name: item.name,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        sku: item.sku,
        barcode: item.barcode ?? item.barcodes[0]?.barcode,
        price: item.salePrice,
        batch: item.batches[0]?.batchNumber,
        expiresOn: item.batches[0]?.expiresOn,
      },
    };
  }

  private async requireItem(companyId: string, itemId: string) {
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, companyId },
    });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  private cartesian<T>(arrays: T[][]): T[][] {
    return arrays.reduce<T[][]>(
      (acc, curr) =>
        acc.flatMap((a) => curr.map((c) => [...a, c] as T[])),
      [[]],
    );
  }

  private ean13FromSku(seed: string, salt: number) {
    let n = 0;
    const s = `${seed}${salt}`;
    for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
    const body = String(628000000000 + (n % 100000000)).slice(0, 12);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const d = Number(body[i]);
      sum += i % 2 === 0 ? d : d * 3;
    }
    const check = (10 - (sum % 10)) % 10;
    return `${body}${check}`;
  }
}

function unitLandedCostSafe(n: number) {
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}
