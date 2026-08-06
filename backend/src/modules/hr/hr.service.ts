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
    });
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
    currency?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    if (input.basicSalary != null && Number(input.basicSalary) < 0) {
      throw new BadRequestException('basicSalary must be >= 0');
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
        currency: input.currency ?? 'SAR',
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

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    const items = employees.map((employee) => {
      const basic = Number(employee.basicSalary ?? 0);
      const allowances = 0;
      const bonuses = 0;
      const deductions = 0;
      const advances = 0;
      const net = basic + allowances + bonuses - deductions - advances;
      totalGross += basic + allowances + bonuses;
      totalDeductions += deductions + advances;
      totalNet += net;
      return {
        employeeId: employee.id,
        basicSalary: basic.toFixed(2),
        allowances: allowances.toFixed(2),
        bonuses: bonuses.toFixed(2),
        deductions: deductions.toFixed(2),
        advances: advances.toFixed(2),
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

  private async requireEmployee(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return employee;
  }
}
