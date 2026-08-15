import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMethod,
  PurchaseOrderStatus,
} from '../../generated/prisma/client';
import { DocumentNumberService } from '../../common/documents/document-number.service';
import {
  computeLines,
  type LineInput,
} from '../../common/documents/line-totals';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PurchasingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly docNumbers: DocumentNumberService,
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
    items: LineInput[];
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.requireSupplier(input.companyId, input.supplierId);
    if (input.warehouseId) {
      await this.requireWarehouse(input.companyId, input.warehouseId);
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
          orderNumber,
          orderedOn: input.orderedOn ? new Date(input.orderedOn) : undefined,
          expectedOn: input.expectedOn ? new Date(input.expectedOn) : undefined,
          currency: input.currency ?? 'SAR',
          subtotal: computed.subtotal,
          taxAmount: computed.taxAmount,
          totalAmount: computed.totalAmount,
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

    return this.prisma.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        status,
        ...(status === 'APPROVED' && approvedById ? { approvedById } : {}),
      },
      include: { items: true },
    });
  }

  /** Receive PO into warehouse: stock movements + mark RECEIVED. */
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

    return this.prisma.$transaction(async (tx) => {
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
            referenceType: 'purchase_order',
            referenceId: po.id,
            occurredAt: new Date(),
            createdById,
            notes: `PO ${po.orderNumber}`,
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

      return tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: 'RECEIVED',
          warehouseId: targetWarehouseId,
        },
        include: { items: true, supplier: true },
      });
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
    items: LineInput[];
    status?: 'DRAFT' | 'ISSUED';
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.requireSupplier(input.companyId, input.supplierId);

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

    const status = input.status ?? 'DRAFT';
    return this.prisma.supplierBill.create({
      data: {
        companyId: input.companyId,
        supplierId: input.supplierId,
        purchaseOrderId: input.purchaseOrderId,
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
}
