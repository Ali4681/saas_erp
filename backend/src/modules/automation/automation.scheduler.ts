import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClsService } from 'nestjs-cls';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { AutomationEngine } from './automation.engine';

/** Minimal 5-field cron matcher (minute hour day-of-month month day-of-week). */
function cronMatches(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const vals = [
    date.getMinutes(),
    date.getHours(),
    date.getDate(),
    date.getMonth() + 1,
    date.getDay(),
  ];
  return parts.every((part, i) => matchCronField(part, vals[i]));
}

function matchCronField(field: string, value: number): boolean {
  if (field === '*') return true;
  for (const token of field.split(',')) {
    if (token.includes('/')) {
      const [base, stepRaw] = token.split('/');
      const step = Number(stepRaw);
      if (!(step > 0)) continue;
      if (base === '*') {
        if (value % step === 0) return true;
        continue;
      }
      const start = Number(base);
      if (
        Number.isFinite(start) &&
        value >= start &&
        (value - start) % step === 0
      ) {
        return true;
      }
      continue;
    }
    if (token.includes('-')) {
      const [a, b] = token.split('-').map(Number);
      if (
        Number.isFinite(a) &&
        Number.isFinite(b) &&
        value >= a &&
        value <= b
      ) {
        return true;
      }
      continue;
    }
    if (Number(token) === value) return true;
  }
  return false;
}

@Injectable()
export class AutomationScheduler {
  private readonly logger = new Logger(AutomationScheduler.name);
  private readonly staleDays = 7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly engine: AutomationEngine,
    private readonly cls: ClsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async runScheduledCronRules() {
    await this.withBypass(async () => {
      const now = new Date();
      const rules = await this.prisma.automationRule.findMany({
        where: {
          status: 'ACTIVE',
          triggerEvent: 'schedule.cron',
          scheduleCron: { not: null },
        },
        take: 200,
      });
      for (const rule of rules) {
        if (!rule.scheduleCron || !cronMatches(rule.scheduleCron, now)) {
          continue;
        }
        try {
          await this.engine.dispatch({
            companyId: rule.companyId,
            event: 'schedule.cron',
            ruleId: rule.id,
            payload: {
              scheduleCron: rule.scheduleCron,
              firedAt: now.toISOString(),
            },
          });
        } catch (error) {
          this.logger.warn(
            `schedule.cron rule ${rule.id}: ${
              error instanceof Error ? error.message : error
            }`,
          );
        }
      }
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDailyScans() {
    await this.withBypass(async () => {
      const companies = await this.activeCompanyIds();
      for (const companyId of companies) {
        await this.scanStaleContacts(companyId);
        await this.scanOverdueInvoices(companyId);
        await this.scanOverdueTasks(companyId);
        await this.scanLowStock(companyId);
      }
    });
  }

  @Cron('0 1 1 * *')
  async runMonthEndPayroll() {
    await this.withBypass(async () => {
      const companies = await this.activeCompanyIds();
      const now = new Date();
      for (const companyId of companies) {
        try {
          await this.engine.dispatch({
            companyId,
            event: 'hr.payroll.month_end',
            entityType: 'payroll',
            entityId: companyId,
            payload: {
              year: now.getUTCFullYear(),
              month: now.getUTCMonth() + 1,
              firedAt: now.toISOString(),
            },
          });
        } catch (error) {
          this.logger.warn(
            `hr.payroll.month_end ${companyId}: ${
              error instanceof Error ? error.message : error
            }`,
          );
        }
      }
    });
  }

  private async withBypass(fn: () => Promise<void>) {
    await this.cls.run(async () => {
      this.tenant.setBypass(true);
      try {
        await fn();
      } finally {
        this.tenant.setBypass(false);
      }
    });
  }

  private async activeCompanyIds(): Promise<string[]> {
    const rows = await this.prisma.company.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
      take: 500,
    });
    return rows.map((r) => r.id);
  }

  private async scanStaleContacts(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.staleDays);

    const contacts = await this.prisma.crmContact.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        updatedAt: { lt: cutoff },
      },
      select: {
        id: true,
        name: true,
        ownerUserId: true,
        updatedAt: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true, occurredAt: true, scheduledAt: true },
        },
      },
      take: 50,
    });

    for (const contact of contacts) {
      const last = contact.activities[0];
      const lastAt = last
        ? new Date(
            Math.max(
              last.createdAt.getTime(),
              last.occurredAt?.getTime() ?? 0,
              last.scheduledAt?.getTime() ?? 0,
            ),
          )
        : contact.updatedAt;
      if (lastAt >= cutoff) continue;

      await this.safeDispatch(
        companyId,
        'crm.contact.stale',
        'crm_contact',
        contact.id,
        {
          contactId: contact.id,
          name: contact.name,
          ownerUserId: contact.ownerUserId,
          staleDays: this.staleDays,
          lastActivityAt: lastAt.toISOString(),
        },
      );
    }
  }

  private async scanOverdueInvoices(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        companyId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
        dueOn: { lt: today },
      },
      take: 100,
    });

    for (const invoice of invoices) {
      if (invoice.status !== 'OVERDUE') {
        try {
          await this.prisma.salesInvoice.update({
            where: { id: invoice.id },
            data: { status: 'OVERDUE' },
          });
        } catch {
          /* ignore race */
        }
      }
      await this.safeDispatch(
        companyId,
        'sales.invoice.overdue',
        'sales_invoice',
        invoice.id,
        {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          contactId: invoice.contactId,
          dueOn: invoice.dueOn?.toISOString() ?? null,
          balanceDue: Number(invoice.balanceDue),
        },
      );
    }
  }

  private async scanOverdueTasks(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const now = new Date();
    const tasks = await this.prisma.workTask.findMany({
      where: {
        workProject: { companyId },
        dueAt: { lt: now },
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      include: {
        workProject: { select: { id: true, name: true, ownerUserId: true } },
        assignee: { select: { userId: true } },
      },
      take: 100,
    });

    for (const task of tasks) {
      await this.safeDispatch(
        companyId,
        'work.task.overdue',
        'work_task',
        task.id,
        {
          taskId: task.id,
          title: task.title,
          workProjectId: task.workProjectId,
          projectName: task.workProject.name,
          ownerUserId: task.workProject.ownerUserId,
          assigneeUserId: task.assignee?.userId ?? null,
          dueAt: task.dueAt?.toISOString() ?? null,
        },
      );
    }
  }

  private async scanLowStock(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const items = await this.prisma.item.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        minStock: { gt: 0 },
      },
      take: 200,
    });

    for (const item of items) {
      const aggregates = await this.prisma.stockBalance.aggregate({
        where: { itemId: item.id, warehouse: { companyId } },
        _sum: { quantityOnHand: true },
      });
      const onHand = Number(aggregates._sum.quantityOnHand ?? 0);
      const minStock = Number(item.minStock ?? 0);
      if (onHand > minStock) continue;

      await this.safeDispatch(
        companyId,
        'inventory.stock.low',
        'item',
        item.id,
        {
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          onHand,
          minStock,
          atOrBelowMin: true,
          source: 'scheduler',
        },
      );
    }
  }

  private async safeDispatch(
    companyId: string,
    event: string,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>,
  ) {
    try {
      await this.engine.dispatch({
        companyId,
        event,
        entityType,
        entityId,
        payload,
      });
    } catch (error) {
      this.logger.warn(
        `${event} ${entityId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
