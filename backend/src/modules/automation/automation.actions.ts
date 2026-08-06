import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CrmService } from '../crm/crm.service';
import { WorkService } from '../work/work.service';
import { SalesService } from '../sales/sales.service';
import { InventoryService } from '../inventory/inventory.service';
import { PurchasingService } from '../purchasing/purchasing.service';
import { HrService } from '../hr/hr.service';

export type AutomationActionInput = {
  type: string;
  title?: string;
  body?: string;
  userId?: string;
  roleCode?: string;
  actionUrl?: string;
  assigneeUserId?: string;
  daysFromNow?: number | string;
  [key: string]: unknown;
};

export type ActionContext = {
  companyId: string;
  ruleId: string;
  ruleName: string;
  ruleCreatedById?: string;
  triggerEvent: string;
  entityType?: string;
  entityId?: string;
  payload: Record<string, unknown>;
};

export type ActionResult = {
  type: string;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  detail?: unknown;
};

@Injectable()
export class AutomationActionExecutor {
  private readonly logger = new Logger(AutomationActionExecutor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => CrmService))
    private readonly crm: CrmService,
    @Inject(forwardRef(() => WorkService))
    private readonly work: WorkService,
    @Inject(forwardRef(() => SalesService))
    private readonly sales: SalesService,
    @Inject(forwardRef(() => InventoryService))
    private readonly inventory: InventoryService,
    @Inject(forwardRef(() => PurchasingService))
    private readonly purchasing: PurchasingService,
    @Inject(forwardRef(() => HrService))
    private readonly hr: HrService,
  ) {}

  async run(
    action: AutomationActionInput,
    ctx: ActionContext,
  ): Promise<ActionResult> {
    switch (action.type) {
      case 'notify':
        return this.notify(action, ctx);
      case 'notify_role':
        return this.notifyRole(action, ctx);
      case 'assign_user':
        return this.assignUser(action, ctx);
      case 'create_task':
        return this.createTask(action, ctx);
      case 'create_crm_activity':
        return this.createCrmActivity(action, ctx);
      case 'convert_quote_to_invoice':
        return this.convertQuoteToInvoice(action, ctx);
      case 'update_contact_status':
        return this.updateContactStatus(action, ctx);
      case 'create_purchase_order':
        return this.createPurchaseOrder(action, ctx);
      case 'ensure_stock_deduction':
        return this.ensureStockDeduction(action, ctx);
      case 'update_leave_balance':
        return this.updateLeaveBalance(action, ctx);
      case 'prepare_payroll_run':
        return this.preparePayrollRun(action, ctx);
      case 'open_next_phase':
        return this.openNextPhase(action, ctx);
      default:
        return {
          type: action.type,
          ok: false,
          skipped: true,
          reason: `Action "${action.type}" not implemented in current phase`,
        };
    }
  }

  private resolveUserId(
    action: AutomationActionInput,
    ctx: ActionContext,
  ): string | null {
    const fromAction =
      (typeof action.userId === 'string' && action.userId.trim()) ||
      (typeof action.assigneeUserId === 'string' &&
        action.assigneeUserId.trim()) ||
      null;
    if (fromAction && !fromAction.includes('{{')) return fromAction;
    const fromPayload =
      (typeof ctx.payload.assigneeUserId === 'string' &&
        ctx.payload.assigneeUserId) ||
      (typeof ctx.payload.ownerUserId === 'string' && ctx.payload.ownerUserId) ||
      (typeof ctx.payload.userId === 'string' && ctx.payload.userId) ||
      null;
    return fromPayload;
  }

  private async notify(
    action: AutomationActionInput,
    ctx: ActionContext,
  ): Promise<ActionResult> {
    const userId = action.userId?.trim() || this.resolveUserId(action, ctx);
    if (!userId) {
      return {
        type: 'notify',
        ok: false,
        skipped: true,
        reason: 'userId required',
      };
    }

    const title = (action.title ?? ctx.ruleName).toString();
    const body = (
      action.body ?? `Triggered by ${ctx.triggerEvent}`
    ).toString();

    try {
      const sent = await this.notifications.createAndPush({
        companyId: ctx.companyId,
        userId,
        type: 'automation',
        title,
        body,
        actionUrl: action.actionUrl,
        data: {
          ruleId: ctx.ruleId,
          triggerEvent: ctx.triggerEvent,
          entityType: ctx.entityType,
          entityId: ctx.entityId,
          ...(ctx.payload ?? {}),
        },
      });
      return {
        type: 'notify',
        ok: true,
        detail: {
          notificationId: sent.notification.id,
          push: sent.push,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'notify failed';
      this.logger.warn(`notify failed: ${message}`);
      return { type: 'notify', ok: false, reason: message };
    }
  }

  private async notifyRole(
    action: AutomationActionInput,
    ctx: ActionContext,
  ): Promise<ActionResult> {
    const roleCode = action.roleCode?.trim();
    if (!roleCode) {
      return {
        type: 'notify_role',
        ok: false,
        skipped: true,
        reason: 'roleCode required',
      };
    }

    this.tenant.setCompanyId(ctx.companyId);
    const members = await this.prisma.companyUser.findMany({
      where: {
        companyId: ctx.companyId,
        status: { in: ['ACTIVE', 'INVITED'] },
        role: { code: roleCode },
      },
      select: { userId: true },
    });

    if (!members.length) {
      return {
        type: 'notify_role',
        ok: false,
        skipped: true,
        reason: `No members with role ${roleCode}`,
      };
    }

    const title = (action.title ?? ctx.ruleName).toString();
    const body = (
      action.body ?? `Triggered by ${ctx.triggerEvent}`
    ).toString();

    const results: unknown[] = [];
    let okCount = 0;
    for (const m of members) {
      const r = await this.notify(
        {
          type: 'notify',
          userId: m.userId,
          title,
          body,
          actionUrl: action.actionUrl,
        },
        ctx,
      );
      results.push({ userId: m.userId, ...r });
      if (r.ok) okCount += 1;
    }

    return {
      type: 'notify_role',
      ok: okCount > 0,
      detail: { roleCode, notified: okCount, total: members.length, results },
      reason: okCount === 0 ? 'All notify attempts failed' : undefined,
    };
  }

  private async assignUser(
    action: AutomationActionInput,
    ctx: ActionContext,
  ): Promise<ActionResult> {
    const userId = this.resolveUserId(action, ctx);
    if (!userId) {
      return {
        type: 'assign_user',
        ok: false,
        skipped: true,
        reason: 'userId required (set on action or payload)',
      };
    }

    this.tenant.setCompanyId(ctx.companyId);
    const membership = await this.prisma.companyUser.findUnique({
      where: {
        companyId_userId: { companyId: ctx.companyId, userId },
      },
    });
    if (!membership) {
      return {
        type: 'assign_user',
        ok: false,
        reason: 'User is not a company member',
      };
    }

    try {
      const entityType = ctx.entityType ?? String(ctx.payload.entityType ?? '');
      const entityId = ctx.entityId ?? String(ctx.payload.entityId ?? '');

      if (entityType === 'crm_contact' || entityType === 'contact') {
        await this.crm.updateContact(ctx.companyId, entityId, {
          ownerUserId: userId,
        });
        return {
          type: 'assign_user',
          ok: true,
          detail: { entityType: 'crm_contact', entityId, userId },
        };
      }

      if (entityType === 'crm_opportunity' || entityType === 'opportunity') {
        await this.prisma.crmOpportunity.update({
          where: { id: entityId },
          data: { ownerUserId: userId },
        });
        return {
          type: 'assign_user',
          ok: true,
          detail: { entityType: 'crm_opportunity', entityId, userId },
        };
      }

      const contactId =
        typeof ctx.payload.contactId === 'string'
          ? ctx.payload.contactId
          : null;
      if (contactId) {
        await this.crm.updateContact(ctx.companyId, contactId, {
          ownerUserId: userId,
        });
        return {
          type: 'assign_user',
          ok: true,
          detail: { entityType: 'crm_contact', entityId: contactId, userId },
        };
      }

      return {
        type: 'assign_user',
        ok: false,
        skipped: true,
        reason: 'No assignable CRM entity in context',
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'assign_user failed';
      return { type: 'assign_user', ok: false, reason: message };
    }
  }

  private async createCrmActivity(
    action: AutomationActionInput,
    ctx: ActionContext,
  ): Promise<ActionResult> {
    const createdById =
      ctx.ruleCreatedById ||
      this.resolveUserId(action, ctx) ||
      (typeof ctx.payload.createdById === 'string'
        ? ctx.payload.createdById
        : null);
    if (!createdById) {
      return {
        type: 'create_crm_activity',
        ok: false,
        skipped: true,
        reason: 'createdById unavailable',
      };
    }

    const days = Number(action.daysFromNow ?? 1);
    const scheduled = new Date();
    scheduled.setDate(scheduled.getDate() + (Number.isFinite(days) ? days : 1));

    const contactId =
      (ctx.entityType === 'crm_contact' || ctx.entityType === 'contact'
        ? ctx.entityId
        : undefined) ||
      (typeof ctx.payload.contactId === 'string'
        ? ctx.payload.contactId
        : undefined);
    const opportunityId =
      (ctx.entityType === 'crm_opportunity' || ctx.entityType === 'opportunity'
        ? ctx.entityId
        : undefined) ||
      (typeof ctx.payload.opportunityId === 'string'
        ? ctx.payload.opportunityId
        : undefined);

    if (!contactId && !opportunityId) {
      return {
        type: 'create_crm_activity',
        ok: false,
        skipped: true,
        reason: 'contactId or opportunityId required',
      };
    }

    try {
      const activity = await this.crm.createActivity({
        companyId: ctx.companyId,
        createdById,
        activityType: 'FOLLOW_UP',
        subject: String(
          action.title ?? action.body ?? `متابعة — ${ctx.ruleName}`,
        ),
        notes: action.body ? String(action.body) : undefined,
        contactId,
        opportunityId,
        scheduledAt: scheduled.toISOString(),
        assignedToId: this.resolveUserId(action, ctx) ?? undefined,
      });
      return {
        type: 'create_crm_activity',
        ok: true,
        detail: { activityId: activity.id, scheduledAt: scheduled },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'create_crm_activity failed';
      return { type: 'create_crm_activity', ok: false, reason: message };
    }
  }

  private async createTask(
    action: AutomationActionInput,
    ctx: ActionContext,
  ): Promise<ActionResult> {
    try {
      const project = await this.ensureCrmFollowupProject(ctx.companyId);
      const userId = this.resolveUserId(action, ctx);
      let assigneeCompanyUserId: string | undefined;
      if (userId) {
        const membership = await this.prisma.companyUser.findUnique({
          where: {
            companyId_userId: { companyId: ctx.companyId, userId },
          },
        });
        assigneeCompanyUserId = membership?.id;
      }

      const days = Number(action.daysFromNow ?? 1);
      const due = new Date();
      due.setDate(due.getDate() + (Number.isFinite(days) ? days : 1));

      const contactName =
        typeof ctx.payload.name === 'string' ? ctx.payload.name : '';
      const title = String(
        action.title ??
          `متابعة مبيعات${contactName ? `: ${contactName}` : ''} — ${ctx.ruleName}`,
      );

      const task = await this.work.createTask({
        companyId: ctx.companyId,
        workProjectId: project.id,
        title,
        description: [
          action.body ? String(action.body) : null,
          ctx.entityType && ctx.entityId
            ? `المصدر: ${ctx.entityType}/${ctx.entityId}`
            : null,
        ]
          .filter(Boolean)
          .join('\n'),
        assigneeCompanyUserId,
        dueAt: due.toISOString(),
        priority: 'MEDIUM',
      });

      return {
        type: 'create_task',
        ok: true,
        detail: {
          taskId: task.id,
          projectId: project.id,
          assigneeCompanyUserId,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'create_task failed';
      return { type: 'create_task', ok: false, reason: message };
    }
  }

  private async ensureCrmFollowupProject(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const code = 'CRM-FOLLOWUP';
    const existing = await this.prisma.workProject.findFirst({
      where: { companyId, code },
    });
    if (existing) return existing;
    return this.work.createProject({
      companyId,
      code,
      name: 'متابعة المبيعات (أتمتة)',
    });
  }

  private async convertQuoteToInvoice(
    _action: AutomationActionInput,
    ctx: ActionContext,
  ): Promise<ActionResult> {
    const quoteId =
      (ctx.entityType === 'sales_quote' || ctx.entityType === 'quote'
        ? ctx.entityId
        : undefined) ||
      (typeof ctx.payload.quoteId === 'string' ? ctx.payload.quoteId : null);
    if (!quoteId) {
      return {
        type: 'convert_quote_to_invoice',
        ok: false,
        skipped: true,
        reason: 'quoteId required',
      };
    }
    try {
      const invoice = await this.sales.convertQuoteToInvoice(
        ctx.companyId,
        quoteId,
        undefined,
        undefined,
        { createdById: ctx.ruleCreatedById },
      );
      return {
        type: 'convert_quote_to_invoice',
        ok: true,
        detail: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'convert failed';
      return { type: 'convert_quote_to_invoice', ok: false, reason: message };
    }
  }

  private async updateContactStatus(
    action: AutomationActionInput,
    ctx: ActionContext,
  ): Promise<ActionResult> {
    const status = String(action.status ?? 'ACTIVE');
    if (status !== 'ACTIVE' && status !== 'INACTIVE') {
      return {
        type: 'update_contact_status',
        ok: false,
        reason: 'status must be ACTIVE or INACTIVE',
      };
    }
    const contactId =
      (typeof ctx.payload.contactId === 'string'
        ? ctx.payload.contactId
        : null) ||
      (ctx.entityType === 'crm_contact' ? ctx.entityId : null);
    if (!contactId) {
      return {
        type: 'update_contact_status',
        ok: false,
        skipped: true,
        reason: 'contactId required',
      };
    }
    try {
      await this.crm.updateContact(ctx.companyId, contactId, {
        status: status as 'ACTIVE' | 'INACTIVE',
      });
      return {
        type: 'update_contact_status',
        ok: true,
        detail: { contactId, status },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'update contact failed';
      return { type: 'update_contact_status', ok: false, reason: message };
    }
  }

  private async createPurchaseOrder(
    _action: AutomationActionInput,
    ctx: ActionContext,
  ): Promise<ActionResult> {
    const itemId =
      (typeof ctx.payload.itemId === 'string' ? ctx.payload.itemId : null) ||
      (ctx.entityType === 'item' ? ctx.entityId : null);
    if (!itemId) {
      return {
        type: 'create_purchase_order',
        ok: false,
        skipped: true,
        reason: 'itemId required',
      };
    }
    const requestedById = ctx.ruleCreatedById;
    if (!requestedById) {
      return {
        type: 'create_purchase_order',
        ok: false,
        skipped: true,
        reason: 'requestedById unavailable',
      };
    }

    this.tenant.setCompanyId(ctx.companyId);
    try {
      const item = await this.prisma.item.findFirst({
        where: { id: itemId, companyId: ctx.companyId },
      });
      if (!item) {
        return {
          type: 'create_purchase_order',
          ok: false,
          reason: 'Item not found',
        };
      }

      const supplier = await this.prisma.supplier.findFirst({
        where: { companyId: ctx.companyId, status: 'ACTIVE' },
        orderBy: { name: 'asc' },
      });
      if (!supplier) {
        return {
          type: 'create_purchase_order',
          ok: false,
          skipped: true,
          reason: 'No active supplier to create PO',
        };
      }

      const warehouseId =
        (typeof ctx.payload.warehouseId === 'string'
          ? ctx.payload.warehouseId
          : undefined) ||
        (
          await this.prisma.warehouse.findFirst({
            where: { companyId: ctx.companyId, status: 'ACTIVE' },
            orderBy: { name: 'asc' },
          })
        )?.id;

      const minStock = Number(item.minStock ?? 0);
      const qty = Math.max(minStock || 1, 1);

      const po = await this.purchasing.createPurchaseOrder({
        companyId: ctx.companyId,
        requestedById,
        supplierId: supplier.id,
        warehouseId,
        items: [
          {
            itemId: item.id,
            description: item.name,
            quantity: qty,
            unitCost: Number(item.cost ?? 0),
          },
        ],
      });

      return {
        type: 'create_purchase_order',
        ok: true,
        detail: {
          purchaseOrderId: po.id,
          supplierId: supplier.id,
          itemId: item.id,
          quantity: qty,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'create PO failed';
      return { type: 'create_purchase_order', ok: false, reason: message };
    }
  }

  private async ensureStockDeduction(
    _action: AutomationActionInput,
    ctx: ActionContext,
  ): Promise<ActionResult> {
    const invoiceId =
      (ctx.entityType === 'sales_invoice' || ctx.entityType === 'invoice'
        ? ctx.entityId
        : undefined) ||
      (typeof ctx.payload.invoiceId === 'string'
        ? ctx.payload.invoiceId
        : null);
    if (!invoiceId) {
      return {
        type: 'ensure_stock_deduction',
        ok: false,
        skipped: true,
        reason: 'invoiceId required',
      };
    }
    const createdById = ctx.ruleCreatedById;
    if (!createdById) {
      return {
        type: 'ensure_stock_deduction',
        ok: false,
        skipped: true,
        reason: 'createdById unavailable',
      };
    }

    this.tenant.setCompanyId(ctx.companyId);
    try {
      const invoice = await this.prisma.salesInvoice.findFirst({
        where: { id: invoiceId, companyId: ctx.companyId },
        include: { items: true },
      });
      if (!invoice) {
        return {
          type: 'ensure_stock_deduction',
          ok: false,
          reason: 'Invoice not found',
        };
      }

      const warehouse =
        (typeof ctx.payload.warehouseId === 'string'
          ? await this.prisma.warehouse.findFirst({
              where: {
                id: ctx.payload.warehouseId,
                companyId: ctx.companyId,
              },
            })
          : null) ||
        (await this.prisma.warehouse.findFirst({
          where: { companyId: ctx.companyId, status: 'ACTIVE' },
          orderBy: { name: 'asc' },
        }));
      if (!warehouse) {
        return {
          type: 'ensure_stock_deduction',
          ok: false,
          skipped: true,
          reason: 'No warehouse available',
        };
      }

      const results: unknown[] = [];
      for (const line of invoice.items) {
        if (!line.itemId) continue;
        const already = await this.prisma.stockMovement.findFirst({
          where: {
            companyId: ctx.companyId,
            itemId: line.itemId,
            referenceType: 'sales_invoice',
            referenceId: invoice.id,
            movementType: 'SALE_ISSUE',
          },
        });
        if (already) {
          results.push({
            itemId: line.itemId,
            skipped: true,
            reason: 'already deducted',
          });
          continue;
        }
        const movement = await this.inventory.createMovement({
          companyId: ctx.companyId,
          createdById,
          warehouseId: warehouse.id,
          itemId: line.itemId,
          movementType: 'SALE_ISSUE',
          quantity: Number(line.quantity),
          referenceType: 'sales_invoice',
          referenceId: invoice.id,
          notes: `Auto deduct for invoice ${invoice.invoiceNumber}`,
        });
        results.push({ itemId: line.itemId, movementId: movement.id });
      }

      return {
        type: 'ensure_stock_deduction',
        ok: true,
        detail: { invoiceId, warehouseId: warehouse.id, results },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'stock deduction failed';
      return { type: 'ensure_stock_deduction', ok: false, reason: message };
    }
  }

  private static readonly BALANCE_MARKER = '[balance_deducted]';

  private async updateLeaveBalance(
    _action: AutomationActionInput,
    ctx: ActionContext,
  ): Promise<ActionResult> {
    const leaveId =
      (ctx.entityType === 'leave_request' || ctx.entityType === 'leave'
        ? ctx.entityId
        : undefined) ||
      (typeof ctx.payload.leaveId === 'string' ? ctx.payload.leaveId : null);
    if (!leaveId) {
      return {
        type: 'update_leave_balance',
        ok: false,
        skipped: true,
        reason: 'leaveId required',
      };
    }

    this.tenant.setCompanyId(ctx.companyId);
    try {
      const leave = await this.prisma.leaveRequest.findFirst({
        where: { id: leaveId, companyId: ctx.companyId },
      });
      if (!leave) {
        return {
          type: 'update_leave_balance',
          ok: false,
          reason: 'Leave request not found',
        };
      }
      if (leave.status !== 'APPROVED') {
        return {
          type: 'update_leave_balance',
          ok: false,
          skipped: true,
          reason: 'Leave is not approved',
        };
      }
      if ((leave.reason ?? '').includes(AutomationActionExecutor.BALANCE_MARKER)) {
        return {
          type: 'update_leave_balance',
          ok: true,
          skipped: true,
          reason: 'Balance already deducted',
        };
      }

      const days = Number(leave.requestedDays);
      const employee = await this.prisma.employee.findFirst({
        where: { id: leave.employeeId, companyId: ctx.companyId },
      });
      if (!employee) {
        return {
          type: 'update_leave_balance',
          ok: false,
          reason: 'Employee not found',
        };
      }

      const current = Number(employee.leaveBalanceDays ?? 0);
      const next = Math.max(0, current - (Number.isFinite(days) ? days : 0));

      await this.prisma.$transaction([
        this.prisma.employee.update({
          where: { id: employee.id },
          data: { leaveBalanceDays: next.toFixed(2) },
        }),
        this.prisma.leaveRequest.update({
          where: { id: leave.id },
          data: {
            reason: [
              leave.reason?.trim() || null,
              AutomationActionExecutor.BALANCE_MARKER,
            ]
              .filter(Boolean)
              .join(' '),
          },
        }),
      ]);

      return {
        type: 'update_leave_balance',
        ok: true,
        detail: {
          employeeId: employee.id,
          deducted: days,
          previousBalance: current,
          leaveBalanceDays: next,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'update leave balance failed';
      return { type: 'update_leave_balance', ok: false, reason: message };
    }
  }

  private async preparePayrollRun(
    _action: AutomationActionInput,
    ctx: ActionContext,
  ): Promise<ActionResult> {
    const createdById =
      ctx.ruleCreatedById ||
      (typeof ctx.payload.createdById === 'string'
        ? ctx.payload.createdById
        : null);
    if (!createdById) {
      return {
        type: 'prepare_payroll_run',
        ok: false,
        skipped: true,
        reason: 'createdById unavailable',
      };
    }

    const now = new Date();
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const periodEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    );

    this.tenant.setCompanyId(ctx.companyId);
    try {
      const existing = await this.prisma.payrollRun.findFirst({
        where: {
          companyId: ctx.companyId,
          periodStart,
          periodEnd,
        },
      });
      if (existing) {
        return {
          type: 'prepare_payroll_run',
          ok: true,
          skipped: true,
          reason: 'Payroll run already exists for period',
          detail: { payrollRunId: existing.id },
        };
      }

      const run = await this.hr.createPayrollRun({
        companyId: ctx.companyId,
        createdById,
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: periodEnd.toISOString().slice(0, 10),
      });
      return {
        type: 'prepare_payroll_run',
        ok: true,
        detail: {
          payrollRunId: run.id,
          periodStart,
          periodEnd,
          itemCount: run.items?.length ?? 0,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'prepare payroll failed';
      return { type: 'prepare_payroll_run', ok: false, reason: message };
    }
  }

  private async openNextPhase(
    _action: AutomationActionInput,
    ctx: ActionContext,
  ): Promise<ActionResult> {
    const phaseId =
      (ctx.entityType === 'work_phase' || ctx.entityType === 'phase'
        ? ctx.entityId
        : undefined) ||
      (typeof ctx.payload.phaseId === 'string' ? ctx.payload.phaseId : null);
    if (!phaseId) {
      return {
        type: 'open_next_phase',
        ok: false,
        skipped: true,
        reason: 'phaseId required',
      };
    }

    this.tenant.setCompanyId(ctx.companyId);
    try {
      const phase = await this.prisma.workProjectPhase.findFirst({
        where: { id: phaseId, workProject: { companyId: ctx.companyId } },
      });
      if (!phase) {
        return {
          type: 'open_next_phase',
          ok: false,
          reason: 'Phase not found',
        };
      }

      const next = await this.prisma.workProjectPhase.findFirst({
        where: {
          workProjectId: phase.workProjectId,
          position: phase.position + 1,
        },
      });
      if (!next) {
        return {
          type: 'open_next_phase',
          ok: true,
          skipped: true,
          reason: 'No next phase',
        };
      }
      if (next.status === 'ACTIVE' || next.status === 'COMPLETED') {
        return {
          type: 'open_next_phase',
          ok: true,
          skipped: true,
          reason: `Next phase already ${next.status}`,
          detail: { nextPhaseId: next.id },
        };
      }

      const updated = await this.prisma.workProjectPhase.update({
        where: { id: next.id },
        data: { status: 'ACTIVE' },
      });
      return {
        type: 'open_next_phase',
        ok: true,
        detail: {
          completedPhaseId: phase.id,
          nextPhaseId: updated.id,
          nextPhaseName: updated.name,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'open next phase failed';
      return { type: 'open_next_phase', ok: false, reason: message };
    }
  }
}
