import { createHash } from 'node:crypto';
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
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { AutomationEngine } from '../automation/automation.engine';
import { PlatformService } from '../platform/platform.service';

function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase();
}

function fingerprintIban(iban: string): string {
  return createHash('sha256').update(normalizeIban(iban)).digest('hex');
}

@Injectable()
export class HrService {
  private readonly logger = new Logger(HrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly encryption: EncryptionService,
    private readonly platform: PlatformService,
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
        ibanCiphertext: null as Buffer | null,
        ibanKeyVersion: null as number | null,
        ibanLast4: null as string | null,
        ibanFingerprint: null as string | null,
      };
    }
    const normalized = normalizeIban(iban);
    if (normalized.length < 8) {
      throw new BadRequestException('IBAN too short');
    }
    const encrypted = this.encryption.encrypt(normalized);
    return {
      ibanCiphertext: Buffer.from(encrypted.ciphertext),
      ibanKeyVersion: encrypted.keyVersion,
      ibanLast4: normalized.slice(-4),
      ibanFingerprint: fingerprintIban(normalized),
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

  async listEmployees(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const rows = await this.prisma.employee.findMany({
      orderBy: { fullName: 'asc' },
      take: 200,
      include: {
        ewallet: true,
        _count: { select: { contracts: true, salaryAdvances: true } },
      },
    });
    return rows.map((row) =>
      this.stripSensitiveIban(row as unknown as Record<string, unknown>),
    );
  }

  async employeeSummary(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const [total, active, onLeave, suspended, terminated] = await Promise.all([
      this.prisma.employee.count(),
      this.prisma.employee.count({ where: { employmentStatus: 'ACTIVE' } }),
      this.prisma.employee.count({ where: { employmentStatus: 'ON_LEAVE' } }),
      this.prisma.employee.count({ where: { employmentStatus: 'SUSPENDED' } }),
      this.prisma.employee.count({ where: { employmentStatus: 'TERMINATED' } }),
    ]);
    return { total, active, onLeave, suspended, terminated };
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
    const stripped = this.stripSensitiveIban(
      employee as unknown as Record<string, unknown>,
    );
    return {
      ...stripped,
      ...this.docsFlags(employee),
    };
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
    advanceAllowanceMonthly?: string | number;
    advanceAllowanceMonth?: string;
    approvalStatus?: EmployeeApprovalStatus | 'PENDING' | 'APPROVED' | 'REJECTED';
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
    if (input.basicSalary != null && Number(input.basicSalary) < 0) {
      throw new BadRequestException('basicSalary must be >= 0');
    }
    if (input.targetPercent != null) {
      const tp = Number(input.targetPercent);
      if (tp < 0 || tp > 100) {
        throw new BadRequestException('targetPercent must be between 0 and 100');
      }
    }
    if (input.targetCompletedPercent != null) {
      const tcp = Number(input.targetCompletedPercent);
      if (tcp < 0 || tcp > 100) {
        throw new BadRequestException(
          'targetCompletedPercent must be between 0 and 100',
        );
      }
    }
    if (input.advanceAllowanceMonth && !/^\d{4}-\d{2}$/.test(input.advanceAllowanceMonth)) {
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
    const ibanData = this.encryptIban(input.iban);
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
        basicSalary:
          input.basicSalary != null ? String(input.basicSalary) : undefined,
        targetPercent:
          input.targetPercent != null ? String(input.targetPercent) : undefined,
        targetCompletedPercent:
          input.targetCompletedPercent != null
            ? String(input.targetCompletedPercent)
            : undefined,
        absenceDiscountPerDay:
          input.absenceDiscountPerDay != null
            ? String(input.absenceDiscountPerDay)
            : undefined,
        lateDiscountAmount:
          input.lateDiscountAmount != null
            ? String(input.lateDiscountAmount)
            : undefined,
        isPurchaseOperator: Boolean(input.isPurchaseOperator),
        currency: input.currency ?? 'SAR',
        identityType: input.identityType as EmployeeIdentityType,
        identityNumber: input.identityNumber.trim(),
        identityExpiresOn: input.identityExpiresOn
          ? new Date(input.identityExpiresOn)
          : undefined,
        ibanBankName: input.ibanBankName,
        ...ibanData,
        approvalStatus: (input.approvalStatus as EmployeeApprovalStatus) ?? 'PENDING',
        salesTargetMode: input.salesTargetMode as SalesTargetMode | undefined,
        salesTargetAmount:
          input.salesTargetAmount != null
            ? String(input.salesTargetAmount)
            : undefined,
        lateHourRate:
          input.lateHourRate != null ? String(input.lateHourRate) : undefined,
        advanceAllowanceMonthly:
          input.advanceAllowanceMonthly != null
            ? String(input.advanceAllowanceMonthly)
            : undefined,
        advanceAllowanceMonth: input.advanceAllowanceMonth,
      } as Prisma.EmployeeUncheckedCreateInput,
    });
    return this.stripSensitiveIban(
      created as unknown as Record<string, unknown>,
    );
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
      approvalStatus?: EmployeeApprovalStatus | 'PENDING' | 'APPROVED' | 'REJECTED';
      // financial
      basicSalary?: string | number;
      iban?: string;
      ibanBankName?: string;
      lateHourRate?: string | number;
      lateDiscountAmount?: string | number;
      advanceAllowanceMonthly?: string | number;
      advanceAllowanceMonth?: string;
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
        throw new BadRequestException('targetPercent must be between 0 and 100');
      }
    }
    if (input.targetCompletedPercent != null) {
      const tcp = Number(input.targetCompletedPercent);
      if (tcp < 0 || tcp > 100) {
        throw new BadRequestException(
          'targetCompletedPercent must be between 0 and 100',
        );
      }
    }
    if (
      input.advanceAllowanceMonth &&
      !/^\d{4}-\d{2}$/.test(input.advanceAllowanceMonth)
    ) {
      throw new BadRequestException('advanceAllowanceMonth must be YYYY-MM');
    }
    const ibanData =
      input.iban !== undefined ? this.encryptIban(input.iban) : null;
    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...(input.identityType != null
          ? { identityType: input.identityType as EmployeeIdentityType }
          : {}),
        ...(input.identityNumber !== undefined
          ? { identityNumber: input.identityNumber }
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
          ? { approvalStatus: input.approvalStatus as EmployeeApprovalStatus }
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
        ...(input.advanceAllowanceMonthly != null
          ? { advanceAllowanceMonthly: String(input.advanceAllowanceMonthly) }
          : {}),
        ...(input.advanceAllowanceMonth !== undefined
          ? { advanceAllowanceMonth: input.advanceAllowanceMonth }
          : {}),
        ...(input.targetPercent != null
          ? { targetPercent: String(input.targetPercent) }
          : {}),
        ...(input.targetCompletedPercent != null
          ? { targetCompletedPercent: String(input.targetCompletedPercent) }
          : {}),
        ...(input.salesTargetMode !== undefined
          ? {
              salesTargetMode: input.salesTargetMode as SalesTargetMode | null,
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
    return this.stripSensitiveIban(
      updated as unknown as Record<string, unknown>,
    );
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
    return this.stripSensitiveIban(
      updated as unknown as Record<string, unknown>,
    );
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
      employee: this.stripSensitiveIban(
        updated as unknown as Record<string, unknown>,
      ),
    };
  }

  async setAdvanceAllowance(
    companyId: string,
    employeeId: string,
    input: { month: string; amount: string | number },
  ) {
    this.tenant.setCompanyId(companyId);
    await this.requireEmployee(companyId, employeeId);
    if (!/^\d{4}-\d{2}$/.test(input.month)) {
      throw new BadRequestException('month must be YYYY-MM');
    }
    const amount = Number(input.amount);
    if (!(amount >= 0)) {
      throw new BadRequestException('amount must be >= 0');
    }
    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        advanceAllowanceMonth: input.month,
        advanceAllowanceMonthly: amount.toFixed(2),
      },
    });
    return this.stripSensitiveIban(
      updated as unknown as Record<string, unknown>,
    );
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
    return this.stripSensitiveIban(
      updated as unknown as Record<string, unknown>,
    );
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

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    const items = employees.map((employee) => {
      const basic = Number(employee.basicSalary ?? 0);
      const allowances = 0;
      const targetPct = Number(employee.targetPercent ?? 0);
      const completedPct = Number(employee.targetCompletedPercent ?? 0);
      const bonuses =
        targetPct > 0 && completedPct > 0
          ? (basic * targetPct * completedPct) / 10000
          : 0;
      const dailyAbsence =
        Number(employee.absenceDiscountPerDay ?? 0) ||
        (basic > 0 ? basic / 30 : 0);
      const lateFee = Number(employee.lateDiscountAmount ?? 0);
      const lateHourRate =
        employee.lateHourRate != null ? Number(employee.lateHourRate) : null;
      const empAttendance = attendance.filter(
        (a) => a.employeeId === employee.id,
      );
      const absentDays = empAttendance.filter((a) => a.status === 'ABSENT')
        .length;
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
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
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
        contractKind: (input.contractKind as EmployeeContractKind) ?? 'EMPLOYMENT',
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
      throw new BadRequestException('Only draft/submitted contracts can be edited');
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
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
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
    const currentMonth = new Date().toISOString().slice(0, 7);
    const allowanceSet =
      employee.advanceAllowanceMonthly != null &&
      employee.advanceAllowanceMonth === currentMonth;

    if (allowanceSet) {
      const allowance = Number(employee.advanceAllowanceMonthly);
      const monthStart = new Date(`${currentMonth}-01T00:00:00.000Z`);
      const [y, m] = currentMonth.split('-').map(Number);
      const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      const monthAdvances = await this.prisma.salaryAdvance.findMany({
        where: {
          employeeId: employee.id,
          status: { in: ['PENDING', 'APPROVED', 'PAID'] },
          requestedAt: { gte: monthStart, lte: monthEnd },
        },
      });
      const monthTotal = monthAdvances.reduce(
        (s, a) => s + Number(a.amount),
        0,
      );
      if (monthTotal + amount > allowance) {
        throw new BadRequestException(
          `Advance exceeds monthly allowance (allowance ${allowance.toFixed(2)}, already ${monthTotal.toFixed(2)})`,
        );
      }
    } else {
      const salary = Number(employee.basicSalary ?? 0);
      if (salary <= 0) {
        throw new BadRequestException('Employee has no basic salary configured');
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
            employeeNumber: true,
            currency: true,
          },
        },
      },
    });
    if (!advance) throw new NotFoundException('Advance not found');

    const becomingPaid = status === 'PAID' && advance.status !== 'PAID';
    const updated = await this.prisma.salaryAdvance.update({
      where: { id: advanceId },
      data: {
        status,
        decidedById,
        decidedAt: new Date(),
        ...(status === 'PAID' ? { paidAt: new Date() } : {}),
      },
    });

    if (becomingPaid) {
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
    return this.prisma.employee.findMany({
      where: { isPurchaseOperator: true },
      include: { ewallet: true },
      orderBy: { fullName: 'asc' },
    }).then((rows) =>
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
      input.walletCode?.trim() ||
      `EW-${employee.employeeNumber}`.slice(0, 40);
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
  async submitSale(input: {
    companyId: string;
    employeeId: string;
    saleDate: string;
    amount: string | number;
    paymentMethod: SalesPaymentMethod | 'CASH' | 'CARD' | 'TRANSFER' | 'NETWORK';
    notes?: string;
    receiptAttachmentId?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.requireEmployee(input.companyId, input.employeeId);
    const amount = Number(input.amount);
    if (!(amount > 0)) {
      throw new BadRequestException('amount must be > 0');
    }
    const method = input.paymentMethod as SalesPaymentMethod;
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
        status,
        receiptAttachmentId: input.receiptAttachmentId,
        notes: input.notes,
      },
    });
  }

  listSalesSubmissions(companyId: string, status?: EmployeeSalesStatus | string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.employeeSalesSubmission.findMany({
      where: status ? { status: status as EmployeeSalesStatus } : undefined,
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
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
  ) {
    this.tenant.setCompanyId(companyId);
    const sale = await this.prisma.employeeSalesSubmission.findFirst({
      where: { id: saleId, companyId },
      include: {
        employee: {
          select: {
            id: true,
            salesTargetAmount: true,
          },
        },
      },
    });
    if (!sale) throw new NotFoundException('Sales submission not found');
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new BadRequestException('Invalid sales decision status');
    }

    if (status === 'APPROVED') {
      if (sale.paymentMethod === 'CASH') {
        if (!permissions.includes('hr.sales_cash.approve')) {
          throw new ForbiddenException(
            'Missing permission hr.sales_cash.approve',
          );
        }
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

    if (status === 'APPROVED' && sale.employee.salesTargetAmount != null) {
      const target = Number(sale.employee.salesTargetAmount);
      if (target > 0) {
        const approved = await this.prisma.employeeSalesSubmission.findMany({
          where: {
            employeeId: sale.employeeId,
            status: 'APPROVED',
          },
        });
        const sum = approved.reduce((s, r) => s + Number(r.amount), 0);
        const pct = Math.min(100, (sum / target) * 100);
        await this.prisma.employee.update({
          where: { id: sale.employeeId },
          data: { targetCompletedPercent: pct.toFixed(2) },
        });
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
    const approvedSum = approvedSales.reduce(
      (s, r) => s + Number(r.amount),
      0,
    );
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
      } as Record<string, unknown>),
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
            ? Math.min(100, (approvedSum / targetAmount) * 100).toFixed(2)
            : employee.targetCompletedPercent,
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
    deviceKey: string;
    streamUrl?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    return this.prisma.attendanceDevice.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        deviceType: input.deviceType,
        location: input.location,
        deviceKey: input.deviceKey,
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
        ...(input.streamUrl !== undefined ? { streamUrl: input.streamUrl } : {}),
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
      const event = await this.prisma.attendanceDeviceEvent.create({
        data: {
          companyId: input.companyId,
          deviceId: device.id,
          employeeId: input.employeeId,
          externalRef: input.externalRef,
          eventType: input.eventType,
          occurredAt,
        },
      });

      if (input.employeeId) {
        const day = new Date(occurredAt.toISOString().slice(0, 10));
        const isOut = /out|checkout|leave/i.test(input.eventType);
        const existing = await this.prisma.attendanceRecord.findUnique({
          where: {
            employeeId_attendanceDate: {
              employeeId: input.employeeId,
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
              employeeId: input.employeeId,
              attendanceDate: day,
            },
          },
          create: {
            companyId: input.companyId,
            employeeId: input.employeeId,
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
    const stripped = this.stripSensitiveIban(
      employee as unknown as Record<string, unknown>,
    );
    return {
      ...stripped,
      ...this.docsFlags(employee),
      insuranceComplete: Boolean(employee.insuranceAttachmentId),
    };
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
    input: { phone?: string; email?: string },
  ) {
    const me = await this.requireLinkedEmployee(companyId, userId);
    const updated = await this.prisma.employee.update({
      where: { id: me.id },
      data: {
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
      },
    });
    return this.stripSensitiveIban(
      updated as unknown as Record<string, unknown>,
    );
  }

  async updateMyTargetCompleted(
    companyId: string,
    userId: string,
    targetCompletedPercent: string | number,
  ) {
    const me = await this.requireLinkedEmployee(companyId, userId);
    const tcp = Number(targetCompletedPercent);
    if (tcp < 0 || tcp > 100) {
      throw new BadRequestException(
        'targetCompletedPercent must be between 0 and 100',
      );
    }
    const updated = await this.prisma.employee.update({
      where: { id: me.id },
      data: { targetCompletedPercent: tcp.toFixed(2) },
    });
    return this.stripSensitiveIban(
      updated as unknown as Record<string, unknown>,
    );
  }

  async mySubmitSale(
    companyId: string,
    userId: string,
    input: {
      saleDate: string;
      amount: string | number;
      paymentMethod: SalesPaymentMethod | 'CASH' | 'CARD' | 'TRANSFER' | 'NETWORK';
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
  private async markMissingDaysAbsent(
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
        (r) =>
          `${r.employeeId}:${r.attendanceDate.toISOString().slice(0, 10)}`,
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
