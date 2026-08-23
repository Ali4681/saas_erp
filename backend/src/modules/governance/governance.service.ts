import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalThresholdAction,
  BreakGlassStatus,
} from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class GovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  listSodRules(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.sodConflictRule.findMany({
      where: {
        isActive: true,
        OR: [{ companyId: null }, { companyId }],
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  listThresholds(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.approvalThreshold.findMany({
      where: { companyId },
      orderBy: [{ actionType: 'asc' }, { maxAmount: 'asc' }],
    });
  }

  async upsertThreshold(
    companyId: string,
    input: {
      id?: string;
      actionType: ApprovalThresholdAction | string;
      maxAmount: string | number;
      currency?: string;
      requiredPermission: string;
      escalatePermission?: string;
      branchId?: string;
      isActive?: boolean;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    const actionType = input.actionType as ApprovalThresholdAction;
    const data = {
      actionType,
      maxAmount: String(input.maxAmount),
      currency: input.currency ?? 'SAR',
      requiredPermission: input.requiredPermission,
      escalatePermission: input.escalatePermission,
      branchId: input.branchId,
      isActive: input.isActive ?? true,
    };
    if (input.id) {
      const existing = await this.prisma.approvalThreshold.findFirst({
        where: { id: input.id, companyId },
      });
      if (!existing) throw new NotFoundException('Threshold not found');
      return this.prisma.approvalThreshold.update({
        where: { id: input.id },
        data,
      });
    }
    return this.prisma.approvalThreshold.create({
      data: { companyId, ...data },
    });
  }

  listPeriodLocks(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.financialPeriodLock.findMany({
      where: { companyId },
      orderBy: { periodStart: 'desc' },
      take: 50,
    });
  }

  async lockPeriod(
    companyId: string,
    lockedByUserId: string,
    input: {
      periodStart: string;
      periodEnd: string;
      backdateUntil?: string;
      notes?: string;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    if (!(periodStart <= periodEnd)) {
      throw new BadRequestException('periodStart must be <= periodEnd');
    }
    return this.prisma.financialPeriodLock.create({
      data: {
        companyId,
        periodStart,
        periodEnd,
        lockedByUserId,
        backdateUntil: input.backdateUntil
          ? new Date(input.backdateUntil)
          : undefined,
        notes: input.notes,
      },
    });
  }

  /**
   * Throws if documentDate falls inside a locked period and user cannot backdate.
   */
  async assertDocumentDateWritable(
    companyId: string,
    documentDate: Date,
    opts?: { allowBackdate?: boolean },
  ) {
    this.tenant.setCompanyId(companyId);
    const d = new Date(documentDate);
    d.setHours(12, 0, 0, 0);
    const locks = await this.prisma.financialPeriodLock.findMany({
      where: {
        companyId,
        periodStart: { lte: d },
        periodEnd: { gte: d },
      },
    });
    if (!locks.length) return;
    const now = new Date();
    for (const lock of locks) {
      if (
        opts?.allowBackdate &&
        lock.backdateUntil &&
        now <= lock.backdateUntil
      ) {
        continue;
      }
      throw new ForbiddenException(
        `Financial period ${lock.periodStart.toISOString().slice(0, 10)}–${lock.periodEnd.toISOString().slice(0, 10)} is locked`,
      );
    }
  }

  listBreakGlass(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.breakGlassSession.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async openBreakGlass(
    companyId: string,
    userId: string,
    input: { reason: string; durationMinutes?: number },
  ) {
    this.tenant.setCompanyId(companyId);
    if (!input.reason?.trim() || input.reason.trim().length < 10) {
      throw new BadRequestException('reason must be at least 10 characters');
    }
    const minutes = Math.min(
      240,
      Math.max(15, input.durationMinutes ?? 60),
    );
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + minutes * 60_000);
    const session = await this.prisma.breakGlassSession.create({
      data: {
        companyId,
        userId,
        reason: input.reason.trim(),
        status: 'ACTIVE',
        startsAt,
        endsAt,
        alertedAt: new Date(),
      },
    });

    // High-priority in-app alerts to owners (best-effort)
    const owners = await this.prisma.companyUser.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        role: { code: 'COMPANY_OWNER' },
      },
      select: { userId: true },
    });
    for (const o of owners) {
      await this.prisma.notification.create({
        data: {
          companyId,
          userId: o.userId,
          type: 'BREAK_GLASS',
          title: 'Emergency access activated',
          body: `Break-glass session opened until ${endsAt.toISOString()}. Reason: ${input.reason.trim()}`,
          actionUrl: `/c/${companyId}/settings/governance`,
          data: { breakGlassSessionId: session.id },
        },
      });
    }
    return session;
  }

  async revokeBreakGlass(
    companyId: string,
    sessionId: string,
    revokedByUserId: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const session = await this.prisma.breakGlassSession.findFirst({
      where: { id: sessionId, companyId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'ACTIVE') {
      throw new BadRequestException('Session is not active');
    }
    return this.prisma.breakGlassSession.update({
      where: { id: sessionId },
      data: {
        status: 'REVOKED' as BreakGlassStatus,
        revokedAt: new Date(),
        revokedByUserId,
      },
    });
  }

  async resolveApprovalRequirement(
    companyId: string,
    actionType: ApprovalThresholdAction | string,
    amount: number,
  ): Promise<{
    canSelfApprove: boolean;
    requiredPermission: string;
    escalatePermission: string | null;
  }> {
    this.tenant.setCompanyId(companyId);
    const thresholds = await this.prisma.approvalThreshold.findMany({
      where: {
        companyId,
        actionType: actionType as ApprovalThresholdAction,
        isActive: true,
      },
      orderBy: { maxAmount: 'asc' },
    });
    if (!thresholds.length) {
      return {
        canSelfApprove: true,
        requiredPermission: 'finance.write',
        escalatePermission: null,
      };
    }
    const match =
      thresholds.find((t) => amount <= Number(t.maxAmount)) ??
      thresholds[thresholds.length - 1]!;
    const needsEscalate = amount > Number(match.maxAmount);
    return {
      canSelfApprove: !needsEscalate,
      requiredPermission: match.requiredPermission,
      escalatePermission: needsEscalate
        ? match.escalatePermission ?? 'finance.write'
        : null,
    };
  }
}
