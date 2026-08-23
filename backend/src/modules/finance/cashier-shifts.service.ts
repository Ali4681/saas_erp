import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { GovernanceService } from '../governance/governance.service';

const DEFAULT_CLEARING: Array<{ code: string; name: string; kind: string }> = [
  { code: 'CASH', name: 'Cash on hand', kind: 'CASH' },
  { code: 'CARD', name: 'Card / network clearing', kind: 'CARD' },
  { code: 'TRANSFER', name: 'Bank transfer clearing', kind: 'TRANSFER' },
  { code: 'FLOAT', name: 'Opening float', kind: 'FLOAT' },
  { code: 'PETTY', name: 'Petty cash expense', kind: 'PETTY' },
  { code: 'REVENUE', name: 'Sales revenue', kind: 'REVENUE' },
  { code: 'VAT', name: 'Output VAT', kind: 'VAT' },
  { code: 'OVER_SHORT', name: 'Cash over/short', kind: 'OVER_SHORT' },
];

@Injectable()
export class CashierShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly governance: GovernanceService,
  ) {}

  list(companyId: string, status?: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.cashierShiftSession.findMany({
      where: {
        companyId,
        ...(status ? { status: status as never } : {}),
      },
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
        branch: { select: { id: true, name: true, code: true } },
        workShift: { select: { id: true, name: true, startTime: true, endTime: true } },
      },
      orderBy: { openedAt: 'desc' },
      take: 100,
    });
  }

  async get(companyId: string, sessionId: string) {
    this.tenant.setCompanyId(companyId);
    const row = await this.prisma.cashierShiftSession.findFirst({
      where: { id: sessionId, companyId },
      include: {
        employee: true,
        branch: true,
        workShift: true,
        journals: { include: { lines: { include: { clearingAccount: true } } } },
        handoversFrom: true,
      },
    });
    if (!row) throw new NotFoundException('Cashier shift not found');
    return row;
  }

  async ensureClearingAccounts(companyId: string) {
    for (const a of DEFAULT_CLEARING) {
      await this.prisma.clearingAccount.upsert({
        where: {
          companyId_code: { companyId, code: a.code },
        },
        update: { name: a.name, kind: a.kind, isActive: true },
        create: {
          companyId,
          code: a.code,
          name: a.name,
          kind: a.kind,
        },
      });
    }
  }

  async open(input: {
    companyId: string;
    userId: string;
    employeeId: string;
    openingFloat?: string | number;
    branchId?: string;
    workShiftId?: string;
    currency?: string;
    notes?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const employee = await this.prisma.employee.findFirst({
      where: { id: input.employeeId, companyId: input.companyId },
    });
    if (!employee) throw new BadRequestException('Employee not found');

    const openExisting = await this.prisma.cashierShiftSession.findFirst({
      where: {
        companyId: input.companyId,
        userId: input.userId,
        status: 'OPEN',
      },
    });
    if (openExisting) {
      throw new BadRequestException('User already has an open cashier shift');
    }

    await this.ensureClearingAccounts(input.companyId);
    const float = Number(input.openingFloat ?? 0);
    if (float < 0) throw new BadRequestException('openingFloat must be >= 0');

    return this.prisma.cashierShiftSession.create({
      data: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        userId: input.userId,
        branchId: input.branchId,
        workShiftId: input.workShiftId,
        openingFloat: float.toFixed(2),
        expectedCash: float.toFixed(2),
        currency: input.currency ?? 'SAR',
        notes: input.notes,
        status: 'OPEN',
      },
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
      },
    });
  }

  async close(input: {
    companyId: string;
    sessionId: string;
    userId: string;
    countedCash: string | number;
    cashSales?: string | number;
    cardSales?: string | number;
    transferSales?: string | number;
    pettyExpenses?: string | number;
    notes?: string;
    taxRate?: number;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const session = await this.prisma.cashierShiftSession.findFirst({
      where: { id: input.sessionId, companyId: input.companyId },
    });
    if (!session) throw new NotFoundException('Cashier shift not found');
    if (session.status !== 'OPEN') {
      throw new BadRequestException('Shift is not open');
    }

    await this.governance.assertDocumentDateWritable(
      input.companyId,
      session.openedAt,
      { allowBackdate: false },
    );

    const opening = Number(session.openingFloat);
    const cashSales = Number(input.cashSales ?? session.cashSales);
    const cardSales = Number(input.cardSales ?? session.cardSales);
    const transferSales = Number(input.transferSales ?? session.transferSales);
    const petty = Number(input.pettyExpenses ?? session.pettyExpenses);
    const expected = opening + cashSales - petty;
    const counted = Number(input.countedCash);
    const variance = counted - expected;
    const totalSales = cashSales + cardSales + transferSales;
    const taxRate = Math.max(0, Number(input.taxRate ?? 15));
    const revenueNet = totalSales / (1 + taxRate / 100);
    const vat = totalSales - revenueNet;

    const zReportNumber = `Z-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${session.id.slice(0, 8).toUpperCase()}`;

    const needsApproval = Math.abs(variance) >= 50;
    const status = needsApproval ? 'PENDING_APPROVAL' : 'CLOSED';

    await this.ensureClearingAccounts(input.companyId);
    const accounts = await this.prisma.clearingAccount.findMany({
      where: { companyId: input.companyId, isActive: true },
    });
    const byKind = (kind: string) => {
      const a = accounts.find((x) => x.kind === kind);
      if (!a) throw new BadRequestException(`Missing clearing account: ${kind}`);
      return a.id;
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cashierShiftSession.update({
        where: { id: session.id },
        data: {
          status,
          closedAt: new Date(),
          cashSales: cashSales.toFixed(2),
          cardSales: cardSales.toFixed(2),
          transferSales: transferSales.toFixed(2),
          pettyExpenses: petty.toFixed(2),
          expectedCash: expected.toFixed(2),
          countedCash: counted.toFixed(2),
          variance: variance.toFixed(2),
          zReportNumber,
          notes: input.notes ?? session.notes,
        },
      });

      const entry = await tx.journalEntry.create({
        data: {
          companyId: input.companyId,
          entryType: 'Z_REPORT',
          status: 'POSTED',
          entryDate: new Date(),
          memo: `Z-Report ${zReportNumber}`,
          currency: session.currency,
          cashierShiftSessionId: session.id,
          createdByUserId: input.userId,
          postedAt: new Date(),
          postedByUserId: input.userId,
        },
      });

      const lines: Array<{
        clearingAccountId: string;
        debit: string;
        credit: string;
        memo: string;
      }> = [
        {
          clearingAccountId: byKind('CASH'),
          debit: counted.toFixed(2),
          credit: '0.00',
          memo: 'Counted cash',
        },
        {
          clearingAccountId: byKind('CARD'),
          debit: cardSales.toFixed(2),
          credit: '0.00',
          memo: 'Card / network sales',
        },
        {
          clearingAccountId: byKind('TRANSFER'),
          debit: transferSales.toFixed(2),
          credit: '0.00',
          memo: 'Transfer sales',
        },
        {
          clearingAccountId: byKind('REVENUE'),
          debit: '0.00',
          credit: revenueNet.toFixed(2),
          memo: 'Sales revenue (net)',
        },
        {
          clearingAccountId: byKind('VAT'),
          debit: '0.00',
          credit: vat.toFixed(2),
          memo: `Output VAT ${taxRate}%`,
        },
      ];
      if (petty > 0) {
        lines.push({
          clearingAccountId: byKind('PETTY'),
          debit: petty.toFixed(2),
          credit: '0.00',
          memo: 'Petty expenses',
        });
      }
      if (variance !== 0) {
        if (variance > 0) {
          lines.push({
            clearingAccountId: byKind('OVER_SHORT'),
            debit: '0.00',
            credit: Math.abs(variance).toFixed(2),
            memo: 'Cash over',
          });
        } else {
          lines.push({
            clearingAccountId: byKind('OVER_SHORT'),
            debit: Math.abs(variance).toFixed(2),
            credit: '0.00',
            memo: 'Cash short',
          });
        }
      }
      // Balance float credit (opening float was liability of drawer)
      lines.push({
        clearingAccountId: byKind('FLOAT'),
        debit: '0.00',
        credit: opening.toFixed(2),
        memo: 'Opening float returned',
      });

      await tx.journalLine.createMany({
        data: lines.map((l) => ({
          companyId: input.companyId,
          journalEntryId: entry.id,
          clearingAccountId: l.clearingAccountId,
          debit: l.debit,
          credit: l.credit,
          memo: l.memo,
        })),
      });

      return { session: updated, journalEntryId: entry.id, zReportNumber };
    });

    if (needsApproval) {
      const supervisors = await this.prisma.companyUser.findMany({
        where: {
          companyId: input.companyId,
          status: 'ACTIVE',
          OR: [
            { role: { code: { in: ['COMPANY_OWNER', 'COMPANY_ADMIN'] } } },
            {
              role: {
                financialProfile: {
                  in: ['MANAGER_SUPERVISOR', 'BRANCH_MANAGER'],
                },
              },
            },
          ],
        },
        select: { userId: true },
        take: 20,
      });
      for (const s of supervisors) {
        await this.prisma.notification.create({
          data: {
            companyId: input.companyId,
            userId: s.userId,
            type: 'SHIFT_VARIANCE',
            title: 'Cashier shift variance pending approval',
            body: `Z-Report ${zReportNumber} variance ${variance.toFixed(2)} ${session.currency}`,
            actionUrl: `/c/${input.companyId}/finance/cashier-shifts`,
            data: { sessionId: session.id, variance },
          },
        });
      }
    }

    return result;
  }

  async approve(input: {
    companyId: string;
    sessionId: string;
    approvedByUserId: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const session = await this.prisma.cashierShiftSession.findFirst({
      where: { id: input.sessionId, companyId: input.companyId },
    });
    if (!session) throw new NotFoundException('Cashier shift not found');
    if (session.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Shift is not pending approval');
    }
    return this.prisma.cashierShiftSession.update({
      where: { id: session.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedByUserId: input.approvedByUserId,
      },
    });
  }

  async handover(input: {
    companyId: string;
    fromSessionId: string;
    createdByUserId: string;
    amount: string | number;
    target: 'NEXT_CASHIER' | 'TREASURY' | 'BANK';
    toSessionId?: string;
    notes?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const from = await this.prisma.cashierShiftSession.findFirst({
      where: { id: input.fromSessionId, companyId: input.companyId },
    });
    if (!from) throw new NotFoundException('Source shift not found');
    const amount = Number(input.amount);
    if (!(amount > 0)) throw new BadRequestException('amount must be > 0');

    return this.prisma.cashierShiftHandover.create({
      data: {
        companyId: input.companyId,
        fromSessionId: from.id,
        toSessionId: input.toSessionId,
        amount: amount.toFixed(2),
        currency: from.currency,
        target: input.target,
        notes: input.notes,
        createdByUserId: input.createdByUserId,
      },
    });
  }
}
