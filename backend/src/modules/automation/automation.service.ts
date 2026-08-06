import { Injectable } from '@nestjs/common';
import {
  i18nBadRequest,
  i18nNotFound,
} from '../../common/i18n/localized-exception';
import { I18nContext } from 'nestjs-i18n';
import { AutomationStatus, Prisma } from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { getAutomationCatalog, AUTOMATION_TEMPLATES } from './automation.catalog';
import { AutomationEngine } from './automation.engine';
import type { AutomationActionInput } from './automation.actions';

@Injectable()
export class AutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly engine: AutomationEngine,
  ) {}

  catalog() {
    const locale = I18nContext.current()?.lang === 'en' ? 'en' : 'ar';
    return getAutomationCatalog(locale);
  }

  listRules(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.automationRule.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async createRule(input: {
    companyId: string;
    createdById: string;
    name: string;
    module: string;
    triggerEvent: string;
    actions: AutomationActionInput[];
    conditions?: unknown[];
    scheduleCron?: string;
    status?: AutomationStatus;
  }) {
    this.tenant.setCompanyId(input.companyId);
    if (!input.actions?.length) {
      throw i18nBadRequest('errors.automation.actionsRequired');
    }
    if (
      input.triggerEvent === 'schedule.cron' &&
      !input.scheduleCron?.trim()
    ) {
      throw i18nBadRequest('errors.automation.cronRequired');
    }
    return this.prisma.automationRule.create({
      data: {
        companyId: input.companyId,
        createdById: input.createdById,
        name: input.name,
        module: input.module,
        triggerEvent: input.triggerEvent,
        conditions: (input.conditions ?? []) as Prisma.InputJsonValue,
        actions: input.actions as unknown as Prisma.InputJsonValue,
        scheduleCron: input.scheduleCron,
        status: input.status ?? 'DRAFT',
      },
    });
  }

  async installTemplate(input: {
    companyId: string;
    createdById: string;
    templateCode: string;
    assigneeUserId?: string;
    activate?: boolean;
  }) {
    const catalog = getAutomationCatalog('ar');
    const template = AUTOMATION_TEMPLATES.find(
      (t) => t.code === input.templateCode,
    );
    if (!template) {
      throw i18nNotFound('errors.automation.templateNotFound');
    }
    if (template.phase > catalog.currentPhase) {
      throw i18nBadRequest('errors.automation.templatePhase', {
        required: template.phase,
        current: catalog.currentPhase,
      });
    }

    this.tenant.setCompanyId(input.companyId);
    const existing = await this.prisma.automationRule.findFirst({
      where: {
        companyId: input.companyId,
        name: template.nameAr,
        triggerEvent: template.triggerEvent,
      },
    });
    if (existing) {
      throw i18nBadRequest('errors.automation.templateAlreadyInstalled');
    }

    const actions = template.actions.map((raw) => {
      const action = { ...raw } as AutomationActionInput;
      if (
        input.assigneeUserId &&
        (action.type === 'assign_user' ||
          action.type === 'create_task' ||
          action.type === 'create_crm_activity' ||
          action.type === 'notify')
      ) {
        if (!action.userId || String(action.userId).includes('{{')) {
          action.userId = input.assigneeUserId;
        }
        if (!action.assigneeUserId) {
          action.assigneeUserId = input.assigneeUserId;
        }
      }
      return action;
    });

    return this.createRule({
      companyId: input.companyId,
      createdById: input.createdById,
      name: template.nameAr,
      module: template.module,
      triggerEvent: template.triggerEvent,
      conditions: template.conditions,
      actions,
      status: input.activate === false ? 'DRAFT' : 'ACTIVE',
    });
  }

  async installTemplatesBulk(input: {
    companyId: string;
    createdById: string;
    module?: string;
    assigneeUserId?: string;
    activate?: boolean;
  }) {
    const catalog = getAutomationCatalog('ar');
    const templates = AUTOMATION_TEMPLATES.filter(
      (t) =>
        t.phase <= catalog.currentPhase &&
        (!input.module || t.module === input.module),
    );

    const installed: Array<{ code: string; ruleId: string; name: string }> = [];
    const skipped: Array<{ code: string; reason: string }> = [];
    const failed: Array<{ code: string; reason: string }> = [];

    for (const template of templates) {
      try {
        const rule = await this.installTemplate({
          companyId: input.companyId,
          createdById: input.createdById,
          templateCode: template.code,
          assigneeUserId: input.assigneeUserId,
          activate: input.activate,
        });
        installed.push({
          code: template.code,
          ruleId: rule.id,
          name: rule.name,
        });
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : 'install failed';
        if (
          reason.includes('already installed') ||
          reason.includes('Template already')
        ) {
          skipped.push({ code: template.code, reason: 'مثبّت مسبقاً' });
        } else {
          failed.push({ code: template.code, reason });
        }
      }
    }

    return {
      module: input.module ?? 'all',
      installed,
      skipped,
      failed,
      summary: {
        installed: installed.length,
        skipped: skipped.length,
        failed: failed.length,
        total: templates.length,
      },
    };
  }

  async updateRuleStatus(
    companyId: string,
    ruleId: string,
    status: AutomationStatus,
  ) {
    this.tenant.setCompanyId(companyId);
    const rule = await this.prisma.automationRule.findFirst({
      where: { id: ruleId, companyId },
    });
    if (!rule) {
      throw i18nNotFound('errors.automation.ruleNotFound');
    }
    return this.prisma.automationRule.update({
      where: { id: ruleId },
      data: { status },
    });
  }

  listRuns(companyId: string, ruleId?: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.automationRun.findMany({
      where: {
        rule: { companyId },
        ...(ruleId ? { automationRuleId: ruleId } : {}),
      },
      include: {
        rule: {
          select: {
            id: true,
            name: true,
            module: true,
            triggerEvent: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }

  async summary(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const [activeRules, totalRules, recentRuns, failedRuns] = await Promise.all([
      this.prisma.automationRule.count({
        where: { companyId, status: 'ACTIVE' },
      }),
      this.prisma.automationRule.count({ where: { companyId } }),
      this.prisma.automationRun.count({
        where: { rule: { companyId } },
      }),
      this.prisma.automationRun.count({
        where: {
          rule: { companyId },
          status: 'FAILED',
        },
      }),
    ]);
    return { activeRules, totalRules, recentRuns, failedRuns };
  }

  /**
   * Manual execute: run a specific ACTIVE rule via the engine.
   * Uses event `manual` matching OR forces the rule by id.
   */
  
  async executeRule(
    companyId: string,
    ruleId: string,
    trigger?: { entityType?: string; entityId?: string },
  ) {
    this.tenant.setCompanyId(companyId);
    const rule = await this.prisma.automationRule.findFirst({
      where: { id: ruleId, companyId },
    });
    if (!rule) {
      throw i18nNotFound('errors.automation.ruleNotFound');
    }
    if (rule.status !== 'ACTIVE') {
      throw i18nBadRequest('errors.automation.onlyActiveExecutable');
    }

    const runs = await this.engine.dispatch({
      companyId,
      event: rule.triggerEvent === 'manual' ? 'manual' : rule.triggerEvent,
      ruleId: rule.id,
      entityType: trigger?.entityType,
      entityId: trigger?.entityId,
      payload: {
        manual: true,
        entityType: trigger?.entityType,
        entityId: trigger?.entityId,
      },
    });

    if (!runs.length) {
      throw i18nBadRequest('errors.automation.noRunProduced');
    }
    return runs[0];
  }
}
