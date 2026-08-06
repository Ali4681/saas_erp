import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';

export type ReportFilters = {
  from?: string;
  to?: string;
  branchId?: string;
  employeeId?: string;
  customerId?: string;
  productId?: string;
  status?: string;
  limit?: number;
};

export type ReportModule =
  | 'customers'
  | 'crm'
  | 'sales'
  | 'purchases'
  | 'purchasing'
  | 'inventory'
  | 'hr'
  | 'projects'
  | 'work'
  | 'notes'
  | 'notebook'
  | 'automation';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async executiveDashboard(companyId: string, filters: ReportFilters = {}) {
    this.tenant.setCompanyId(companyId);
    const f = this.normalizeFilters(filters);
    const invoiceWhere = await this.invoiceWhere(companyId, f);
    const top = f.limit;

    const [
      customerCount,
      invoiceAgg,
      unpaidInvoices,
      expenseAgg,
      lineRows,
      inventoryBalances,
      projectGroups,
      branches,
    ] = await Promise.all([
      this.prisma.crmContact.count({
        where: {
          ...(f.customerId ? { id: f.customerId } : {}),
          ...(f.status
            ? { status: f.status as never }
            : { status: 'ACTIVE' }),
          contactType: 'CUSTOMER',
        },
      }),
      this.prisma.salesInvoice.aggregate({
        where: invoiceWhere,
        _sum: { totalAmount: true, balanceDue: true },
        _count: true,
      }),
      this.prisma.salesInvoice.count({
        where: {
          ...invoiceWhere,
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
          balanceDue: { gt: 0 },
        },
      }),
      this.prisma.expense.aggregate({
        where: {
          companyId,
          status: { in: ['APPROVED', 'PAID'] },
          ...(f.date('expenseDate')
            ? { expenseDate: f.date('expenseDate') }
            : {}),
          ...(f.status ? { status: f.status as never } : {}),
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.salesInvoiceItem.findMany({
        where: {
          invoice: invoiceWhere,
          itemId: f.productId ?? { not: null },
        },
        select: {
          itemId: true,
          quantity: true,
          totalAmount: true,
          unitPrice: true,
          item: { select: { id: true, name: true, sku: true, cost: true } },
          invoice: {
            select: {
              createdById: true,
              companyBranchId: true,
              totalAmount: true,
            },
          },
        },
        take: 5000,
      }),
      this.prisma.stockBalance.findMany({
        where: {
          warehouse: {
            companyId,
            ...(f.branchId ? { companyBranchId: f.branchId } : {}),
          },
          ...(f.productId ? { itemId: f.productId } : {}),
        },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              sku: true,
              minStock: true,
              cost: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              code: true,
              name: true,
              companyBranchId: true,
            },
          },
        },
        take: 2000,
      }),
      this.prisma.workProject.groupBy({
        by: ['status'],
        where: {
          ...(f.status ? { status: f.status as never } : {}),
          ...(f.date('createdAt') ? { createdAt: f.date('createdAt') } : {}),
        },
        _count: true,
      }),
      this.prisma.companyBranch.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, code: true, name: true },
      }),
    ]);

    let grossSales = 0;
    const productMap = new Map<
      string,
      {
        itemId: string;
        name: string;
        sku: string | null;
        quantity: number;
        revenue: number;
        profit: number;
      }
    >();
    const employeeSales = new Map<string, number>();
    const branchSales = new Map<string, number>();

    for (const line of lineRows) {
      const qty = Number(line.quantity);
      const revenue = Number(line.totalAmount);
      const cost = Number(line.item?.cost ?? 0);
      const profit = revenue - cost * qty;
      grossSales += revenue;

      if (line.itemId && line.item) {
        const cur = productMap.get(line.itemId) ?? {
          itemId: line.itemId,
          name: line.item.name,
          sku: line.item.sku,
          quantity: 0,
          revenue: 0,
          profit: 0,
        };
        cur.quantity += qty;
        cur.revenue += revenue;
        cur.profit += profit;
        productMap.set(line.itemId, cur);
      }

      if (line.invoice.createdById) {
        employeeSales.set(
          line.invoice.createdById,
          (employeeSales.get(line.invoice.createdById) ?? 0) + revenue,
        );
      }
      if (line.invoice.companyBranchId) {
        branchSales.set(
          line.invoice.companyBranchId,
          (branchSales.get(line.invoice.companyBranchId) ?? 0) + revenue,
        );
      }
    }

    // Prefer invoice header totals when line scan is filtered by product
    const totalSales = f.productId
      ? grossSales
      : Number(invoiceAgg._sum.totalAmount ?? 0);

    // Gross margin from costed lines; if none, fall back to sales − expenses.
    // Always scope via invoiceWhere.companyId so empty tenants stay at 0.
    let profitAmount: number;
    if (productMap.size > 0) {
      profitAmount = Array.from(productMap.values()).reduce(
        (s, p) => s + p.profit,
        0,
      );
    } else {
      profitAmount = totalSales - Number(expenseAgg._sum.amount ?? 0);
    }

    const bestProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, top)
      .map((p) => ({
        ...p,
        quantity: p.quantity.toFixed(3),
        revenue: p.revenue.toFixed(2),
        profit: p.profit.toFixed(2),
      }));

    const creatorIds = [...employeeSales.keys()];
    const employees = creatorIds.length
      ? await this.prisma.employee.findMany({
          where: {
            userId: { in: creatorIds },
            ...(f.employeeId ? { id: f.employeeId } : {}),
            ...(f.branchId ? { companyBranchId: f.branchId } : {}),
          },
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
            userId: true,
            companyBranchId: true,
          },
        })
      : [];
    const empByUser = new Map(
      employees.filter((e) => e.userId).map((e) => [e.userId!, e]),
    );
    const bestEmployees = [...employeeSales.entries()]
      .map(([userId, revenue]) => {
        const emp = empByUser.get(userId);
        return {
          userId,
          employeeId: emp?.id ?? null,
          name: emp?.fullName ?? userId,
          employeeNumber: emp?.employeeNumber ?? null,
          revenue: revenue.toFixed(2),
        };
      })
      .sort((a, b) => Number(b.revenue) - Number(a.revenue))
      .slice(0, top);

    const branchName = new Map(branches.map((b) => [b.id, b]));
    const bestBranches = [...branchSales.entries()]
      .map(([branchId, revenue]) => ({
        branchId,
        code: branchName.get(branchId)?.code ?? null,
        name: branchName.get(branchId)?.name ?? branchId,
        revenue: revenue.toFixed(2),
      }))
      .sort((a, b) => Number(b.revenue) - Number(a.revenue))
      .slice(0, top);

    let ok = 0;
    let low = 0;
    let out = 0;
    let stockValue = 0;
    const lowStockItems: Array<{
      itemId: string;
      name: string;
      sku: string | null;
      warehouse: string;
      onHand: string;
      minStock: string;
    }> = [];
    for (const row of inventoryBalances) {
      const onHand = Number(row.quantityOnHand);
      const min = Number(row.item.minStock);
      const cost = Number(row.item.cost ?? 0);
      stockValue += onHand * cost;
      if (onHand <= 0) out += 1;
      else if (onHand <= min) {
        low += 1;
        if (lowStockItems.length < top) {
          lowStockItems.push({
            itemId: row.item.id,
            name: row.item.name,
            sku: row.item.sku,
            warehouse: row.warehouse.code,
            onHand: row.quantityOnHand.toString(),
            minStock: row.item.minStock.toString(),
          });
        }
      } else ok += 1;
    }

    return {
      currency: 'SAR',
      filters: this.publicFilters(f),
      kpis: {
        totalSales: totalSales.toFixed(2),
        totalProfit: profitAmount.toFixed(2),
        totalExpenses: expenseAgg._sum.amount?.toString() ?? '0.00',
        customerCount,
        invoiceCount: invoiceAgg._count,
        unpaidInvoiceCount: unpaidInvoices,
        balanceDue: invoiceAgg._sum.balanceDue?.toString() ?? '0.00',
      },
      bestProducts,
      bestEmployees,
      bestBranches,
      inventoryStatus: {
        ok,
        low,
        outOfStock: out,
        stockValue: stockValue.toFixed(2),
        lowStockItems,
      },
      projectStatus: {
        byStatus: Object.fromEntries(
          projectGroups.map((row) => [row.status, row._count]),
        ),
        total: projectGroups.reduce((s, r) => s + r._count, 0),
      },
    };
  }

  async operationalReport(
    companyId: string,
    module: ReportModule,
    filters: ReportFilters = {},
  ) {
    this.tenant.setCompanyId(companyId);
    const f = this.normalizeFilters(filters);
    const resolved = this.resolveModule(module);
    const top = f.limit;

    switch (resolved) {
      case 'customers': {
        const where: Prisma.CrmContactWhereInput = {
          ...(f.customerId ? { id: f.customerId } : {}),
          ...(f.status ? { status: f.status as never } : {}),
          ...(f.date('createdAt') ? { createdAt: f.date('createdAt') } : {}),
        };
        const [byType, byStatus, rows] = await Promise.all([
          this.prisma.crmContact.groupBy({
            by: ['contactType'],
            where,
            _count: true,
          }),
          this.prisma.crmContact.groupBy({
            by: ['status'],
            where,
            _count: true,
          }),
          this.prisma.crmContact.findMany({
            where,
            select: {
              id: true,
              name: true,
              contactType: true,
              status: true,
              email: true,
              phone: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: top,
          }),
        ]);
        return {
          module: 'customers',
          filters: this.publicFilters(f),
          contactsByType: byType,
          contactsByStatus: byStatus,
          rows,
        };
      }
      case 'sales': {
        const invoiceWhere = await this.invoiceWhere(companyId, f);
        const [byStatus, rows, quoteByStatus] = await Promise.all([
          this.prisma.salesInvoice.groupBy({
            by: ['status'],
            where: invoiceWhere,
            _count: true,
            _sum: { totalAmount: true, balanceDue: true },
          }),
          this.prisma.salesInvoice.findMany({
            where: invoiceWhere,
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              issuedOn: true,
              totalAmount: true,
              balanceDue: true,
              contactId: true,
              companyBranchId: true,
              createdById: true,
              contact: { select: { id: true, name: true } },
            },
            orderBy: { issuedOn: 'desc' },
            take: top,
          }),
          this.prisma.salesQuote.groupBy({
            by: ['status'],
            where: {
              ...(f.customerId ? { contactId: f.customerId } : {}),
              ...(f.status ? { status: f.status as never } : {}),
              ...(f.date('issuedOn') ? { issuedOn: f.date('issuedOn') } : {}),
              ...(f.employeeId
                ? {
                    createdById: await this.userIdForEmployee(
                      companyId,
                      f.employeeId,
                    ),
                  }
                : {}),
            },
            _count: true,
            _sum: { totalAmount: true },
          }),
        ]);
        return {
          module: 'sales',
          filters: this.publicFilters(f),
          invoicesByStatus: this.serializeGroupMoney(byStatus, [
            'totalAmount',
            'balanceDue',
          ]),
          quotesByStatus: this.serializeGroupMoney(quoteByStatus, [
            'totalAmount',
          ]),
          rows: rows.map((r) => ({
            ...r,
            totalAmount: r.totalAmount.toString(),
            balanceDue: r.balanceDue.toString(),
          })),
        };
      }
      case 'purchasing': {
        const poWhere: Prisma.PurchaseOrderWhereInput = {
          ...(f.status ? { status: f.status as never } : {}),
          ...(f.date('orderedOn') ? { orderedOn: f.date('orderedOn') } : {}),
          ...(f.employeeId
            ? {
                requestedById: await this.userIdForEmployee(
                  companyId,
                  f.employeeId,
                ),
              }
            : {}),
        };
        const billWhere: Prisma.SupplierBillWhereInput = {
          ...(f.status ? { status: f.status as never } : {}),
          ...(f.date('issuedOn') ? { issuedOn: f.date('issuedOn') } : {}),
        };
        const [ordersByStatus, billsByStatus, orders, bills] =
          await Promise.all([
            this.prisma.purchaseOrder.groupBy({
              by: ['status'],
              where: poWhere,
              _count: true,
              _sum: { totalAmount: true },
            }),
            this.prisma.supplierBill.groupBy({
              by: ['status'],
              where: billWhere,
              _count: true,
              _sum: { totalAmount: true, balanceDue: true },
            }),
            this.prisma.purchaseOrder.findMany({
              where: poWhere,
              select: {
                id: true,
                orderNumber: true,
                status: true,
                orderedOn: true,
                totalAmount: true,
                supplierId: true,
              },
              orderBy: { orderedOn: 'desc' },
              take: top,
            }),
            this.prisma.supplierBill.findMany({
              where: billWhere,
              select: {
                id: true,
                billNumber: true,
                status: true,
                issuedOn: true,
                totalAmount: true,
                balanceDue: true,
                supplierId: true,
              },
              orderBy: { issuedOn: 'desc' },
              take: top,
            }),
          ]);
        return {
          module: 'purchases',
          filters: this.publicFilters(f),
          ordersByStatus: this.serializeGroupMoney(ordersByStatus, [
            'totalAmount',
          ]),
          billsByStatus: this.serializeGroupMoney(billsByStatus, [
            'totalAmount',
            'balanceDue',
          ]),
          purchaseOrders: orders.map((o) => ({
            ...o,
            totalAmount: o.totalAmount.toString(),
          })),
          bills: bills.map((b) => ({
            ...b,
            totalAmount: b.totalAmount.toString(),
            balanceDue: b.balanceDue.toString(),
          })),
        };
      }
      case 'inventory': {
        const balWhere: Prisma.StockBalanceWhereInput = {
          warehouse: {
            companyId,
            ...(f.branchId ? { companyBranchId: f.branchId } : {}),
          },
          ...(f.productId ? { itemId: f.productId } : {}),
        };
        const [movementsByType, balances, itemCount] = await Promise.all([
          this.prisma.stockMovement.groupBy({
            by: ['movementType'],
            where: {
              ...(f.productId ? { itemId: f.productId } : {}),
              ...(f.date('occurredAt')
                ? { occurredAt: f.date('occurredAt') }
                : {}),
              ...(f.branchId
                ? { warehouse: { companyBranchId: f.branchId } }
                : {}),
              ...(f.status ? { movementType: f.status as never } : {}),
            },
            _count: true,
          }),
          this.prisma.stockBalance.findMany({
            where: balWhere,
            include: {
              item: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  minStock: true,
                  cost: true,
                  status: true,
                },
              },
              warehouse: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  companyBranchId: true,
                },
              },
            },
            take: top,
          }),
          this.prisma.item.count({
            where: {
              status: f.status ? (f.status as never) : 'ACTIVE',
              ...(f.productId ? { id: f.productId } : {}),
            },
          }),
        ]);
        return {
          module: 'inventory',
          filters: this.publicFilters(f),
          itemCount,
          movementsByType,
          balances: balances.map((b) => ({
            itemId: b.item.id,
            name: b.item.name,
            sku: b.item.sku,
            warehouse: b.warehouse.code,
            branchId: b.warehouse.companyBranchId,
            onHand: b.quantityOnHand.toString(),
            minStock: b.item.minStock.toString(),
            value: (
              Number(b.quantityOnHand) * Number(b.item.cost ?? 0)
            ).toFixed(2),
            status:
              Number(b.quantityOnHand) <= 0
                ? 'OUT'
                : Number(b.quantityOnHand) <= Number(b.item.minStock)
                  ? 'LOW'
                  : 'OK',
          })),
        };
      }
      case 'hr': {
        const empWhere: Prisma.EmployeeWhereInput = {
          ...(f.employeeId ? { id: f.employeeId } : {}),
          ...(f.branchId ? { companyBranchId: f.branchId } : {}),
          ...(f.status ? { employmentStatus: f.status as never } : {}),
        };
        const [employeesByStatus, leavesByStatus, employees, leaves] =
          await Promise.all([
            this.prisma.employee.groupBy({
              by: ['employmentStatus'],
              where: empWhere,
              _count: true,
            }),
            this.prisma.leaveRequest.groupBy({
              by: ['status'],
              where: {
                ...(f.employeeId ? { employeeId: f.employeeId } : {}),
                ...(f.status ? { status: f.status as never } : {}),
                ...(f.date('startsOn')
                  ? { startsOn: f.date('startsOn') }
                  : {}),
              },
              _count: true,
            }),
            this.prisma.employee.findMany({
              where: empWhere,
              select: {
                id: true,
                employeeNumber: true,
                fullName: true,
                jobTitle: true,
                employmentStatus: true,
                companyBranchId: true,
                basicSalary: true,
              },
              take: top,
              orderBy: { fullName: 'asc' },
            }),
            this.prisma.leaveRequest.findMany({
              where: {
                ...(f.employeeId ? { employeeId: f.employeeId } : {}),
                ...(f.status ? { status: f.status as never } : {}),
              },
              select: {
                id: true,
                employeeId: true,
                leaveType: true,
                status: true,
                startsOn: true,
                endsOn: true,
              },
              orderBy: { startsOn: 'desc' },
              take: top,
            }),
          ]);
        return {
          module: 'hr',
          filters: this.publicFilters(f),
          employeesByStatus,
          leavesByStatus,
          employees: employees.map((e) => ({
            ...e,
            basicSalary: e.basicSalary?.toString() ?? null,
          })),
          leaves,
        };
      }
      case 'work': {
        const projectWhere: Prisma.WorkProjectWhereInput = {
          ...(f.status ? { status: f.status as never } : {}),
          ...(f.date('createdAt') ? { createdAt: f.date('createdAt') } : {}),
          ...(f.employeeId
            ? {
                ownerUserId: await this.userIdForEmployee(
                  companyId,
                  f.employeeId,
                ),
              }
            : {}),
        };
        const [projectsByStatus, tasksByStatus, projects] = await Promise.all([
          this.prisma.workProject.groupBy({
            by: ['status'],
            where: projectWhere,
            _count: true,
          }),
          this.prisma.workTask.groupBy({
            by: ['status'],
            where: {
              workProject: { companyId, ...projectWhere },
              ...(f.status ? { status: f.status as never } : {}),
            },
            _count: true,
          }),
          this.prisma.workProject.findMany({
            where: projectWhere,
            select: {
              id: true,
              name: true,
              code: true,
              status: true,
              startsOn: true,
              endsOn: true,
              ownerUserId: true,
              progressPercent: true,
            },
            orderBy: { createdAt: 'desc' },
            take: top,
          }),
        ]);
        return {
          module: 'projects',
          filters: this.publicFilters(f),
          projectsByStatus,
          tasksByStatus,
          projects: projects.map((p) => ({
            ...p,
            progressPercent: p.progressPercent.toString(),
          })),
        };
      }
      case 'notebook': {
        const noteWhere: Prisma.BusinessNoteWhereInput = {
          ...(f.status ? { status: f.status as never } : {}),
          ...(f.employeeId ? { employeeId: f.employeeId } : {}),
          ...(f.date('createdAt') ? { createdAt: f.date('createdAt') } : {}),
        };
        const [notesByStatus, notesByPriority, notes] = await Promise.all([
          this.prisma.businessNote.groupBy({
            by: ['status'],
            where: noteWhere,
            _count: true,
          }),
          this.prisma.businessNote.groupBy({
            by: ['priority'],
            where: noteWhere,
            _count: true,
          }),
          this.prisma.businessNote.findMany({
            where: noteWhere,
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              employeeId: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: top,
          }),
        ]);
        return {
          module: 'notes',
          filters: this.publicFilters(f),
          notesByStatus,
          notesByPriority,
          notes,
        };
      }
      case 'automation': {
        const ruleWhere: Prisma.AutomationRuleWhereInput = {
          ...(f.status ? { status: f.status as never } : {}),
        };
        const [rulesByStatus, runsByStatus, rules, runs] = await Promise.all([
          this.prisma.automationRule.groupBy({
            by: ['status'],
            where: ruleWhere,
            _count: true,
          }),
          this.prisma.automationRun.groupBy({
            by: ['status'],
            where: {
              rule: { companyId },
              ...(f.status ? { status: f.status as never } : {}),
              ...(f.date('startedAt')
                ? { startedAt: f.date('startedAt') }
                : {}),
            },
            _count: true,
          }),
          this.prisma.automationRule.findMany({
            where: ruleWhere,
            select: {
              id: true,
              name: true,
              module: true,
              status: true,
              triggerEvent: true,
            },
            take: top,
          }),
          this.prisma.automationRun.findMany({
            where: {
              rule: { companyId },
              ...(f.status ? { status: f.status as never } : {}),
              ...(f.date('startedAt')
                ? { startedAt: f.date('startedAt') }
                : {}),
            },
            select: {
              id: true,
              status: true,
              startedAt: true,
              finishedAt: true,
              automationRuleId: true,
              errorMessage: true,
            },
            orderBy: { startedAt: 'desc' },
            take: top,
          }),
        ]);
        return {
          module: 'automation',
          filters: this.publicFilters(f),
          rulesByStatus,
          runsByStatus,
          rules,
          runs,
        };
      }
      default:
        throw new BadRequestException(`Unknown module: ${module}`);
    }
  }

  private resolveModule(
    module: ReportModule,
  ):
    | 'customers'
    | 'sales'
    | 'purchasing'
    | 'inventory'
    | 'hr'
    | 'work'
    | 'notebook'
    | 'automation' {
    const map: Record<string, ReturnType<ReportsService['resolveModule']>> = {
      customers: 'customers',
      crm: 'customers',
      sales: 'sales',
      purchases: 'purchasing',
      purchasing: 'purchasing',
      inventory: 'inventory',
      hr: 'hr',
      projects: 'work',
      work: 'work',
      notes: 'notebook',
      notebook: 'notebook',
      automation: 'automation',
    };
    const resolved = map[module];
    if (!resolved) {
      throw new BadRequestException(`Unknown module: ${module}`);
    }
    return resolved;
  }

  private normalizeFilters(filters: ReportFilters) {
    const from = filters.from ? new Date(filters.from) : undefined;
    const to = filters.to ? new Date(filters.to) : undefined;
    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException('from must be a valid date');
    }
    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException('to must be a valid date');
    }
    if (from && to && from > to) {
      throw new BadRequestException('from must be <= to');
    }
    const limit = Math.min(Math.max(Number(filters.limit ?? 20) || 20, 1), 200);
    return {
      from,
      to,
      branchId: filters.branchId,
      employeeId: filters.employeeId,
      customerId: filters.customerId,
      productId: filters.productId,
      status: filters.status,
      limit,
      date: (field: string): Prisma.DateTimeFilter | undefined => {
        void field;
        if (!from && !to) return undefined;
        return {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        };
      },
    };
  }

  private publicFilters(
    f: ReturnType<ReportsService['normalizeFilters']>,
  ) {
    return {
      from: f.from?.toISOString() ?? null,
      to: f.to?.toISOString() ?? null,
      branchId: f.branchId ?? null,
      employeeId: f.employeeId ?? null,
      customerId: f.customerId ?? null,
      productId: f.productId ?? null,
      status: f.status ?? null,
      limit: f.limit,
    };
  }

  private async invoiceWhere(
    companyId: string,
    f: ReturnType<ReportsService['normalizeFilters']>,
  ): Promise<Prisma.SalesInvoiceWhereInput> {
    let createdById: string | undefined;
    if (f.employeeId) {
      createdById = await this.userIdForEmployee(companyId, f.employeeId);
    }
    return {
      companyId,
      status: f.status
        ? (f.status as never)
        : { not: 'CANCELLED' },
      ...(f.date('issuedOn') ? { issuedOn: f.date('issuedOn') } : {}),
      ...(f.branchId ? { companyBranchId: f.branchId } : {}),
      ...(f.customerId ? { contactId: f.customerId } : {}),
      ...(createdById ? { createdById } : {}),
      ...(f.productId
        ? { items: { some: { itemId: f.productId } } }
        : {}),
    };
  }

  private async userIdForEmployee(companyId: string, employeeId: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { userId: true },
    });
    if (!emp?.userId) {
      // No linked user → match nothing
      return '00000000-0000-0000-0000-000000000000';
    }
    return emp.userId;
  }

  private serializeGroupMoney<T extends { _sum?: Record<string, unknown> }>(
    rows: T[],
    moneyFields: string[],
  ) {
    return rows.map((row) => {
      const sum = { ...(row._sum ?? {}) } as Record<string, unknown>;
      for (const field of moneyFields) {
        const v = sum[field];
        sum[field] =
          v != null && typeof (v as { toString: () => string }).toString ===
            'function'
            ? (v as { toString: () => string }).toString()
            : '0.00';
      }
      return { ...row, _sum: sum };
    });
  }
}
