import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMethod,
  PurchaseDemandSource,
  PurchaseOrderStatus,
  PurchaseType,
  SupplierType,
} from '../../generated/prisma/client';
import { DocumentNumberService } from '../../common/documents/document-number.service';
import {
  computeLines,
  type LineInput,
} from '../../common/documents/line-totals';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { GlService } from '../finance/gl.service';

@Injectable()
export class PurchasingService {
  private readonly logger = new Logger(PurchasingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly docNumbers: DocumentNumberService,
    private readonly gl: GlService,
  ) {}

  listSuppliers(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.supplier.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
  }

  async createSupplier(input: {
    companyId: string;
    name: string;
    code?: string;
    taxNumber?: string;
    email?: string;
    phone?: string;
    notes?: string;
    supplierType?: SupplierType;
    currency?: string;
    paymentTermsDays?: number;
    country?: string;
    originCountry?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const code = input.code?.trim() || null;
    return this.prisma.supplier.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        code,
        codeKey: code ?? '',
        taxNumber: input.taxNumber,
        email: input.email,
        phone: input.phone,
        notes: input.notes,
        supplierType: input.supplierType ?? 'LOCAL',
        currency: input.currency ?? 'SAR',
        paymentTermsDays: input.paymentTermsDays ?? 0,
        country: input.country,
        originCountry: input.originCountry,
      },
    });
  }

  listPurchaseOrders(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.purchaseOrder.findMany({
      include: {
        supplier: { select: { id: true, name: true } },
        items: { orderBy: { position: 'asc' } },
      },
      orderBy: { orderedOn: 'desc' },
      take: 100,
    });
  }

  async createPurchaseOrder(input: {
    companyId: string;
    requestedById: string;
    supplierId: string;
    warehouseId?: string;
    orderedOn?: string;
    expectedOn?: string;
    currency?: string;
    purchaseType?: PurchaseType;
    demandSource?: PurchaseDemandSource;
    requisitionId?: string;
    freightAmount?: string | number;
    insuranceAmount?: string | number;
    customsAmount?: string | number;
    portFeesAmount?: string | number;
    customsDeclarationNumber?: string;
    originCountry?: string;
    status?: PurchaseOrderStatus;
    items: LineInput[];
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.requireSupplier(input.companyId, input.supplierId);
    if (input.warehouseId) {
      await this.requireWarehouse(input.companyId, input.warehouseId);
    }
    if (input.requisitionId) {
      await this.requireRequisition(input.companyId, input.requisitionId);
    }

    for (const item of input.items) {
      if (!item.itemId) {
        throw new BadRequestException('PO lines require itemId');
      }
      const catalogItem = await this.prisma.item.findFirst({
        where: { id: item.itemId, companyId: input.companyId },
      });
      if (!catalogItem) {
        throw new BadRequestException(`Item ${item.itemId} not found`);
      }
    }

    let computed;
    try {
      computed = computeLines(
        input.items.map((item) => ({
          ...item,
          unitPrice: item.unitCost ?? item.unitPrice,
        })),
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid line items',
      );
    }

    const purchaseType = input.purchaseType ?? 'LOCAL';
    const status = input.status ?? 'DRAFT';
    const inTransit = purchaseType === 'INTERNATIONAL' && status === 'ORDERED';

    return this.prisma.$transaction(async (tx) => {
      const orderNumber = await this.docNumbers.nextSequence(
        tx,
        input.companyId,
        'purchaseOrder',
      );
      return tx.purchaseOrder.create({
        data: {
          companyId: input.companyId,
          supplierId: input.supplierId,
          warehouseId: input.warehouseId,
          requisitionId: input.requisitionId,
          orderNumber,
          status,
          purchaseType,
          demandSource: input.demandSource ?? 'OTHER',
          orderedOn: input.orderedOn ? new Date(input.orderedOn) : undefined,
          expectedOn: input.expectedOn ? new Date(input.expectedOn) : undefined,
          currency: input.currency ?? 'SAR',
          subtotal: computed.subtotal,
          taxAmount: computed.taxAmount,
          totalAmount: computed.totalAmount,
          freightAmount: this.money(input.freightAmount),
          insuranceAmount: this.money(input.insuranceAmount),
          customsAmount: this.money(input.customsAmount),
          portFeesAmount: this.money(input.portFeesAmount),
          customsDeclarationNumber: input.customsDeclarationNumber,
          originCountry: input.originCountry,
          inTransit,
          requestedById: input.requestedById,
          items: {
            create: computed.lines.map((line) => ({
              itemId: line.itemId!,
              description: line.description,
              quantity: line.quantity,
              unitCost: line.unitPrice,
              taxAmount: line.taxAmount,
              totalAmount: line.totalAmount,
              position: line.position,
            })),
          },
        },
        include: { items: true, supplier: true },
      });
    });
  }

  async updatePurchaseOrderStatus(
    companyId: string,
    purchaseOrderId: string,
    status: PurchaseOrderStatus,
    approvedById?: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, companyId },
    });
    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }

    const inTransit =
      status === 'ORDERED' && po.purchaseType === 'INTERNATIONAL'
        ? true
        : undefined;

    return this.prisma.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        status,
        ...(status === 'APPROVED' && approvedById ? { approvedById } : {}),
        ...(inTransit !== undefined ? { inTransit } : {}),
      },
      include: { items: true },
    });
  }

  /** Receive PO into warehouse: GRN + stock movements + mark RECEIVED. */
  async receivePurchaseOrder(
    companyId: string,
    purchaseOrderId: string,
    createdById: string,
    warehouseId?: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, companyId },
      include: { items: true },
    });
    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }
    if (!['APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
      throw new BadRequestException(
        'PO must be APPROVED, ORDERED, or PARTIALLY_RECEIVED to receive',
      );
    }

    const targetWarehouseId = warehouseId ?? po.warehouseId;
    if (!targetWarehouseId) {
      throw new BadRequestException('Warehouse is required to receive stock');
    }
    await this.requireWarehouse(companyId, targetWarehouseId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const receiptNumber = await this.docNumbers.nextSequence(
        tx,
        companyId,
        'goodsReceipt',
      );
      const goodsReceipt = await tx.goodsReceipt.create({
        data: {
          companyId,
          purchaseOrderId: po.id,
          warehouseId: targetWarehouseId,
          receiptNumber,
          status: 'POSTED',
          receivedOn: new Date(),
          receivedById: createdById,
          notes: `PO ${po.orderNumber}`,
          items: {
            create: po.items.map((line, index) => ({
              purchaseOrderItemId: line.id,
              itemId: line.itemId,
              quantityOrdered: line.quantity,
              quantityReceived: line.quantity,
              unitCost: line.unitCost,
              position: index + 1,
            })),
          },
        },
        include: { items: true },
      });

      for (const line of po.items) {
        const qty = Number(line.quantity);
        await tx.stockMovement.create({
          data: {
            companyId,
            warehouseId: targetWarehouseId,
            itemId: line.itemId,
            movementType: 'PURCHASE_RECEIPT',
            quantity: qty.toFixed(3),
            unitCost: line.unitCost,
            referenceType: 'goods_receipt',
            referenceId: goodsReceipt.id,
            occurredAt: new Date(),
            createdById,
            notes: `GRN ${receiptNumber} / PO ${po.orderNumber}`,
          },
        });

        await tx.stockBalance.upsert({
          where: {
            warehouseId_itemId: {
              warehouseId: targetWarehouseId,
              itemId: line.itemId,
            },
          },
          create: {
            warehouseId: targetWarehouseId,
            itemId: line.itemId,
            quantityOnHand: qty.toFixed(3),
          },
          update: {
            quantityOnHand: {
              increment: qty,
            },
          },
        });
      }

      const purchaseOrder = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: 'RECEIVED',
          warehouseId: targetWarehouseId,
          inTransit: false,
        },
        include: { items: true, supplier: true },
      });

      return { purchaseOrder, goodsReceipt };
    });

    if (po.inTransit || po.purchaseType === 'INTERNATIONAL') {
      try {
        await this.gl.postGoodsReceiptFromTransit(companyId, createdById, {
          id: po.id,
          purchaseType: po.purchaseType,
          inTransit: po.inTransit,
          subtotal: po.subtotal,
          currency: po.currency,
          orderedOn: po.orderedOn,
        });
      } catch (error) {
        this.logger.warn(
          `GL goods receipt post failed for PO ${po.orderNumber}: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }

    return updated;
  }

  listGoodsReceipts(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.goodsReceipt.findMany({
      include: {
        purchaseOrder: {
          select: { id: true, orderNumber: true, supplierId: true },
        },
        warehouse: { select: { id: true, name: true } },
        items: { orderBy: { position: 'asc' } },
      },
      orderBy: { receivedOn: 'desc' },
      take: 100,
    });
  }

  listRequisitions(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.purchaseRequisition.findMany({
      include: {
        items: { orderBy: { position: 'asc' } },
        branch: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createRequisition(input: {
    companyId: string;
    requestedById: string;
    demandSource?: PurchaseDemandSource;
    companyBranchId?: string;
    notes?: string;
    neededBy?: string;
    items: Array<{
      itemId?: string;
      description: string;
      quantity: string | number;
      estimatedUnitCost?: string | number;
    }>;
  }) {
    this.tenant.setCompanyId(input.companyId);
    if (!input.items.length) {
      throw new BadRequestException('At least one requisition line is required');
    }

    for (const [index, line] of input.items.entries()) {
      if (!(Number(line.quantity) > 0)) {
        throw new BadRequestException(
          `Line ${index + 1}: quantity must be > 0`,
        );
      }
      if (line.itemId) {
        const item = await this.prisma.item.findFirst({
          where: { id: line.itemId, companyId: input.companyId },
        });
        if (!item) {
          throw new BadRequestException(`Item ${line.itemId} not found`);
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const requisitionNumber = await this.docNumbers.nextSequence(
        tx,
        input.companyId,
        'purchaseRequisition',
      );
      return tx.purchaseRequisition.create({
        data: {
          companyId: input.companyId,
          requisitionNumber,
          demandSource: input.demandSource ?? 'BRANCH_REQUISITION',
          companyBranchId: input.companyBranchId,
          requestedById: input.requestedById,
          notes: input.notes,
          neededBy: input.neededBy ? new Date(input.neededBy) : undefined,
          items: {
            create: input.items.map((line, index) => ({
              itemId: line.itemId,
              description: line.description,
              quantity: Number(line.quantity).toFixed(3),
              estimatedUnitCost:
                line.estimatedUnitCost !== undefined
                  ? Number(line.estimatedUnitCost).toFixed(2)
                  : undefined,
              position: index + 1,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  async submitRequisition(companyId: string, requisitionId: string) {
    this.tenant.setCompanyId(companyId);
    const req = await this.requireRequisition(companyId, requisitionId);
    if (req.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT requisitions can be submitted');
    }
    return this.prisma.purchaseRequisition.update({
      where: { id: requisitionId },
      data: { status: 'SUBMITTED' },
      include: { items: true },
    });
  }

  async approveRequisition(
    companyId: string,
    requisitionId: string,
    approvedById: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const req = await this.requireRequisition(companyId, requisitionId);
    if (!['DRAFT', 'SUBMITTED'].includes(req.status)) {
      throw new BadRequestException(
        'Only DRAFT or SUBMITTED requisitions can be approved',
      );
    }
    return this.prisma.purchaseRequisition.update({
      where: { id: requisitionId },
      data: { status: 'APPROVED', approvedById },
      include: { items: true },
    });
  }

  async listReorderSuggestions(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const items = await this.prisma.item.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: {
        balances: { select: { quantityOnHand: true } },
        preferredSupplier: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, code: true } },
      },
      orderBy: { name: 'asc' },
    });

    return items
      .map((item) => {
        const onHand = item.balances.reduce(
          (sum, b) => sum + Number(b.quantityOnHand),
          0,
        );
        const minStock = Number(item.minStock);
        return {
          itemId: item.id,
          name: item.name,
          sku: item.sku,
          onHand: onHand.toFixed(3),
          minStock: item.minStock,
          reorderQty: item.reorderQty,
          supplySource: item.supplySource,
          preferredSupplier: item.preferredSupplier,
          unit: item.unit,
          shortfall: Math.max(0, minStock - onHand).toFixed(3),
        };
      })
      .filter((row) => Number(row.onHand) <= Number(row.minStock));
  }

  async createRequisitionFromReorder(input: {
    companyId: string;
    requestedById: string;
    companyBranchId?: string;
    notes?: string;
  }) {
    const suggestions = await this.listReorderSuggestions(input.companyId);
    if (!suggestions.length) {
      throw new BadRequestException('No reorder suggestions available');
    }

    return this.createRequisition({
      companyId: input.companyId,
      requestedById: input.requestedById,
      demandSource: 'REORDER_POINT',
      companyBranchId: input.companyBranchId,
      notes: input.notes ?? 'Auto-generated from reorder suggestions',
      items: suggestions.map((s) => ({
        itemId: s.itemId,
        description: s.name,
        quantity:
          Number(s.reorderQty) > 0
            ? Number(s.reorderQty)
            : Math.max(Number(s.shortfall), 1),
      })),
    });
  }

  listBills(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.supplierBill.findMany({
      include: {
        supplier: { select: { id: true, name: true } },
        items: { orderBy: { position: 'asc' } },
        payments: true,
      },
      orderBy: { issuedOn: 'desc' },
      take: 100,
    });
  }

  async createBill(input: {
    companyId: string;
    supplierId: string;
    billNumber: string;
    issuedOn: string;
    dueOn?: string;
    currency?: string;
    purchaseOrderId?: string;
    goodsReceiptId?: string;
    items: LineInput[];
    status?: 'DRAFT' | 'ISSUED';
    createdById?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const supplier = await this.requireSupplier(
      input.companyId,
      input.supplierId,
    );

    let computed;
    try {
      computed = computeLines(
        input.items.map((item) => ({
          ...item,
          unitPrice: item.unitCost ?? item.unitPrice,
        })),
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid line items',
      );
    }

    let purchaseOrderId = input.purchaseOrderId;
    let goodsReceipt: {
      id: string;
      purchaseOrderId: string;
      items: Array<{ quantityReceived: unknown; unitCost: unknown }>;
    } | null = null;

    if (input.goodsReceiptId) {
      goodsReceipt = await this.prisma.goodsReceipt.findFirst({
        where: { id: input.goodsReceiptId, companyId: input.companyId },
        include: { items: true },
      });
      if (!goodsReceipt) {
        throw new NotFoundException('Goods receipt not found');
      }
      if (purchaseOrderId && purchaseOrderId !== goodsReceipt.purchaseOrderId) {
        throw new BadRequestException(
          'Goods receipt is not linked to the provided purchase order',
        );
      }
      purchaseOrderId = goodsReceipt.purchaseOrderId;
    }

    let purchaseOrder: {
      id: string;
      totalAmount: unknown;
      freightAmount: unknown;
      insuranceAmount: unknown;
      customsAmount: unknown;
      portFeesAmount: unknown;
    } | null = null;
    if (purchaseOrderId) {
      purchaseOrder = await this.prisma.purchaseOrder.findFirst({
        where: { id: purchaseOrderId, companyId: input.companyId },
      });
      if (!purchaseOrder) {
        throw new NotFoundException('Purchase order not found');
      }
    }

    const threeWayMatched = this.evaluateThreeWayMatch({
      billTotal: computed.totalAmount,
      purchaseOrder,
      goodsReceipt,
    });

    const status = input.status ?? 'DRAFT';
    const bill = await this.prisma.supplierBill.create({
      data: {
        companyId: input.companyId,
        supplierId: input.supplierId,
        purchaseOrderId,
        goodsReceiptId: input.goodsReceiptId,
        threeWayMatched,
        billNumber: input.billNumber,
        status,
        issuedOn: new Date(input.issuedOn),
        dueOn: input.dueOn ? new Date(input.dueOn) : undefined,
        currency: input.currency ?? 'SAR',
        subtotal: computed.subtotal,
        taxAmount: computed.taxAmount,
        totalAmount: computed.totalAmount,
        balanceDue: computed.totalAmount,
        items: {
          create: computed.lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitCost: line.unitPrice,
            taxAmount: line.taxAmount,
            totalAmount: line.totalAmount,
            position: line.position,
            itemId: line.itemId,
          })),
        },
      },
      include: { items: true, supplier: true },
    });

    if (status === 'ISSUED') {
      try {
        await this.gl.ensureChartOfAccounts(input.companyId);
        await this.gl.postPurchaseBill(
          input.companyId,
          input.createdById ?? 'system',
          {
            id: bill.id,
            subtotal: bill.subtotal,
            taxAmount: bill.taxAmount,
            totalAmount: bill.totalAmount,
            currency: bill.currency,
            issuedOn: bill.issuedOn,
            freightAmount: String(purchaseOrder?.freightAmount ?? 0),
            insuranceAmount: String(purchaseOrder?.insuranceAmount ?? 0),
            customsAmount: String(purchaseOrder?.customsAmount ?? 0),
            portFeesAmount: String(purchaseOrder?.portFeesAmount ?? 0),
          },
          supplier.supplierType,
        );
      } catch (error) {
        this.logger.warn(
          `GL purchase bill post failed for ${bill.billNumber}: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }

    return bill;
  }

  async recordPayment(input: {
    companyId: string;
    supplierBillId: string;
    amount: string | number;
    method: PaymentMethod;
    paidAt?: string;
    bankAccountId?: string;
    externalReference?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const amount = Number(input.amount);
    if (!(amount > 0)) {
      throw new BadRequestException('Payment amount must be > 0');
    }

    return this.prisma.$transaction(async (tx) => {
      const bill = await tx.supplierBill.findFirst({
        where: { id: input.supplierBillId, companyId: input.companyId },
      });
      if (!bill) {
        throw new NotFoundException('Supplier bill not found');
      }
      if (['CANCELLED', 'DRAFT'].includes(bill.status)) {
        throw new BadRequestException('Cannot pay a draft or cancelled bill');
      }

      const balance = Number(bill.balanceDue);
      if (amount > balance + 0.001) {
        throw new BadRequestException('Payment exceeds balance due');
      }

      const paymentNumber = await this.docNumbers.nextSequence(
        tx,
        input.companyId,
        'supplierPayment',
      );
      const payment = await tx.supplierPayment.create({
        data: {
          companyId: input.companyId,
          supplierBillId: bill.id,
          bankAccountId: input.bankAccountId,
          paymentNumber,
          method: input.method,
          amount: amount.toFixed(2),
          currency: bill.currency,
          paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
          externalReference: input.externalReference,
        },
      });

      const newBalance = Number((balance - amount).toFixed(2));
      const status =
        newBalance <= 0
          ? 'PAID'
          : newBalance < Number(bill.totalAmount)
            ? 'PARTIALLY_PAID'
            : bill.status;

      await tx.supplierBill.update({
        where: { id: bill.id },
        data: {
          balanceDue: newBalance.toFixed(2),
          status,
        },
      });

      await tx.financialTransaction.create({
        data: {
          companyId: input.companyId,
          transactionType: 'PAYMENT',
          direction: 'OUTFLOW',
          amount: amount.toFixed(2),
          currency: bill.currency,
          occurredAt: payment.paidAt,
          supplierBillId: bill.id,
          description: `Payment ${paymentNumber} for bill ${bill.billNumber}`,
        },
      });

      return payment;
    });
  }

  /** PO exists, GR linked to same PO, bill total within 1% of PO or GR. */
  private evaluateThreeWayMatch(input: {
    billTotal: string;
    purchaseOrder: { id: string; totalAmount: unknown } | null;
    goodsReceipt: {
      id: string;
      purchaseOrderId: string;
      items: Array<{ quantityReceived: unknown; unitCost: unknown }>;
    } | null;
  }): boolean {
    if (!input.purchaseOrder || !input.goodsReceipt) {
      return false;
    }
    if (input.goodsReceipt.purchaseOrderId !== input.purchaseOrder.id) {
      return false;
    }

    const billTotal = Number(input.billTotal);
    const poTotal = Number(input.purchaseOrder.totalAmount);
    const grTotal = input.goodsReceipt.items.reduce(
      (sum, line) =>
        sum + Number(line.quantityReceived) * Number(line.unitCost),
      0,
    );

    const withinOnePercent = (a: number, b: number) => {
      if (!(a > 0) || !(b > 0)) return Math.abs(a - b) < 0.01;
      return Math.abs(a - b) / Math.max(a, b) <= 0.01;
    };

    return (
      withinOnePercent(billTotal, poTotal) ||
      withinOnePercent(billTotal, grTotal)
    );
  }

  private money(value?: string | number): string {
    return Number(value ?? 0).toFixed(2);
  }

  private async requireSupplier(companyId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, companyId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    return supplier;
  }

  private async requireWarehouse(companyId: string, warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId },
    });
    if (!warehouse) {
      throw new BadRequestException('Warehouse not found');
    }
    return warehouse;
  }

  private async requireRequisition(companyId: string, requisitionId: string) {
    const requisition = await this.prisma.purchaseRequisition.findFirst({
      where: { id: requisitionId, companyId },
    });
    if (!requisition) {
      throw new NotFoundException('Purchase requisition not found');
    }
    return requisition;
  }
}
