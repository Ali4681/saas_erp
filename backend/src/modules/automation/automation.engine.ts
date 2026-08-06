import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  AutomationActionExecutor,
  type ActionResult,
  type AutomationActionInput,
} from './automation.actions';
import type { AutomationRun } from '../../generated/prisma/client';

export type DispatchInput = {
  companyId: string;
  event: string;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
  /** When set, only this rule runs (manual execute). */
  ruleId?: string;
};

type Condition = {
  field: string;
  op: string;
  value: unknown;
};

@Injectable()
export class AutomationEngine {
  private readonly logger = new Logger(AutomationEngine.name);

  /** Prevent re-entrant dispatch for the same rule within one request chain. */
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly actions: AutomationActionExecutor,
  ) {}

  async dispatch(input: DispatchInput) {
    const companyId = input.companyId;
    const event = input.event.trim();
    if (!event) return [];

    this.tenant.setCompanyId(companyId);

    try {
      const rules = await this.prisma.automationRule.findMany({
        where: {
          companyId,
          status: 'ACTIVE',
          ...(input.ruleId
            ? { id: input.ruleId }
            : { triggerEvent: event }),
        },
        orderBy: { updatedAt: 'asc' },
        take: 100,
      });

      const runs: AutomationRun[] = [];
      for (const rule of rules) {
        if (!input.ruleId && rule.triggerEvent !== event) {
          continue;
        }

        const lockKey = `${companyId}:${rule.id}`;
        if (this.running.has(lockKey)) {
          this.logger.debug(`Skip re-entrant rule ${rule.id}`);
          continue;
        }

        const payload = input.payload ?? {};
        const conditions = Array.isArray(rule.conditions)
          ? (rule.conditions as Condition[])
          : [];
        if (!this.evaluateConditions(conditions, payload)) {
          continue;
        }

        this.running.add(lockKey);
        try {
          const run = await this.executeRule(rule, {
            event: input.ruleId ? rule.triggerEvent : event,
            entityType: input.entityType,
            entityId: input.entityId,
            payload,
          });
          runs.push(run);
        } finally {
          this.running.delete(lockKey);
        }
      }
      return runs;
    } catch (error) {
      this.logger.error(
        `dispatch ${event} failed: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return [];
    }
  }

  private evaluateConditions(
    conditions: Condition[],
    payload: Record<string, unknown>,
  ): boolean {
    if (!conditions.length) return true;
    return conditions.every((c) => {
      const left = this.readPath(payload, c.field);
      const right = c.value;
      switch ((c.op || 'eq').toLowerCase()) {
        case 'eq':
        case '==':
          return left === right || String(left) === String(right);
        case 'neq':
        case '!=':
          return left !== right && String(left) !== String(right);
        case 'gt':
          return Number(left) > Number(right);
        case 'gte':
          return Number(left) >= Number(right);
        case 'lt':
          return Number(left) < Number(right);
        case 'lte':
          return Number(left) <= Number(right);
        case 'in':
          return Array.isArray(right) && right.map(String).includes(String(left));
        case 'contains':
          return String(left ?? '').includes(String(right ?? ''));
        default:
          return false;
      }
    });
  }

  private readPath(obj: Record<string, unknown>, path: string): unknown {
    if (!path) return undefined;
    const parts = path.split('.');
    let cur: unknown = obj;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[p];
    }
    return cur;
  }

  private async executeRule(
    rule: {
      id: string;
      name: string;
      companyId: string;
      triggerEvent: string;
      createdById: string;
      actions: Prisma.JsonValue;
    },
    trigger: {
      event: string;
      entityType?: string;
      entityId?: string;
      payload: Record<string, unknown>;
    },
  ) {
    const startedAt = new Date();
    const actionList = Array.isArray(rule.actions)
      ? (rule.actions as AutomationActionInput[])
      : [];

    try {
      const results: ActionResult[] = [];
      for (const action of actionList) {
        const result = await this.actions.run(action, {
          companyId: rule.companyId,
          ruleId: rule.id,
          ruleName: rule.name,
          ruleCreatedById: rule.createdById,
          triggerEvent: trigger.event,
          entityType: trigger.entityType,
          entityId: trigger.entityId,
          payload: trigger.payload,
        });
        results.push(result);
      }

      const anyFailed = results.some((r) => !r.ok && !r.skipped);
      const allSkipped =
        results.length > 0 && results.every((r) => r.skipped);
      const status = allSkipped
        ? 'SKIPPED'
        : anyFailed
          ? results.some((r) => r.ok)
            ? 'PARTIAL'
            : 'FAILED'
          : 'SUCCEEDED';

      const failedReasons = results
        .filter((r) => !r.ok && !r.skipped)
        .map((r) => `${r.type}: ${r.reason ?? 'فشل غير معروف'}`);
      const skippedNotes = results
        .filter((r) => r.skipped)
        .map((r) => `${r.type}: تخطّي — ${r.reason ?? '—'}`);

      let errorMessage: string | null = null;
      if (anyFailed) {
        errorMessage = failedReasons.join(' | ') || 'فشل تنفيذ إجراء أو أكثر';
      } else if (allSkipped && skippedNotes.length) {
        errorMessage = skippedNotes.join(' | ');
      }

      return this.prisma.automationRun.create({
        data: {
          automationRuleId: rule.id,
          status,
          triggerEntityType: trigger.entityType,
          triggerEntityId: trigger.entityId,
          startedAt,
          finishedAt: new Date(),
          result: {
            event: trigger.event,
            actions: results,
            summaryAr:
              status === 'SUCCEEDED'
                ? `نجح تنفيذ ${results.length} إجراء`
                : status === 'PARTIAL'
                  ? `نجاح جزئي: ${results.filter((r) => r.ok).length}/${results.length}`
                  : status === 'SKIPPED'
                    ? 'تم تخطي كل الإجراءات'
                    : `فشل: ${failedReasons.length} إجراء`,
          } as Prisma.InputJsonValue,
          errorMessage,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Automation failed';
      this.logger.error(`Rule ${rule.id} failed: ${message}`);
      return this.prisma.automationRun.create({
        data: {
          automationRuleId: rule.id,
          status: 'FAILED',
          triggerEntityType: trigger.entityType,
          triggerEntityId: trigger.entityId,
          startedAt,
          finishedAt: new Date(),
          result: {
            event: trigger.event,
            summaryAr: 'فشل غير متوقع أثناء تشغيل القاعدة',
          } as Prisma.InputJsonValue,
          errorMessage: `خطأ النظام: ${message}`,
        },
      });
    }
  }
}
