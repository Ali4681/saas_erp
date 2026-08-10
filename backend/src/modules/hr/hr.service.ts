import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  AttendanceStatus,
  EmploymentStatus,
  LeaveStatus,
  PayrollStatus,
} from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { AutomationEngine } from '../automation/automation.engine';

@Injectable()
export class HrService {
  private readonly logger = new Logger(HrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
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

  listEmployees(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.employee.findMany({
      orderBy: { fullName: 'asc' },
      take: 200,
      include: {
        ewallet: true,
        _count: { select: { contracts: true, salaryAdvances: true } },
      },
    });
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

  async createEmployee(input: {
    companyId: string;
    employeeNumber: string;
    fullName: string;
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
    if (input.userId) {
      const existing = await this.prisma.employee.findFirst({
        where: { companyId: input.companyId, userId: input.userId },
      });
      if (existing) {
        throw new BadRequestException('User is already linked to an employee');
      }
    }
    return this.prisma.employee.create({
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
      },
    });
  }

  async updateEmployee(
    companyId: string,
    employeeId: string,
    input: {
      basicSalary?: string | number;
      targetPercent?: string | number;
      targetCompletedPercent?: string | number;
      absenceDiscountPerDay?: string | number;
      lateDiscountAmount?: string | number;
      isPurchaseOperator?: boolean;
      phone?: string;
      email?: string;
      jobTitle?: string;
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
    return this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...(input.basicSalary != null
          ? { basicSalary: String(input.basicSalary) }
          : {}),
        ...(input.targetPercent != null
          ? { targetPercent: String(input.targetPercent) }
          : {}),
        ...(input.targetCompletedPercent != null
          ? { targetCompletedPercent: String(input.targetCompletedPercent) }
          : {}),
        ...(input.absenceDiscountPerDay != null
          ? { absenceDiscountPerDay: String(input.absenceDiscountPerDay) }
          : {}),
        ...(input.lateDiscountAmount != null
          ? { lateDiscountAmount: String(input.lateDiscountAmount) }
          : {}),
        ...(input.isPurchaseOperator != null
          ? { isPurchaseOperator: input.isPurchaseOperator }
          : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
      },
    });
  }

  async updateEmployeeStatus(
    companyId: string,
    employeeId: string,
    employmentStatus: EmploymentStatus,
  ) {
    this.tenant.setCompanyId(companyId);
    await this.requireEmployee(companyId, employeeId);
    return this.prisma.employee.update({
      where: { id: employeeId },
      data: { employmentStatus },
    });
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

    return this.prisma.attendanceRecord.upsert({
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
    }).then(async (row) => {
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
    reason?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.requireEmployee(input.companyId, input.employeeId);
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
        reason: input.reason,
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
      const empAttendance = attendance.filter(
        (a) => a.employeeId === employee.id,
      );
      const absentDays = empAttendance.filter((a) => a.status === 'ABSENT')
        .length;
      const lateDays = empAttendance.filter((a) => a.status === 'LATE').length;
      const absenceDeduction = absentDays * dailyAbsence;
      const lateDeduction = lateDays * lateFee;
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
    return this.prisma.employeeContract.update({
      where: { id: contractId },
      data: { status: 'ACTIVE' },
    });
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
    });
    if (!advance) throw new NotFoundException('Advance not found');
    return this.prisma.salaryAdvance.update({
      where: { id: advanceId },
      data: {
        status,
        decidedById,
        decidedAt: new Date(),
        ...(status === 'PAID' ? { paidAt: new Date() } : {}),
      },
    });
  }

  // —— E-wallets / purchase operators ——
  listPurchaseOperators(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.employee.findMany({
      where: { isPurchaseOperator: true },
      include: { ewallet: true },
      orderBy: { fullName: 'asc' },
    });
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

  // —— Attendance devices ——
  listDevices(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.attendanceDevice.findMany({
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

  listDeviceEvents(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.attendanceDeviceEvent.findMany({
      include: { device: { select: { id: true, name: true, deviceType: true } } },
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
      },
    });
    if (!employee) {
      throw new NotFoundException('No employee profile linked to this user');
    }
    return employee;
  }

  async myRequestAdvance(
    companyId: string,
    userId: string,
    amount: string | number,
    reason?: string,
  ) {
    const me = await this.myProfile(companyId, userId);
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
      reason?: string;
    },
  ) {
    const me = await this.myProfile(companyId, userId);
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
    const me = await this.myProfile(companyId, userId);
    return this.prisma.employee.update({
      where: { id: me.id },
      data: {
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
      },
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
