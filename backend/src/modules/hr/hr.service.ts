import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  AttendanceStatus,
  EmployeeApprovalStatus,
  EmployeeContractKind,
  EmployeeIdentityType,
  EmployeeSalesStatus,
  EmploymentStatus,
  LeaveStatus,
  PayrollStatus,
  Prisma,
  SalesPaymentMethod,
  SalesTargetMode,
} from '../../generated/prisma/client';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { assertValidSaudiIban, normalizeIban } from '../../common/iban';
import { assertValidSaudiIdentity } from '../../common/saudi-identity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { AutomationEngine } from '../automation/automation.engine';
import { PlatformService } from '../platform/platform.service';
import { SalesService } from '../sales/sales.service';

function fingerprintIban(iban: string): string {
  return createHash('sha256').update(normalizeIban(iban)).digest('hex');
}

function mapSalePaymentMethod(
  method: SalesPaymentMethod | string,
): 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'PAYMENT_GATEWAY' | 'OTHER' {
  switch (method) {
    case 'CASH':
      return 'CASH';
    case 'CARD':
      return 'CARD';
    case 'TRANSFER':
      return 'BANK_TRANSFER';
    case 'NETWORK':
      return 'PAYMENT_GATEWAY';
    default:
      return 'OTHER';
  }
}

@Injectable()
export class HrService {
  private readonly logger = new Logger(HrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly encryption: EncryptionService,
    private readonly platform: PlatformService,
    private readonly sales: SalesService,
    @Inject(forwardRef(() => AutomationEngine))
    private readonly automation: AutomationEngine,
  ) {}

  private emit(
    companyId: string,
    event: string,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>,
  ) {
    void this.automation
      .dispatch({ companyId, event, entityType, entityId, payload })
      .catch((error) => {
        this.logger.warn(
          `automation ${event} failed: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      });
  }

  private encryptIban(iban?: string) {
    if (!iban) {
      return {
        ibanCiphertext: null as Uint8Array | null,
        ibanKeyVersion: null as number | null,
        ibanLast4: null as string | null,
        ibanFingerprint: null as string | null,
      };
    }
    let valid: string;
    try {
      valid = assertValidSaudiIban(iban);
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Invalid IBAN',
      );
    }
    const encrypted = this.encryption.encrypt(valid);
    return {
      ibanCiphertext: Uint8Array.from(encrypted.ciphertext),
      ibanKeyVersion: encrypted.keyVersion,
      ibanLast4: valid.slice(-4),
      ibanFingerprint: fingerprintIban(valid),
    };
  }

  private stripSensitiveIban<T extends Record<string, unknown>>(employee: T) {
    const {
      ibanCiphertext: _c,
      ibanFingerprint: _f,
      ibanKeyVersion: _k,
      ...rest
    } = employee as T & {
      ibanCiphertext?: unknown;
      ibanFingerprint?: unknown;
      ibanKeyVersion?: unknown;
    };
    return rest;
  }

  private computeProfileComplete(employee: {
    insuranceAttachmentId?: string | null;
    identityNumber?: string | null;
    ibanLast4?: string | null;
  }) {
    return Boolean(
      employee.insuranceAttachmentId &&
      employee.identityNumber &&
      employee.ibanLast4,
    );
  }

  private docsFlags(employee: {
    insuranceAttachmentId?: string | null;
    identityNumber?: string | null;
    ibanLast4?: string | null;
    qiwaContractUrl?: string | null;
    qiwaContractRef?: string | null;
  }) {
    return {
      hasInsurance: Boolean(employee.insuranceAttachmentId),
      hasIdentity: Boolean(employee.identityNumber),
      hasIban: Boolean(employee.ibanLast4),
      hasQiwa: Boolean(employee.qiwaContractUrl || employee.qiwaContractRef),
      profileComplete: this.computeProfileComplete(employee),
    };
  }

  private currentMonthKey(d = new Date()) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private monthBoundsUtc(month: string) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('month must be YYYY-MM');
    }
    const [y, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    return { start, end };
  }

  /**
   * Earned this month = (basicSalary / 30) × days with PRESENT|LATE|REMOTE.
   * Max advance = earned × (advanceAllowancePercent / 100).
   */
  async computeAdvanceEarnings(
    companyId: string,
    employeeId: string,
    month?: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const employee = await this.requireEmployee(companyId, employeeId);
    const monthKey = month ?? this.currentMonthKey();
    const { start, end } = this.monthBoundsUtc(monthKey);
    const daysWorked = await this.prisma.attendanceRecord.count({
      where: {
        companyId,
        employeeId,
        attendanceDate: { gte: start, lte: end },
        status: { in: ['PRESENT', 'LATE', 'REMOTE'] },
      },
    });
    const basicSalary = Number(employee.basicSalary ?? 0);
    const dailyRate = basicSalary > 0 ? basicSalary / 30 : 0;
    const earnedAmount = dailyRate * daysWorked;
    const percent = Number(employee.advanceAllowancePercent ?? 0);
    const maxAdvanceAmount =
      percent > 0 && earnedAmount > 0 ? (earnedAmount * percent) / 100 : 0;
    const monthAdvances = await this.prisma.salaryAdvance.findMany({
      where: {
        employeeId,
        status: { in: ['PENDING', 'APPROVED', 'PAID'] },
        requestedAt: { gte: start, lte: end },
      },
    });
    const advancesUsed = monthAdvances.reduce(
      (s, a) => s + Number(a.amount),
      0,
    );
    const remainingAdvance = Math.max(0, maxAdvanceAmount - advancesUsed);
    return {
      month: monthKey,
      basicSalary: basicSalary.toFixed(2),
      dailyRate: dailyRate.toFixed(4),
      daysWorked,
      earnedAmount: earnedAmount.toFixed(2),
      advanceAllowancePercent:
        employee.advanceAllowancePercent != null
          ? String(employee.advanceAllowancePercent)
          : null,
      maxAdvanceAmount: maxAdvanceAmount.toFixed(2),
      advancesUsed: advancesUsed.toFixed(2),
      remainingAdvance: remainingAdvance.toFixed(2),
      currency: employee.currency ?? 'SAR',
      formula:
        'earned = (basicSalary/30) × days(PRESENT|LATE|REMOTE); maxAdvance = earned × percent/100',
    };
  }

  /** Monthly target progress from APPROVED sales only (cash counts only after approval). Over 100% allowed. */
  async computeMonthlySalesProgress(companyId: string, employeeId: string) {
    this.tenant.setCompanyId(companyId);
    const employee = await this.requireEmployee(companyId, employeeId);
    const monthKey = this.currentMonthKey();
    const { start, end } = this.monthBoundsUtc(monthKey);
    const approved = await this.prisma.employeeSalesSubmission.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        saleDate: { gte: start, lte: end },
      },
    });
    const approvedSalesSum = approved.reduce((s, r) => s + Number(r.amount), 0);
    const mode = employee.salesTargetMode ?? null;
    const usesAmountTarget =
      mode === 'AMOUNT' ||
      mode === 'BOTH' ||
      (mode == null && employee.salesTargetAmount != null);
    const usesSalesPercent =
      mode === 'PERCENT' ||
      mode === 'BOTH' ||
      (mode == null && employee.targetPercent != null);
    const target =
      usesAmountTarget && employee.salesTargetAmount != null
        ? Number(employee.salesTargetAmount)
        : null;
    const salesPercent = Number(employee.targetPercent ?? 0);
    const salesCommission =
      usesSalesPercent && salesPercent > 0
        ? (approvedSalesSum * salesPercent) / 100
        : 0;
    const targetCompletedPercent =
      target != null && target > 0
        ? (approvedSalesSum / target) * 100
        : Number(employee.targetCompletedPercent ?? 0);
    if (target != null && target > 0) {
      await this.prisma.employee.update({
        where: { id: employeeId },
        data: { targetCompletedPercent: targetCompletedPercent.toFixed(2) },
      });
    }
    return {
      month: monthKey,
      salesTargetMode: mode,
      salesTargetAmount:
        employee.salesTargetAmount != null
          ? String(employee.salesTargetAmount)
          : null,
      targetPercent:
        employee.targetPercent != null ? String(employee.targetPercent) : null,
      approvedSalesSum: approvedSalesSum.toFixed(2),
      salesCommission: salesCommission.toFixed(2),
      targetCompletedPercent: targetCompletedPercent.toFixed(2),
      overTarget: target != null && target > 0 && approvedSalesSum > target,
      currency: employee.currency ?? 'SAR',
    };
  }

  private async enrichEmployeeResponse(
    companyId: string,
    employeeId: string,
    base: Record<string, unknown>,
  ) {
    const [advanceEarnings, salesProgress] = await Promise.all([
      this.computeAdvanceEarnings(companyId, employeeId),
      this.computeMonthlySalesProgress(companyId, employeeId),
    ]);
    return {
      ...base,
      advanceEarnings,
      salesProgress,
      targetCompletedPercent: salesProgress.targetCompletedPercent,
    };
  }

  async listEmployees(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const rows = await this.prisma.employee.findMany({
      orderBy: { fullName: 'asc' },
      take: 200,
      include: {
        ewallet: true,
        _count: { select: { contracts: true, salaryAdvances: true } },
        qiwaContracts: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { status: true },
        },
      },
    });
    return rows.map((row) => {
      const stripped = this.stripSensitiveIban(row);
      const { qiwaContracts: _qc, ...rest } = stripped as Record<
        string,
        unknown
      > & { qiwaContracts?: unknown };
      const latest = row.qiwaContracts[0];
      return {
        ...rest,
        qiwaStatus: latest?.status ?? 'NOT_STARTED',
      };
    });
  }

  async employeeSummary(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const [total, active, onLeave, suspended, terminated, employees] =
      await Promise.all([
        this.prisma.employee.count(),
        this.prisma.employee.count({ where: { employmentStatus: 'ACTIVE' } }),
        this.prisma.employee.count({ where: { employmentStatus: 'ON_LEAVE' } }),
        this.prisma.employee.count({
          where: { employmentStatus: 'SUSPENDED' },
        }),
        this.prisma.employee.count({
          where: { employmentStatus: 'TERMINATED' },
        }),
        this.prisma.employee.findMany({
          where: { companyId },
          select: {
            qiwaContracts: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { status: true },
            },
          },
        }),
      ]);
    const qiwaCounts: Record<string, number> = {
      NOT_STARTED: 0,
      IN_PROGRESS: 0,
      AWAITING_EMPLOYEE: 0,
      PENDING_APPROVAL: 0,
      DOCUMENTED: 0,
      REJECTED_OR_MODIFICATION: 0,
    };
    for (const emp of employees) {
      const status = emp.qiwaContracts[0]?.status ?? 'NOT_STARTED';
      qiwaCounts[status] = (qiwaCounts[status] ?? 0) + 1;
    }
    return {
      total,
      active,
      onLeave,
      suspended,
      terminated,
      qiwa: qiwaCounts,
    };
  }

  async getEmployee(companyId: string, employeeId: string) {
    this.tenant.setCompanyId(companyId);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      include: {
        ewallet: true,
        contracts: { orderBy: { createdAt: 'desc' } },
        shiftAssignments: {
          include: { shift: true },
          orderBy: { effectiveFrom: 'desc' },
        },
        salesSubmissions: {
          orderBy: { saleDate: 'desc' },
          take: 50,
        },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    const stripped = this.stripSensitiveIban(employee);
    return this.enrichEmployeeResponse(companyId, employeeId, {
      ...stripped,
      ...this.docsFlags(employee),
    });
  }

  async createEmployee(input: {
    companyId: string;
    employeeNumber: string;
    fullName: string;
    identityType: EmployeeIdentityType | 'RESIDENT' | 'CITIZEN';
    identityNumber: string;
    identityExpiresOn?: string;
    iban?: string;
    ibanBankName?: string;
    salesTargetMode?: SalesTargetMode | 'PERCENT' | 'AMOUNT' | 'BOTH';
    salesTargetAmount?: string | number;
    lateHourRate?: string | number;
    advanceAllowancePercent?: string | number;
    advanceAllowanceMonthly?: string | number;
    advanceAllowanceMonth?: string;
    attendanceBadgeId?: string;
    approvalStatus?:
      EmployeeApprovalStatus | 'PENDING' | 'APPROVED' | 'REJECTED';
    userId?: string;
    companyBranchId?: string;
    companyDepartmentId?: string;
    email?: string;
    phone?: string;
    jobTitle?: string;
    hireDate?: string;
    basicSalary?: string | number;
    targetPercent?: string | number;
    targetCompletedPercent?: string | number;
    absenceDiscountPerDay?: string | number;
    lateDiscountAmount?: string | number;
    isPurchaseOperator?: boolean;
    currency?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    if (!input.identityType) {
      throw new BadRequestException('identityType is required');
    }
    if (!input.identityNumber?.trim()) {
      throw new BadRequestException('identityNumber is required');
    }
    let identityNumber: string;
    try {
      identityNumber = assertValidSaudiIdentity(
        input.identityNumber,
        input.identityType === 'CITIZEN' ? 'CITIZEN' : 'RESIDENT',
      );
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Invalid identity number',
      );
    }
    if (input.basicSalary != null && Number(input.basicSalary) < 0) {
      throw new BadRequestException('basicSalary must be >= 0');
    }
    if (input.targetPercent != null) {
      const tp = Number(input.targetPercent);
      if (tp < 0 || tp > 100) {
        throw new BadRequestException(
          'targetPercent must be between 0 and 100',
        );
      }
    }
    if (input.targetCompletedPercent != null) {
      const tcp = Number(input.targetCompletedPercent);
      if (tcp < 0) {
        throw new BadRequestException(
          'targetCompletedPercent must be >= 0 (over 100% allowed)',
        );
      }
    }
    if (input.advanceAllowancePercent != null) {
      const p = Number(input.advanceAllowancePercent);
      if (p < 0 || p > 100) {
        throw new BadRequestException(
          'advanceAllowancePercent must be between 0 and 100',
        );
      }
    }
    if (
      input.advanceAllowanceMonth &&
      !/^\d{4}-\d{2}$/.test(input.advanceAllowanceMonth)
    ) {
      throw new BadRequestException('advanceAllowanceMonth must be YYYY-MM');
    }
    if (input.userId) {
      const existing = await this.prisma.employee.findFirst({
        where: { companyId: input.companyId, userId: input.userId },
      });
      if (existing) {
        throw new BadRequestException('User is already linked to an employee');
      }
    }
    const ibanData = this.encryptIban(input.iban?.trim() || undefined);
    const basic =
      input.basicSalary != null && Number(input.basicSalary) >= 0
        ? Number(input.basicSalary)
        : null;
    const dailyDefault =
      basic != null && basic > 0 ? (basic / 30).toFixed(2) : undefined;
    const created = await this.prisma.employee.create({
      data: {
        companyId: input.companyId,
        employeeNumber: input.employeeNumber,
        fullName: input.fullName,
        userId: input.userId,
        userKey: input.userId ?? '',
        companyBranchId: input.companyBranchId,
        companyDepartmentId: input.companyDepartmentId,
        email: input.email,
        phone: input.phone,
        jobTitle: input.jobTitle,
        hireDate: input.hireDate ? new Date(input.hireDate) : undefined,
        basicSalary: basic != null ? String(basic) : undefined,
        targetPercent:
          input.targetPercent != null ? String(input.targetPercent) : undefined,
        targetCompletedPercent:
          input.targetCompletedPercent != null
            ? String(input.targetCompletedPercent)
            : undefined,
        absenceDiscountPerDay:
          input.absenceDiscountPerDay != null
            ? String(input.absenceDiscountPerDay)
            : dailyDefault,
        lateDiscountAmount:
          input.lateDiscountAmount != null
            ? String(input.lateDiscountAmount)
            : dailyDefault,
        isPurchaseOperator: Boolean(input.isPurchaseOperator),
        currency: input.currency ?? 'SAR',
        identityType: input.identityType,
        identityNumber,
        identityExpiresOn: input.identityExpiresOn
          ? new Date(input.identityExpiresOn)
          : undefined,
        ibanBankName: input.ibanBankName,
        ...ibanData,
        approvalStatus:
          (input.approvalStatus as EmployeeApprovalStatus) ?? 'PENDING',
        salesTargetMode: input.salesTargetMode,
        salesTargetAmount:
          input.salesTargetAmount != null
            ? String(input.salesTargetAmount)
            : undefined,
        lateHourRate:
          input.lateHourRate != null ? String(input.lateHourRate) : undefined,
        advanceAllowancePercent:
          input.advanceAllowancePercent != null
            ? String(input.advanceAllowancePercent)
            : undefined,
        advanceAllowanceMonthly:
          input.advanceAllowanceMonthly != null
            ? String(input.advanceAllowanceMonthly)
            : undefined,
        advanceAllowanceMonth: input.advanceAllowanceMonth,
        attendanceBadgeId: input.attendanceBadgeId?.trim() || undefined,
      } as Prisma.EmployeeUncheckedCreateInput,
    });
    return this.stripSensitiveIban(created);
  }

  async updateEmployee(
    companyId: string,
    employeeId: string,
    input: {
      // personal
      identityType?: EmployeeIdentityType | 'RESIDENT' | 'CITIZEN';
      identityNumber?: string;
      identityExpiresOn?: string | null;
      phone?: string;
      email?: string;
      jobTitle?: string;
      approvalStatus?:
        EmployeeApprovalStatus | 'PENDING' | 'APPROVED' | 'REJECTED';
      // financial
      basicSalary?: string | number;
      iban?: string;
      ibanBankName?: string;
      lateHourRate?: string | number;
      lateDiscountAmount?: string | number;
      advanceAllowancePercent?: string | number;
      advanceAllowanceMonthly?: string | number;
      advanceAllowanceMonth?: string;
      attendanceBadgeId?: string | null;
      targetPercent?: string | number;
      targetCompletedPercent?: string | number;
      salesTargetMode?: SalesTargetMode | 'PERCENT' | 'AMOUNT' | 'BOTH' | null;
      salesTargetAmount?: string | number | null;
      absenceDiscountPerDay?: string | number;
      isPurchaseOperator?: boolean;
      // compliance
      qiwaContractUrl?: string | null;
      qiwaContractRef?: string | null;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    await this.requireEmployee(companyId, employeeId);
    if (input.targetPercent != null) {
      const tp = Number(input.targetPercent);
      if (tp < 0 || tp > 100) {
        throw new BadRequestException(
          'targetPercent must be between 0 and 100',
        );
      }
    }
    if (input.targetCompletedPercent != null) {
      const tcp = Number(input.targetCompletedPercent);
      if (tcp < 0) {
        throw new BadRequestException(
          'targetCompletedPercent must be >= 0 (over 100% allowed)',
        );
      }
    }
    if (input.advanceAllowancePercent != null) {
      const p = Number(input.advanceAllowancePercent);
      if (p < 0 || p > 100) {
        throw new BadRequestException(
          'advanceAllowancePercent must be between 0 and 100',
        );
      }
    }
    if (
      input.advanceAllowanceMonth &&
      !/^\d{4}-\d{2}$/.test(input.advanceAllowanceMonth)
    ) {
      throw new BadRequestException('advanceAllowanceMonth must be YYYY-MM');
    }

    let identityNumberUpdate: string | undefined;
    if (input.identityNumber !== undefined || input.identityType != null) {
      const current = await this.prisma.employee.findFirst({
        where: { id: employeeId, companyId },
        select: { identityType: true, identityNumber: true },
      });
      const kind =
        (input.identityType ?? current?.identityType) === 'CITIZEN'
          ? 'CITIZEN'
          : 'RESIDENT';
      const raw =
        input.identityNumber !== undefined
          ? input.identityNumber
          : current?.identityNumber;
      if (raw?.trim()) {
        try {
          identityNumberUpdate = assertValidSaudiIdentity(raw, kind);
        } catch (e) {
          throw new BadRequestException(
            e instanceof Error ? e.message : 'Invalid identity number',
          );
        }
      }
    }

    const ibanData =
      input.iban !== undefined
        ? this.encryptIban(input.iban?.trim() || undefined)
        : null;
    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...(input.identityType != null
          ? { identityType: input.identityType }
          : {}),
        ...(identityNumberUpdate !== undefined
          ? { identityNumber: identityNumberUpdate }
          : input.identityNumber !== undefined && !input.identityNumber.trim()
            ? { identityNumber: null }
            : {}),
        ...(input.identityExpiresOn !== undefined
          ? {
              identityExpiresOn: input.identityExpiresOn
                ? new Date(input.identityExpiresOn)
                : null,
            }
          : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
        ...(input.approvalStatus != null
          ? { approvalStatus: input.approvalStatus }
          : {}),
        ...(input.basicSalary != null
          ? { basicSalary: String(input.basicSalary) }
          : {}),
        ...(input.ibanBankName !== undefined
          ? { ibanBankName: input.ibanBankName }
          : {}),
        ...(ibanData ?? {}),
        ...(input.lateHourRate != null
          ? { lateHourRate: String(input.lateHourRate) }
          : {}),
        ...(input.lateDiscountAmount != null
          ? { lateDiscountAmount: String(input.lateDiscountAmount) }
          : {}),
        ...(input.advanceAllowancePercent != null
          ? {
              advanceAllowancePercent: String(input.advanceAllowancePercent),
            }
          : {}),
        ...(input.advanceAllowanceMonthly != null
          ? { advanceAllowanceMonthly: String(input.advanceAllowanceMonthly) }
          : {}),
        ...(input.advanceAllowanceMonth !== undefined
          ? { advanceAllowanceMonth: input.advanceAllowanceMonth }
          : {}),
        ...(input.attendanceBadgeId !== undefined
          ? {
              attendanceBadgeId: input.attendanceBadgeId?.trim() || null,
            }
          : {}),
        ...(input.targetPercent != null
          ? { targetPercent: String(input.targetPercent) }
          : {}),
        ...(input.targetCompletedPercent != null
          ? { targetCompletedPercent: String(input.targetCompletedPercent) }
          : {}),
        ...(input.salesTargetMode !== undefined
          ? {
              salesTargetMode: input.salesTargetMode,
            }
          : {}),
        ...(input.salesTargetAmount !== undefined
          ? {
              salesTargetAmount:
                input.salesTargetAmount != null
                  ? String(input.salesTargetAmount)
                  : null,
            }
          : {}),
        ...(input.absenceDiscountPerDay != null
          ? { absenceDiscountPerDay: String(input.absenceDiscountPerDay) }
          : {}),
        ...(input.isPurchaseOperator != null
          ? { isPurchaseOperator: input.isPurchaseOperator }
          : {}),
        ...(input.qiwaContractUrl !== undefined
          ? { qiwaContractUrl: input.qiwaContractUrl }
          : {}),
        ...(input.qiwaContractRef !== undefined
          ? { qiwaContractRef: input.qiwaContractRef }
          : {}),
      } as Prisma.EmployeeUncheckedUpdateInput,
    });
    return this.stripSensitiveIban(updated);
  }

  async updateEmployeeStatus(
    companyId: string,
    employeeId: string,
    employmentStatus: EmploymentStatus,
  ) {
    this.tenant.setCompanyId(companyId);
    await this.requireEmployee(companyId, employeeId);
    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: { employmentStatus },
    });
    return this.stripSensitiveIban(updated);
  }

  async uploadInsurance(
    companyId: string,
    employeeId: string,
    userId: string,
    input: {
      fileName: string;
      mimeType: string;
      sizeBytes: number | string;
      contentBase64?: string;
      checksumSha256?: string;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    await this.requireEmployee(companyId, employeeId);
    const attachment = await this.platform.registerAttachment({
      companyId,
      uploadedById: userId,
      entityType: 'employee_insurance',
      entityId: employeeId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      contentBase64: input.contentBase64,
      checksumSha256: input.checksumSha256,
    });
    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: { insuranceAttachmentId: attachment.id },
    });
    return {
      attachment,
      employee: this.stripSensitiveIban(updated),
    };
  }

  async setAdvanceAllowance(
    companyId: string,
    employeeId: string,
    input: {
      month?: string;
      amount?: string | number;
      percent?: string | number;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    await this.requireEmployee(companyId, employeeId);
    if (input.percent == null && input.amount == null) {
      throw new BadRequestException('percent or amount is required');
    }
    const data: Prisma.EmployeeUncheckedUpdateInput = {};
    if (input.percent != null) {
      const percent = Number(input.percent);
      if (percent < 0 || percent > 100) {
        throw new BadRequestException('percent must be between 0 and 100');
      }
      data.advanceAllowancePercent = percent.toFixed(2);
    }
    if (input.amount != null) {
      const amount = Number(input.amount);
      if (!(amount >= 0)) {
        throw new BadRequestException('amount must be >= 0');
      }
      const month = input.month ?? this.currentMonthKey();
      if (!/^\d{4}-\d{2}$/.test(month)) {
        throw new BadRequestException('month must be YYYY-MM');
      }
      data.advanceAllowanceMonth = month;
      data.advanceAllowanceMonthly = amount.toFixed(2);
    }
    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data,
    });
    const earnings = await this.computeAdvanceEarnings(companyId, employeeId);
    return {
      ...this.stripSensitiveIban(updated),
      advanceEarnings: earnings,
    };
  }

  async setQiwa(
    companyId: string,
    employeeId: string,
    input: { url?: string; ref?: string },
  ) {
    this.tenant.setCompanyId(companyId);
    await this.requireEmployee(companyId, employeeId);
    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...(input.url !== undefined ? { qiwaContractUrl: input.url } : {}),
        ...(input.ref !== undefined ? { qiwaContractRef: input.ref } : {}),
      },
    });
    return this.stripSensitiveIban(updated);
  }

  listAttendance(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.attendanceRecord.findMany({
      include: { employee: { select: { id: true, fullName: true } } },
      orderBy: { attendanceDate: 'desc' },
      take: 200,
    });
  }

  async upsertAttendance(input: {
    companyId: string;
    employeeId: string;
    attendanceDate: string;
    status: AttendanceStatus;
    checkInAt?: string;
    checkOutAt?: string;
    workedMinutes?: number;
    source?: string;
    notes?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.requireEmployee(input.companyId, input.employeeId);
    const attendanceDate = new Date(input.attendanceDate);
    if (
      input.checkInAt &&
      input.checkOutAt &&
      new Date(input.checkOutAt) < new Date(input.checkInAt)
    ) {
      throw new BadRequestException('checkOutAt must be >= checkInAt');
    }

    return this.prisma.attendanceRecord
      .upsert({
        where: {
          employeeId_attendanceDate: {
            employeeId: input.employeeId,
            attendanceDate,
          },
        },
        create: {
          companyId: input.companyId,
          employeeId: input.employeeId,
          attendanceDate,
          status: input.status,
          checkInAt: input.checkInAt ? new Date(input.checkInAt) : undefined,
          checkOutAt: input.checkOutAt ? new Date(input.checkOutAt) : undefined,
          workedMinutes: input.workedMinutes,
          source: input.source,
          notes: input.notes,
        },
        update: {
          status: input.status,
          checkInAt: input.checkInAt ? new Date(input.checkInAt) : undefined,
          checkOutAt: input.checkOutAt ? new Date(input.checkOutAt) : undefined,
          workedMinutes: input.workedMinutes,
          source: input.source,
          notes: input.notes,
        },
      })
      .then(async (row) => {
        if (input.status === 'ABSENT') {
          const employee = await this.prisma.employee.findFirst({
            where: { id: input.employeeId, companyId: input.companyId },
            select: { id: true, fullName: true, userId: true },
          });
          this.emit(
            input.companyId,
            'hr.attendance.absence',
            'attendance',
            row.id,
            {
              attendanceId: row.id,
              employeeId: input.employeeId,
              employeeName: employee?.fullName,
              userId: employee?.userId,
              attendanceDate: attendanceDate.toISOString(),
              status: input.status,
            },
          );
        }
        return row;
      });
  }

  listLeaves(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.leaveRequest.findMany({
      include: { employee: { select: { id: true, fullName: true } } },
      orderBy: { startsOn: 'desc' },
      take: 100,
    });
  }

  async createLeave(input: {
    companyId: string;
    employeeId: string;
    leaveType: string;
    startsOn: string;
    endsOn: string;
    requestedDays: string | number;
    reason: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.requireEmployee(input.companyId, input.employeeId);
    const reason = input.reason?.trim() ?? '';
    if (reason.length < 1) {
      throw new BadRequestException('reason is required');
    }
    const startsOn = new Date(input.startsOn);
    const endsOn = new Date(input.endsOn);
    if (endsOn < startsOn) {
      throw new BadRequestException('endsOn must be >= startsOn');
    }
    const days = Number(input.requestedDays);
    if (!(days > 0)) {
      throw new BadRequestException('requestedDays must be > 0');
    }
    return this.prisma.leaveRequest.create({
      data: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        leaveType: input.leaveType,
        startsOn,
        endsOn,
        requestedDays: days.toFixed(2),
        reason,
      },
    });
  }

  async decideLeave(
    companyId: string,
    leaveId: string,
    status: LeaveStatus,
    approvedById: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id: leaveId, companyId },
    });
    if (!leave) {
      throw new NotFoundException('Leave request not found');
    }
    if (!['APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
      throw new BadRequestException('Invalid leave decision status');
    }
    const previousStatus = leave.status;
    const updated = await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status,
        approvedById: status === 'APPROVED' ? approvedById : leave.approvedById,
        decidedAt: new Date(),
      },
      include: {
        employee: {
          select: { id: true, fullName: true, userId: true },
        },
      },
    });

    if (status === 'APPROVED' && previousStatus !== 'APPROVED') {
      this.emit(companyId, 'hr.leave.approved', 'leave_request', updated.id, {
        leaveId: updated.id,
        employeeId: updated.employeeId,
        employeeName: updated.employee.fullName,
        userId: updated.employee.userId,
        leaveType: updated.leaveType,
        requestedDays: Number(updated.requestedDays),
        startsOn: updated.startsOn.toISOString(),
        endsOn: updated.endsOn.toISOString(),
        approvedById,
      });
    }

    return updated;
  }

  listPayrollRuns(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.payrollRun.findMany({
      include: { items: true },
      orderBy: { periodStart: 'desc' },
      take: 50,
    });
  }

  async createPayrollRun(input: {
    companyId: string;
    createdById: string;
    periodStart: string;
    periodEnd: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    if (periodEnd < periodStart) {
      throw new BadRequestException('periodEnd must be >= periodStart');
    }

    const employees = await this.prisma.employee.findMany({
      where: { employmentStatus: 'ACTIVE' },
    });

    await this.markMissingDaysAbsent(
      input.companyId,
      employees.map((e) => e.id),
      periodStart,
      periodEnd,
    );

    const attendance = await this.prisma.attendanceRecord.findMany({
      where: {
        attendanceDate: { gte: periodStart, lte: periodEnd },
        status: { in: ['ABSENT', 'LATE'] },
      },
    });
    const advances = await this.prisma.salaryAdvance.findMany({
      where: {
        status: { in: ['APPROVED', 'PAID'] },
        requestedAt: { gte: periodStart, lte: periodEnd },
      },
    });

    const approvedSales = await this.prisma.employeeSalesSubmission.findMany({
      where: {
        companyId: input.companyId,
        status: 'APPROVED',
        saleDate: { gte: periodStart, lte: periodEnd },
      },
      select: { employeeId: true, amount: true },
    });
    const approvedSalesByEmployee = new Map<string, number>();
    for (const row of approvedSales) {
      approvedSalesByEmployee.set(
        row.employeeId,
        (approvedSalesByEmployee.get(row.employeeId) ?? 0) + Number(row.amount),
      );
    }

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    const items = employees.map((employee) => {
      const basic = Number(employee.basicSalary ?? 0);
      const allowances = 0;
      const mode = employee.salesTargetMode ?? null;
      const salesPct = Number(employee.targetPercent ?? 0);
      const usesSalesPercent =
        mode === 'PERCENT' ||
        mode === 'BOTH' ||
        (mode == null && salesPct > 0);
      const approvedSum = approvedSalesByEmployee.get(employee.id) ?? 0;
      // Commission = % of approved employee sales in the payroll period
      const bonuses =
        usesSalesPercent && salesPct > 0
          ? (approvedSum * salesPct) / 100
          : 0;
      const dailyAbsence =
        Number(employee.absenceDiscountPerDay ?? 0) ||
        (basic > 0 ? basic / 30 : 0);
      const lateFee =
        Number(employee.lateDiscountAmount ?? 0) ||
        (basic > 0 ? basic / 30 : 0);
      const lateHourRate =
        employee.lateHourRate != null ? Number(employee.lateHourRate) : null;
      const empAttendance = attendance.filter(
        (a) => a.employeeId === employee.id,
      );
      const absentDays = empAttendance.filter(
        (a) => a.status === 'ABSENT',
      ).length;
      const lateRecords = empAttendance.filter((a) => a.status === 'LATE');
      const lateDays = lateRecords.length;
      const absenceDeduction = absentDays * dailyAbsence;
      let lateDeduction = 0;
      if (lateHourRate != null && Number.isFinite(lateHourRate)) {
        for (const record of lateRecords) {
          let lateHours = 1;
          if (record.checkInAt) {
            const workStart = new Date(record.attendanceDate);
            workStart.setHours(9, 0, 0, 0);
            lateHours = Math.max(
              0,
              (record.checkInAt.getTime() - workStart.getTime()) / 3600000,
            );
          }
          lateDeduction += lateHourRate * lateHours;
        }
      } else {
        lateDeduction = lateDays * lateFee;
      }
      const deductions = absenceDeduction + lateDeduction;
      const advanceSum = advances
        .filter((a) => a.employeeId === employee.id)
        .reduce((s, a) => s + Number(a.amount), 0);
      const net = basic + allowances + bonuses - deductions - advanceSum;
      totalGross += basic + allowances + bonuses;
      totalDeductions += deductions + advanceSum;
      totalNet += net;
      return {
        employeeId: employee.id,
        basicSalary: basic.toFixed(2),
        allowances: allowances.toFixed(2),
        bonuses: bonuses.toFixed(2),
        deductions: deductions.toFixed(2),
        advances: advanceSum.toFixed(2),
        netAmount: net.toFixed(2),
      };
    });

    return this.prisma.payrollRun.create({
      data: {
        companyId: input.companyId,
        periodStart,
        periodEnd,
        status: 'CALCULATED',
        totalGross: totalGross.toFixed(2),
        totalDeductions: totalDeductions.toFixed(2),
        totalNet: totalNet.toFixed(2),
        processedAt: new Date(),
        createdById: input.createdById,
        items: { create: items },
      },
      include: { items: true },
    });
  }

  async updatePayrollStatus(
    companyId: string,
    payrollRunId: string,
    status: PayrollStatus,
  ) {
    this.tenant.setCompanyId(companyId);
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: payrollRunId, companyId },
    });
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }
    return this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status },
      include: { items: true },
    });
  }

  // —— Contracts ——
  listContracts(companyId: string, employeeId?: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.employeeContract.findMany({
      where: employeeId ? { employeeId } : undefined,
      include: {
        employee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createContract(input: {
    companyId: string;
    employeeId: string;
    title: string;
    contractNumber?: string;
    contractKind?: EmployeeContractKind | 'EMPLOYMENT' | 'LOAN';
    externalPlatform?: string;
    externalRef?: string;
    startsOn?: string;
    endsOn?: string;
    baseSalary?: string | number;
    targetPercent?: string | number;
    notes?: string;
    submitNow?: boolean;
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.requireEmployee(input.companyId, input.employeeId);
    const contract = await this.prisma.employeeContract.create({
      data: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        title: input.title,
        contractNumber: input.contractNumber,
        contractKind:
          (input.contractKind as EmployeeContractKind) ?? 'EMPLOYMENT',
        externalPlatform: input.externalPlatform,
        externalRef: input.externalRef,
        startsOn: input.startsOn ? new Date(input.startsOn) : undefined,
        endsOn: input.endsOn ? new Date(input.endsOn) : undefined,
        baseSalary:
          input.baseSalary != null ? String(input.baseSalary) : undefined,
        targetPercent:
          input.targetPercent != null ? String(input.targetPercent) : undefined,
        notes: input.notes,
      },
    });
    if (input.submitNow) {
      return this.submitContract(input.companyId, contract.id);
    }
    return contract;
  }

  async updateContract(
    companyId: string,
    contractId: string,
    input: {
      title?: string;
      contractNumber?: string;
      startsOn?: string;
      endsOn?: string;
      baseSalary?: string | number;
      targetPercent?: string | number;
      notes?: string;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    const contract = await this.prisma.employeeContract.findFirst({
      where: { id: contractId, companyId },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (!['DRAFT', 'SUBMITTED'].includes(contract.status)) {
      throw new BadRequestException(
        'Only draft/submitted contracts can be edited',
      );
    }
    return this.prisma.employeeContract.update({
      where: { id: contractId },
      data: {
        ...(input.title != null ? { title: input.title } : {}),
        ...(input.contractNumber !== undefined
          ? { contractNumber: input.contractNumber }
          : {}),
        ...(input.startsOn !== undefined
          ? { startsOn: input.startsOn ? new Date(input.startsOn) : null }
          : {}),
        ...(input.endsOn !== undefined
          ? { endsOn: input.endsOn ? new Date(input.endsOn) : null }
          : {}),
        ...(input.baseSalary != null
          ? { baseSalary: String(input.baseSalary) }
          : {}),
        ...(input.targetPercent != null
          ? { targetPercent: String(input.targetPercent) }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
  }

  async submitContract(companyId: string, contractId: string) {
    this.tenant.setCompanyId(companyId);
    const contract = await this.prisma.employeeContract.findFirst({
      where: { id: contractId, companyId },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (!['DRAFT', 'SUBMITTED'].includes(contract.status)) {
      throw new BadRequestException('Contract cannot be submitted');
    }
    const updated = await this.prisma.employeeContract.update({
      where: { id: contractId },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });
    if (updated.baseSalary != null || updated.targetPercent != null) {
      await this.prisma.employee.update({
        where: { id: updated.employeeId },
        data: {
          ...(updated.baseSalary != null
            ? { basicSalary: updated.baseSalary }
            : {}),
          ...(updated.targetPercent != null
            ? { targetPercent: updated.targetPercent }
            : {}),
        },
      });
    }
    const active = await this.prisma.employeeContract.update({
      where: { id: contractId },
      data: { status: 'ACTIVE' },
    });
    if (
      active.contractKind === 'EMPLOYMENT' ||
      active.contractKind === 'LOAN'
    ) {
      await this.prisma.employee.update({
        where: { id: active.employeeId },
        data: { approvalStatus: 'APPROVED' },
      });
    }
    return active;
  }

  // —— Salary advances ——
  listAdvances(companyId: string, employeeId?: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.salaryAdvance.findMany({
      where: employeeId ? { employeeId } : undefined,
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
            fullName: true,
            employeeNumber: true,
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
      take: 200,
    });
  }

  async requestAdvance(input: {
    companyId: string;
    employeeId: string;
    amount: string | number;
    reason?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const employee = await this.requireEmployee(
      input.companyId,
      input.employeeId,
    );
    const amount = Number(input.amount);
    if (!(amount > 0)) {
      throw new BadRequestException('amount must be > 0');
    }
    const earnings = await this.computeAdvanceEarnings(
      input.companyId,
      input.employeeId,
    );
    const percent = Number(earnings.advanceAllowancePercent ?? 0);
    if (percent > 0) {
      const maxAdvance = Number(earnings.maxAdvanceAmount);
      const used = Number(earnings.advancesUsed);
      if (used + amount > maxAdvance + 0.001) {
        throw new BadRequestException(
          `Advance exceeds allowance from earnings (earned ${earnings.earnedAmount}, ${percent}% → max ${maxAdvance.toFixed(2)}, already ${used.toFixed(2)})`,
        );
      }
    } else if (
      employee.advanceAllowanceMonthly != null &&
      employee.advanceAllowanceMonth === earnings.month
    ) {
      const allowance = Number(employee.advanceAllowanceMonthly);
      const used = Number(earnings.advancesUsed);
      if (used + amount > allowance) {
        throw new BadRequestException(
          `Advance exceeds monthly allowance (allowance ${allowance.toFixed(2)}, already ${used.toFixed(2)})`,
        );
      }
    } else {
      const salary = Number(employee.basicSalary ?? 0);
      if (salary <= 0) {
        throw new BadRequestException(
          'Employee has no basic salary configured',
        );
      }
      const openAdvances = await this.prisma.salaryAdvance.findMany({
        where: {
          employeeId: employee.id,
          status: { in: ['PENDING', 'APPROVED'] },
        },
      });
      const openTotal = openAdvances.reduce((s, a) => s + Number(a.amount), 0);
      if (openTotal + amount > salary) {
        throw new BadRequestException(
          `Advance exceeds remaining salary capacity (salary ${salary.toFixed(2)}, already ${openTotal.toFixed(2)})`,
        );
      }
    }

    return this.prisma.salaryAdvance.create({
      data: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        amount: amount.toFixed(2),
        currency: employee.currency ?? 'SAR',
        reason: input.reason,
      },
    });
  }

  async decideAdvance(
    companyId: string,
    advanceId: string,
    status: 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED',
    decidedById: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const advance = await this.prisma.salaryAdvance.findFirst({
      where: { id: advanceId, companyId },
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
            employeeNumber: true,
            currency: true,
          },
        },
      },
    });
    if (!advance) throw new NotFoundException('Advance not found');

    // No self-approval / self-decision: HR (or any approver) cannot act on their own advance.
    if (advance.employee.userId && advance.employee.userId === decidedById) {
      throw new ForbiddenException(
        'You cannot approve or decide an advance for yourself',
      );
    }

    const becomingApproved =
      status === 'APPROVED' &&
      advance.status !== 'APPROVED' &&
      advance.status !== 'PAID';
    const becomingPaid = status === 'PAID' && advance.status !== 'PAID';
    // Credit wallet on approval; if jumping straight to PAID, credit once then.
    const shouldCreditWallet =
      becomingApproved || (becomingPaid && advance.status !== 'APPROVED');

    const updated = await this.prisma.salaryAdvance.update({
      where: { id: advanceId },
      data: {
        status,
        decidedById,
        decidedAt: new Date(),
        ...(status === 'PAID' ? { paidAt: new Date() } : {}),
      },
    });

    if (shouldCreditWallet) {
      const amount = Number(advance.amount);
      const code = `EW-${advance.employee.employeeNumber}`.slice(0, 40);
      const wallet = await this.prisma.employeeEwallet.findUnique({
        where: { employeeId: advance.employeeId },
      });
      if (wallet) {
        await this.prisma.employeeEwallet.update({
          where: { employeeId: advance.employeeId },
          data: {
            balance: (Number(wallet.balance) + amount).toFixed(2),
            status: 'ACTIVE',
          },
        });
      } else {
        await this.prisma.employeeEwallet.create({
          data: {
            companyId,
            employeeId: advance.employeeId,
            walletCode: code,
            balance: amount.toFixed(2),
            currency: advance.employee.currency ?? advance.currency ?? 'SAR',
          },
        });
      }
    }

    return updated;
  }

  // —— E-wallets / purchase operators ——
  listPurchaseOperators(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.employee
      .findMany({
        where: { isPurchaseOperator: true },
        include: { ewallet: true },
        orderBy: { fullName: 'asc' },
      })
      .then((rows) =>
        rows.map((row) =>
          this.stripSensitiveIban(row as unknown as Record<string, unknown>),
        ),
      );
  }

  async upsertEwallet(input: {
    companyId: string;
    employeeId: string;
    walletCode?: string;
    balance?: string | number;
    currency?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const employee = await this.requireEmployee(
      input.companyId,
      input.employeeId,
    );
    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { isPurchaseOperator: true },
    });
    const code =
      input.walletCode?.trim() || `EW-${employee.employeeNumber}`.slice(0, 40);
    return this.prisma.employeeEwallet.upsert({
      where: { employeeId: employee.id },
      create: {
        companyId: input.companyId,
        employeeId: employee.id,
        walletCode: code,
        balance: String(input.balance ?? 0),
        currency: input.currency ?? employee.currency ?? 'SAR',
      },
      update: {
        ...(input.walletCode ? { walletCode: code } : {}),
        ...(input.balance != null ? { balance: String(input.balance) } : {}),
        ...(input.currency ? { currency: input.currency } : {}),
        status: 'ACTIVE',
      },
    });
  }

  // —— Shifts ——
  listShifts(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.workShift.findMany({
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  createShift(input: {
    companyId: string;
    name: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    isActive?: boolean;
  }) {
    this.tenant.setCompanyId(input.companyId);
    return this.prisma.workShift.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        startTime: input.startTime,
        endTime: input.endTime,
        breakMinutes: input.breakMinutes ?? 0,
        isActive: input.isActive ?? true,
      },
    });
  }

  async assignEmployeeShift(
    companyId: string,
    employeeId: string,
    input: { shiftId: string; effectiveFrom: string; effectiveTo?: string },
  ) {
    this.tenant.setCompanyId(companyId);
    await this.requireEmployee(companyId, employeeId);
    const shift = await this.prisma.workShift.findFirst({
      where: { id: input.shiftId, companyId },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    return this.prisma.employeeShiftAssignment.create({
      data: {
        companyId,
        employeeId,
        shiftId: input.shiftId,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo
          ? new Date(input.effectiveTo)
          : undefined,
      },
      include: { shift: true },
    });
  }

  // —— Sales submissions ——
  listPayableInvoices(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.salesInvoice.findMany({
      where: {
        companyId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
        balanceDue: { gt: 0 },
      },
      select: {
        id: true,
        invoiceNumber: true,
        balanceDue: true,
        totalAmount: true,
        currency: true,
        status: true,
        issuedOn: true,
        contact: { select: { id: true, name: true } },
      },
      orderBy: { issuedOn: 'desc' },
      take: 100,
    });
  }

  async submitSale(input: {
    companyId: string;
    employeeId: string;
    saleDate: string;
    amount: string | number;
    paymentMethod:
      SalesPaymentMethod | 'CASH' | 'CARD' | 'TRANSFER' | 'NETWORK';
    invoiceNumber?: string;
    salesInvoiceId?: string;
    notes?: string;
    receiptAttachmentId?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.requireEmployee(input.companyId, input.employeeId);

    let invoice =
      input.salesInvoiceId != null && input.salesInvoiceId.trim()
        ? await this.prisma.salesInvoice.findFirst({
            where: {
              id: input.salesInvoiceId.trim(),
              companyId: input.companyId,
            },
          })
        : null;
    if (!invoice && input.invoiceNumber?.trim()) {
      invoice = await this.prisma.salesInvoice.findFirst({
        where: {
          companyId: input.companyId,
          invoiceNumber: input.invoiceNumber.trim(),
        },
      });
    }
    if (!invoice) {
      throw new BadRequestException(
        'Select an existing sales invoice (payment must be against an invoice)',
      );
    }
    if (['DRAFT', 'CANCELLED', 'PAID'].includes(invoice.status)) {
      throw new BadRequestException(
        'Invoice must be issued/open with a remaining balance',
      );
    }
    const balance = Number(invoice.balanceDue);
    if (!(balance > 0)) {
      throw new BadRequestException('Invoice has no remaining balance');
    }

    const amount = Number(input.amount);
    if (!(amount > 0)) {
      throw new BadRequestException('amount must be > 0');
    }
    if (amount > balance + 0.001) {
      throw new BadRequestException(
        `Amount exceeds invoice balance due (${balance})`,
      );
    }

    const method = input.paymentMethod;
    let status: EmployeeSalesStatus;
    if (method === 'CASH') {
      status = 'PENDING_CASH_APPROVAL';
    } else if (input.receiptAttachmentId) {
      status = 'SUBMITTED';
    } else {
      status = 'NEEDS_RECEIPT';
    }
    return this.prisma.employeeSalesSubmission.create({
      data: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        saleDate: new Date(input.saleDate),
        amount: amount.toFixed(2),
        paymentMethod: method,
        invoiceNumber: invoice.invoiceNumber,
        salesInvoiceId: invoice.id,
        status,
        receiptAttachmentId: input.receiptAttachmentId,
        notes: input.notes,
      },
      include: {
        salesInvoice: {
          select: { id: true, invoiceNumber: true, balanceDue: true },
        },
      },
    });
  }

  listSalesSubmissions(
    companyId: string,
    status?: EmployeeSalesStatus | string,
  ) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.employeeSalesSubmission.findMany({
      where: status ? { status: status as EmployeeSalesStatus } : undefined,
      include: {
        employee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
      },
      orderBy: { saleDate: 'desc' },
      take: 200,
    });
  }

  async listMySales(companyId: string, userId: string) {
    const me = await this.requireLinkedEmployee(companyId, userId);
    return this.prisma.employeeSalesSubmission.findMany({
      where: { employeeId: me.id },
      orderBy: { saleDate: 'desc' },
      take: 100,
    });
  }

  async attachSaleReceipt(
    companyId: string,
    saleId: string,
    userId: string,
    input: {
      fileName: string;
      mimeType: string;
      sizeBytes: number | string;
      contentBase64?: string;
      checksumSha256?: string;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    const sale = await this.prisma.employeeSalesSubmission.findFirst({
      where: { id: saleId, companyId },
    });
    if (!sale) throw new NotFoundException('Sales submission not found');
    const attachment = await this.platform.registerAttachment({
      companyId,
      uploadedById: userId,
      entityType: 'employee_sales_receipt',
      entityId: saleId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      contentBase64: input.contentBase64,
      checksumSha256: input.checksumSha256,
    });
    const nextStatus =
      sale.status === 'NEEDS_RECEIPT' ? 'SUBMITTED' : sale.status;
    const updated = await this.prisma.employeeSalesSubmission.update({
      where: { id: saleId },
      data: {
        receiptAttachmentId: attachment.id,
        status: nextStatus,
      },
    });
    return { attachment, sale: updated };
  }

  async decideSale(
    companyId: string,
    saleId: string,
    status: 'APPROVED' | 'REJECTED',
    approvedById: string,
    permissions: string[] = [],
    isPlatformAdmin = false,
  ) {
    this.tenant.setCompanyId(companyId);
    const sale = await this.prisma.employeeSalesSubmission.findFirst({
      where: { id: saleId, companyId },
      include: {
        employee: {
          select: {
            id: true,
            salesTargetAmount: true,
            targetPercent: true,
            salesTargetMode: true,
          },
        },
      },
    });
    if (!sale) throw new NotFoundException('Sales submission not found');
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new BadRequestException('Invalid sales decision status');
    }

    const canWrite =
      isPlatformAdmin || permissions.includes('hr.write');
    const canCash =
      isPlatformAdmin || permissions.includes('hr.sales_cash.approve');
    const isCashFlow =
      sale.paymentMethod === 'CASH' ||
      sale.status === 'PENDING_CASH_APPROVAL';

    if (isCashFlow) {
      if (!canCash) {
        throw new ForbiddenException(
          'Missing permission hr.sales_cash.approve',
        );
      }
    } else if (!canWrite) {
      throw new ForbiddenException('Missing permission hr.write');
    }

    if (status === 'APPROVED') {
      if (sale.paymentMethod === 'CASH') {
        // already gated by canCash above
      } else if (!sale.receiptAttachmentId) {
        throw new BadRequestException(
          'Receipt required before approving non-cash sales',
        );
      }
    }

    const updated = await this.prisma.employeeSalesSubmission.update({
      where: { id: saleId },
      data: {
        status,
        approvedById,
        decidedAt: new Date(),
      },
    });

    if (status === 'APPROVED') {
      let invoiceId = sale.salesInvoiceId;
      if (!invoiceId && sale.invoiceNumber?.trim()) {
        const inv = await this.prisma.salesInvoice.findFirst({
          where: {
            companyId,
            invoiceNumber: sale.invoiceNumber.trim(),
          },
          select: { id: true },
        });
        invoiceId = inv?.id ?? null;
        if (invoiceId && !sale.salesInvoiceId) {
          await this.prisma.employeeSalesSubmission.update({
            where: { id: saleId },
            data: { salesInvoiceId: invoiceId },
          });
        }
      }
      if (invoiceId) {
        await this.sales.recordPayment({
          companyId,
          salesInvoiceId: invoiceId,
          amount: Number(sale.amount),
          method: mapSalePaymentMethod(sale.paymentMethod),
          paidAt: new Date().toISOString(),
          externalReference: `HR-SALE-${sale.id.slice(0, 8)}`,
        });
      }

      if (
        sale.employee.salesTargetAmount != null ||
        sale.employee.targetPercent != null ||
        sale.employee.salesTargetMode === 'PERCENT' ||
        sale.employee.salesTargetMode === 'BOTH' ||
        sale.employee.salesTargetMode === 'AMOUNT'
      ) {
        await this.computeMonthlySalesProgress(companyId, sale.employeeId);
      }
    }

    return updated;
  }

  // —— Personal reports ——
  async personalReport(
    companyId: string,
    employeeId: string,
    from: string,
    to: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const employee = await this.requireEmployee(companyId, employeeId);
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (toDate < fromDate) {
      throw new BadRequestException('to must be >= from');
    }

    const [leaves, advances, sales, attendance] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId,
          startsOn: { lte: toDate },
          endsOn: { gte: fromDate },
        },
        orderBy: { startsOn: 'asc' },
      }),
      this.prisma.salaryAdvance.findMany({
        where: {
          employeeId,
          requestedAt: { gte: fromDate, lte: toDate },
        },
        orderBy: { requestedAt: 'asc' },
      }),
      this.prisma.employeeSalesSubmission.findMany({
        where: {
          employeeId,
          saleDate: { gte: fromDate, lte: toDate },
        },
        orderBy: { saleDate: 'asc' },
      }),
      this.prisma.attendanceRecord.findMany({
        where: {
          employeeId,
          attendanceDate: { gte: fromDate, lte: toDate },
        },
        orderBy: { attendanceDate: 'asc' },
      }),
    ]);

    const approvedSales = sales.filter((s) => s.status === 'APPROVED');
    const approvedSum = approvedSales.reduce((s, r) => s + Number(r.amount), 0);
    const targetAmount =
      employee.salesTargetAmount != null
        ? Number(employee.salesTargetAmount)
        : null;

    return {
      employee: this.stripSensitiveIban({
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        fullName: employee.fullName,
        targetPercent: employee.targetPercent,
        targetCompletedPercent: employee.targetCompletedPercent,
        salesTargetMode: employee.salesTargetMode,
        salesTargetAmount: employee.salesTargetAmount,
      }),
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      leaves,
      advances,
      sales,
      attendance,
      targetProgress: {
        targetPercent: employee.targetPercent,
        targetCompletedPercent: employee.targetCompletedPercent,
        salesTargetAmount: employee.salesTargetAmount,
        approvedSalesSum: approvedSum.toFixed(2),
        computedPercent:
          targetAmount && targetAmount > 0
            ? ((approvedSum / targetAmount) * 100).toFixed(2)
            : employee.targetCompletedPercent,
        overTarget: Boolean(
          targetAmount && targetAmount > 0 && approvedSum > targetAmount,
        ),
      },
    };
  }

  async listPersonalReports(
    companyId: string,
    from: string,
    to: string,
    employeeId?: string,
  ) {
    this.tenant.setCompanyId(companyId);
    if (employeeId) {
      return [await this.personalReport(companyId, employeeId, from, to)];
    }
    const employees = await this.prisma.employee.findMany({
      where: { companyId },
      select: { id: true },
      orderBy: { fullName: 'asc' },
    });
    const reports: Awaited<ReturnType<HrService['personalReport']>>[] = [];
    for (const emp of employees) {
      reports.push(await this.personalReport(companyId, emp.id, from, to));
    }
    return reports;
  }

  // —— Attendance devices ——
  listDevices(
    companyId: string,
    deviceTypes?: Array<'CAMERA' | 'BIOMETRIC' | 'BOTH'>,
  ) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.attendanceDevice.findMany({
      where: deviceTypes?.length
        ? { deviceType: { in: deviceTypes } }
        : undefined,
      orderBy: { name: 'asc' },
      take: 100,
    });
  }

  createDevice(input: {
    companyId: string;
    name: string;
    deviceType: 'CAMERA' | 'BIOMETRIC' | 'BOTH';
    location?: string;
    deviceKey?: string;
    streamUrl?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const deviceKey =
      input.deviceKey?.trim() ||
      `dev_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    return this.prisma.attendanceDevice.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        deviceType: input.deviceType,
        location: input.location,
        deviceKey,
        streamUrl: input.streamUrl,
      },
    });
  }

  async updateDevice(
    companyId: string,
    deviceId: string,
    input: {
      name?: string;
      status?: 'ACTIVE' | 'INACTIVE';
      location?: string;
      streamUrl?: string | null;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    const device = await this.prisma.attendanceDevice.findFirst({
      where: { id: deviceId, companyId },
    });
    if (!device) throw new NotFoundException('Device not found');
    return this.prisma.attendanceDevice.update({
      where: { id: deviceId },
      data: {
        ...(input.name != null ? { name: input.name } : {}),
        ...(input.status != null ? { status: input.status } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.streamUrl !== undefined
          ? { streamUrl: input.streamUrl }
          : {}),
      },
    });
  }

  async ingestDevicePunch(input: {
    companyId: string;
    deviceKey: string;
    employeeId?: string;
    externalRef?: string;
    eventType: string;
    occurredAt?: string;
  }) {
    this.tenant.setBypass(true);
    try {
      const device = await this.prisma.attendanceDevice.findFirst({
        where: {
          companyId: input.companyId,
          deviceKey: input.deviceKey,
          status: 'ACTIVE',
        },
      });
      if (!device) {
        throw new NotFoundException('Device not found or inactive');
      }
      this.tenant.setCompanyId(input.companyId);
      const occurredAt = input.occurredAt
        ? new Date(input.occurredAt)
        : new Date();
      await this.prisma.attendanceDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: occurredAt },
      });

      let employeeId = input.employeeId;
      if (!employeeId && input.externalRef?.trim()) {
        const badge = input.externalRef.trim();
        const matched = await this.prisma.employee.findFirst({
          where: {
            companyId: input.companyId,
            employmentStatus: 'ACTIVE',
            OR: [{ attendanceBadgeId: badge }, { employeeNumber: badge }],
          },
          select: { id: true },
        });
        employeeId = matched?.id;
      }

      const event = await this.prisma.attendanceDeviceEvent.create({
        data: {
          companyId: input.companyId,
          deviceId: device.id,
          employeeId,
          externalRef: input.externalRef,
          eventType: input.eventType,
          occurredAt,
        },
      });

      if (employeeId) {
        const day = new Date(occurredAt.toISOString().slice(0, 10));
        const isOut = /out|checkout|leave/i.test(input.eventType);
        const existing = await this.prisma.attendanceRecord.findUnique({
          where: {
            employeeId_attendanceDate: {
              employeeId,
              attendanceDate: day,
            },
          },
        });
        const workStart = new Date(day);
        workStart.setHours(9, 0, 0, 0);
        let status: AttendanceStatus = 'PRESENT';
        if (!isOut && occurredAt > new Date(workStart.getTime() + 15 * 60000)) {
          status = 'LATE';
        }
        await this.prisma.attendanceRecord.upsert({
          where: {
            employeeId_attendanceDate: {
              employeeId,
              attendanceDate: day,
            },
          },
          create: {
            companyId: input.companyId,
            employeeId,
            attendanceDate: day,
            status,
            checkInAt: isOut ? undefined : occurredAt,
            checkOutAt: isOut ? occurredAt : undefined,
            source: `device:${device.id}`,
          },
          update: {
            ...(isOut
              ? { checkOutAt: occurredAt }
              : {
                  checkInAt: existing?.checkInAt ?? occurredAt,
                  status:
                    existing?.status === 'ABSENT'
                      ? status
                      : (existing?.status ?? status),
                }),
            source: `device:${device.id}`,
          },
        });
      }
      return event;
    } finally {
      this.tenant.setBypass(false);
    }
  }

  listDeviceEvents(
    companyId: string,
    filters?: {
      deviceId?: string;
      from?: string;
      to?: string;
      employeeId?: string;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.attendanceDeviceEvent.findMany({
      where: {
        ...(filters?.deviceId ? { deviceId: filters.deviceId } : {}),
        ...(filters?.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters?.from || filters?.to
          ? {
              occurredAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        device: { select: { id: true, name: true, deviceType: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }

  // —— Self-service (linked user → employee) ——
  async myProfile(companyId: string, userId: string) {
    this.tenant.setCompanyId(companyId);
    const employee = await this.prisma.employee.findFirst({
      where: { companyId, userId },
      include: {
        ewallet: true,
        contracts: { orderBy: { createdAt: 'desc' }, take: 10 },
        salaryAdvances: { orderBy: { requestedAt: 'desc' }, take: 20 },
        leaveRequests: { orderBy: { createdAt: 'desc' }, take: 20 },
        shiftAssignments: {
          include: { shift: true },
          orderBy: { effectiveFrom: 'desc' },
          take: 20,
        },
        salesSubmissions: {
          orderBy: { saleDate: 'desc' },
          take: 50,
        },
      },
    });
    if (!employee) {
      throw new NotFoundException('No employee profile linked to this user');
    }
    const stripped = this.stripSensitiveIban(employee);
    return this.enrichEmployeeResponse(companyId, employee.id, {
      ...stripped,
      ...this.docsFlags(employee),
      insuranceComplete: Boolean(employee.insuranceAttachmentId),
    });
  }

  async myRequestAdvance(
    companyId: string,
    userId: string,
    amount: string | number,
    reason?: string,
  ) {
    const me = await this.requireLinkedEmployee(companyId, userId);
    return this.requestAdvance({
      companyId,
      employeeId: me.id,
      amount,
      reason,
    });
  }

  async myRequestLeave(
    companyId: string,
    userId: string,
    input: {
      leaveType: string;
      startsOn: string;
      endsOn: string;
      requestedDays: string | number;
      reason: string;
    },
  ) {
    const me = await this.requireLinkedEmployee(companyId, userId);
    return this.createLeave({
      companyId,
      employeeId: me.id,
      ...input,
    });
  }

  async updateMyInfo(
    companyId: string,
    userId: string,
    input: { phone?: string; email?: string; iban?: string },
  ) {
    const me = await this.requireLinkedEmployee(companyId, userId);
    const ibanRaw = input.iban?.trim();
    const ibanData =
      ibanRaw && ibanRaw.length > 0 ? this.encryptIban(ibanRaw) : null;
    const data: Prisma.EmployeeUncheckedUpdateInput = {
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
    };
    if (ibanData) {
      data.ibanCiphertext = ibanData.ibanCiphertext
        ? Buffer.from(ibanData.ibanCiphertext)
        : null;
      data.ibanKeyVersion = ibanData.ibanKeyVersion;
      data.ibanLast4 = ibanData.ibanLast4;
      data.ibanFingerprint = ibanData.ibanFingerprint;
    }
    const updated = await this.prisma.employee.update({
      where: { id: me.id },
      data,
    });
    return this.stripSensitiveIban(updated);
  }

  async updateMyTargetCompleted(companyId: string, userId: string) {
    const me = await this.requireLinkedEmployee(companyId, userId);
    return this.computeMonthlySalesProgress(companyId, me.id);
  }

  async mySubmitSale(
    companyId: string,
    userId: string,
    input: {
      saleDate: string;
      amount: string | number;
      paymentMethod:
        SalesPaymentMethod | 'CASH' | 'CARD' | 'TRANSFER' | 'NETWORK';
      invoiceNumber?: string;
      salesInvoiceId?: string;
      notes?: string;
      receiptAttachmentId?: string;
    },
  ) {
    const me = await this.requireLinkedEmployee(companyId, userId);
    return this.submitSale({
      companyId,
      employeeId: me.id,
      ...input,
    });
  }

  private async requireEmployee(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return employee;
  }

  private async requireLinkedEmployee(companyId: string, userId: string) {
    this.tenant.setCompanyId(companyId);
    const employee = await this.prisma.employee.findFirst({
      where: { companyId, userId },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('No employee profile linked to this user');
    }
    return employee;
  }

  /** Mark weekdays without attendance as ABSENT so payroll discounts apply. */
  async markMissingDaysAbsent(
    companyId: string,
    employeeIds: string[],
    periodStart: Date,
    periodEnd: Date,
  ) {
    if (employeeIds.length === 0) return;
    const existing = await this.prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        attendanceDate: { gte: periodStart, lte: periodEnd },
      },
      select: { employeeId: true, attendanceDate: true },
    });
    const have = new Set(
      existing.map(
        (r) => `${r.employeeId}:${r.attendanceDate.toISOString().slice(0, 10)}`,
      ),
    );
    const rows: {
      companyId: string;
      employeeId: string;
      attendanceDate: Date;
      status: AttendanceStatus;
      source: string;
    }[] = [];
    for (
      let d = new Date(periodStart);
      d <= periodEnd;
      d = new Date(d.getTime() + 86400000)
    ) {
      const dow = d.getDay();
      if (dow === 5 || dow === 6) continue; // Fri/Sat weekend default
      const keyDay = d.toISOString().slice(0, 10);
      const day = new Date(keyDay);
      for (const employeeId of employeeIds) {
        if (have.has(`${employeeId}:${keyDay}`)) continue;
        rows.push({
          companyId,
          employeeId,
          attendanceDate: day,
          status: 'ABSENT',
          source: 'auto-absent',
        });
      }
    }
    if (rows.length) {
      await this.prisma.attendanceRecord.createMany({
        data: rows,
        skipDuplicates: true,
      });
    }
  }
}
