import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  AttendanceDeviceType,
  AttendanceStatus,
  EmployeeApprovalStatus,
  EmployeeContractKind,
  EmployeeIdentityType,
  EmployeeSalesStatus,
  EmploymentStatus,
  LeaveStatus,
  PayrollStatus,
  SalaryAdvanceStatus,
  SalesPaymentMethod,
  SalesTargetMode,
} from '../../generated/prisma/client';
import {
  CurrentUser,
  Public,
  RequireAnyPermission,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { HrService } from './hr.service';
import { HrQiwaService } from './hr-qiwa.service';

/** Form posts often send "" for unused optional fields — treat as omitted. */
function emptyToUndefined({ value }: { value: unknown }) {
  if (value === '' || value === null || value === undefined) return undefined;
  return typeof value === 'string' ? value.trim() || undefined : value;
}

function normalizeSaudiIdInput({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/[\s-]+/g, '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function normalizeSaudiIbanInput({ value }: { value: unknown }) {
  if (value === '' || value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return value;
  const n = value.replace(/[\s-]+/g, '').toUpperCase();
  return n || undefined;
}

class CreateEmployeeBody {
  @IsString()
  @MinLength(1)
  employeeNumber!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEnum(EmployeeIdentityType)
  identityType!: EmployeeIdentityType;

  @Transform(normalizeSaudiIdInput)
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  @Matches(/^[12][0-9]{9}$/, {
    message:
      'identityNumber must be a Saudi ID/Iqama: 10 digits starting with 1 (citizen) or 2 (resident)',
  })
  identityNumber!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  identityExpiresOn?: string;

  @IsOptional()
  @Transform(normalizeSaudiIbanInput)
  @IsString()
  @Matches(/^SA[0-9]{22}$/, {
    message:
      'iban must be a Saudi IBAN: SA + 22 digits (24 characters total)',
  })
  iban?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  ibanBankName?: string;

  @IsOptional()
  @IsEnum(SalesTargetMode)
  salesTargetMode?: SalesTargetMode;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsNumberString()
  salesTargetAmount?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsNumberString()
  lateHourRate?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsNumberString()
  advanceAllowancePercent?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsNumberString()
  advanceAllowanceMonthly?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  advanceAllowanceMonth?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  attendanceBadgeId?: string;

  @IsOptional()
  @IsEnum(EmployeeApprovalStatus)
  approvalStatus?: EmployeeApprovalStatus;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  userId?: string;

  @IsOptional()
  @IsBoolean()
  createAppLogin?: boolean;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(8)
  loginPassword?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  loginRoleCode?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  companyBranchId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  companyDepartmentId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  email?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  phone?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  hireDate?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsNumberString()
  basicSalary?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsNumberString()
  targetPercent?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsNumberString()
  targetCompletedPercent?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsNumberString()
  absenceDiscountPerDay?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsNumberString()
  lateDiscountAmount?: string;

  @IsOptional()
  @IsBoolean()
  isPurchaseOperator?: boolean;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  currency?: string;
}

class UpdateEmployeeBody {
  @IsOptional()
  @IsEnum(EmployeeIdentityType)
  identityType?: EmployeeIdentityType;

  @IsOptional()
  @Transform(normalizeSaudiIdInput)
  @IsString()
  @Matches(/^[12][0-9]{9}$/, {
    message:
      'identityNumber must be a Saudi ID/Iqama: 10 digits starting with 1 (citizen) or 2 (resident)',
  })
  identityNumber?: string;

  @IsOptional()
  @IsString()
  identityExpiresOn?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsEnum(EmployeeApprovalStatus)
  approvalStatus?: EmployeeApprovalStatus;

  @IsOptional()
  @IsNumberString()
  basicSalary?: string;

  @IsOptional()
  @IsString()
  iban?: string;

  @IsOptional()
  @IsString()
  ibanBankName?: string;

  @IsOptional()
  @IsNumberString()
  lateHourRate?: string;

  @IsOptional()
  @IsNumberString()
  lateDiscountAmount?: string;

  @IsOptional()
  @IsNumberString()
  advanceAllowancePercent?: string;

  @IsOptional()
  @IsNumberString()
  advanceAllowanceMonthly?: string;

  @IsOptional()
  @IsString()
  advanceAllowanceMonth?: string;

  @IsOptional()
  @IsString()
  attendanceBadgeId?: string;

  @IsOptional()
  @IsNumberString()
  targetPercent?: string;

  @IsOptional()
  @IsNumberString()
  targetCompletedPercent?: string;

  @IsOptional()
  @IsEnum(SalesTargetMode)
  salesTargetMode?: SalesTargetMode;

  @IsOptional()
  @IsNumberString()
  salesTargetAmount?: string;

  @IsOptional()
  @IsNumberString()
  absenceDiscountPerDay?: string;

  @IsOptional()
  @IsBoolean()
  isPurchaseOperator?: boolean;

  @IsOptional()
  @IsString()
  qiwaContractUrl?: string;

  @IsOptional()
  @IsString()
  qiwaContractRef?: string;
}

class UpdateEmployeeStatusBody {
  @IsEnum(EmploymentStatus)
  employmentStatus!: EmploymentStatus;
}

class UpsertAttendanceBody {
  @IsString()
  employeeId!: string;

  @IsString()
  attendanceDate!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsString()
  checkInAt?: string;

  @IsOptional()
  @IsString()
  checkOutAt?: string;

  @IsOptional()
  @IsNumber()
  workedMinutes?: number;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class CreateLeaveBody {
  @IsString()
  employeeId!: string;

  @IsString()
  leaveType!: string;

  @IsString()
  startsOn!: string;

  @IsString()
  endsOn!: string;

  @IsNumberString()
  requestedDays!: string;

  @IsString()
  @MinLength(1)
  reason!: string;
}

class DecideLeaveBody {
  @IsEnum(LeaveStatus)
  status!: LeaveStatus;
}

class CreatePayrollBody {
  @IsString()
  periodStart!: string;

  @IsString()
  periodEnd!: string;
}

class UpdatePayrollStatusBody {
  @IsEnum(PayrollStatus)
  status!: PayrollStatus;
}

class CreateContractBody {
  @IsString()
  employeeId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  contractNumber?: string;

  @IsOptional()
  @IsEnum(EmployeeContractKind)
  contractKind?: EmployeeContractKind;

  @IsOptional()
  @IsString()
  externalPlatform?: string;

  @IsOptional()
  @IsString()
  externalRef?: string;

  @IsOptional()
  @IsString()
  startsOn?: string;

  @IsOptional()
  @IsString()
  endsOn?: string;

  @IsOptional()
  @IsNumberString()
  baseSalary?: string;

  @IsOptional()
  @IsNumberString()
  targetPercent?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  submitNow?: boolean;
}

class UpdateContractBody {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  contractNumber?: string;

  @IsOptional()
  @IsString()
  startsOn?: string;

  @IsOptional()
  @IsString()
  endsOn?: string;

  @IsOptional()
  @IsNumberString()
  baseSalary?: string;

  @IsOptional()
  @IsNumberString()
  targetPercent?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class AdvanceBody {
  @IsString()
  employeeId!: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

class DecideAdvanceBody {
  @IsEnum(SalaryAdvanceStatus)
  status!: SalaryAdvanceStatus;
}

class EwalletBody {
  @IsString()
  employeeId!: string;

  @IsOptional()
  @IsString()
  walletCode?: string;

  @IsOptional()
  @IsNumberString()
  balance?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

class CreateDeviceBody {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(AttendanceDeviceType)
  deviceType!: AttendanceDeviceType;

  @IsOptional()
  @IsString()
  @MinLength(4)
  deviceKey?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  streamUrl?: string;
}

class DevicePunchBody {
  @IsString()
  deviceKey!: string;

  @IsString()
  eventType!: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  externalRef?: string;

  @IsOptional()
  @IsString()
  occurredAt?: string;
}

class MyAdvanceBody {
  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

class MyLeaveBody {
  @IsString()
  leaveType!: string;

  @IsString()
  startsOn!: string;

  @IsString()
  endsOn!: string;

  @IsNumberString()
  requestedDays!: string;

  @IsString()
  @MinLength(1)
  reason!: string;
}

class MyProfileBody {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  iban?: string;
}

class AttachmentBody {
  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsNumberString()
  sizeBytes!: string;

  @IsOptional()
  @IsString()
  contentBase64?: string;

  @IsOptional()
  @IsString()
  checksumSha256?: string;
}

class AdvanceAllowanceBody {
  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsNumberString()
  amount?: string;

  @IsOptional()
  @IsNumberString()
  percent?: string;
}

class QiwaBody {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  ref?: string;
}

class QiwaRejectBody {
  @IsString()
  @MinLength(1)
  notes!: string;
}

class QiwaConfirmBody {
  @IsString()
  @MinLength(2)
  qiwaContractReference!: string;

  @IsString()
  documentedAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsNumberString()
  sizeBytes!: string;

  @IsString()
  @MinLength(1)
  contentBase64!: string;
}

class CreateShiftBody {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;

  @IsOptional()
  @IsNumber()
  breakMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class AssignShiftBody {
  @IsString()
  shiftId!: string;

  @IsString()
  effectiveFrom!: string;

  @IsOptional()
  @IsString()
  effectiveTo?: string;
}

class SubmitSaleBody {
  @IsString()
  saleDate!: string;

  @IsNumberString()
  amount!: string;

  @IsEnum(SalesPaymentMethod)
  paymentMethod!: SalesPaymentMethod;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  salesInvoiceId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  receiptAttachmentId?: string;
}

class AdminSubmitSaleBody extends SubmitSaleBody {
  @IsString()
  employeeId!: string;
}

class DecideSaleBody {
  @IsEnum(['APPROVED', 'REJECTED'] as const)
  status!: 'APPROVED' | 'REJECTED';
}

class TargetCompletedBody {
  @IsOptional()
  @IsNumberString()
  targetCompletedPercent?: string;
}

@Controller('companies/:companyId/hr')
export class HrController {
  constructor(
    private readonly hr: HrService,
    private readonly qiwa: HrQiwaService,
  ) {}

  @Get('summary')
  @RequirePermissions('hr.read')
  summary(@Param('companyId') companyId: string) {
    return this.hr.employeeSummary(companyId);
  }

  @Get('employees')
  @RequirePermissions('hr.read')
  listEmployees(@Param('companyId') companyId: string) {
    return this.hr.listEmployees(companyId);
  }

  @Get('employees/:employeeId')
  @RequirePermissions('hr.read')
  getEmployee(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.hr.getEmployee(companyId, employeeId);
  }

  @Post('employees')
  @RequirePermissions('hr.write')
  createEmployee(
    @Param('companyId') companyId: string,
    @Body() body: CreateEmployeeBody,
  ) {
    return this.hr.createEmployee({ companyId, ...body });
  }

  @Patch('employees/:employeeId')
  @RequirePermissions('hr.write')
  updateEmployee(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Body() body: UpdateEmployeeBody,
  ) {
    return this.hr.updateEmployee(companyId, employeeId, body);
  }

  @Patch('employees/:employeeId/status')
  @RequirePermissions('hr.write')
  updateEmployeeStatus(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Body() body: UpdateEmployeeStatusBody,
  ) {
    return this.hr.updateEmployeeStatus(
      companyId,
      employeeId,
      body.employmentStatus,
    );
  }

  @Post('employees/:employeeId/insurance')
  @RequirePermissions('hr.write')
  uploadInsurance(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Body() body: AttachmentBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hr.uploadInsurance(companyId, employeeId, user.userId, body);
  }

  @Patch('employees/:employeeId/advance-allowance')
  @RequirePermissions('hr.write')
  setAdvanceAllowance(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Body() body: AdvanceAllowanceBody,
  ) {
    return this.hr.setAdvanceAllowance(companyId, employeeId, body);
  }

  @Post('employees/:employeeId/qiwa')
  @RequirePermissions('hr.write')
  setQiwa(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Body() body: QiwaBody,
  ) {
    return this.hr.setQiwa(companyId, employeeId, body);
  }

  @Get('employees/:employeeId/qiwa-contract')
  @RequirePermissions('hr.read')
  getQiwaContract(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.qiwa.getCurrent(companyId, employeeId);
  }

  @Get('employees/:employeeId/qiwa-contract/summary')
  @RequirePermissions('hr.qiwa.manage')
  getQiwaSummary(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.qiwa.getEmployeeSummaryForQiwa(companyId, employeeId);
  }

  @Post('employees/:employeeId/qiwa-contract/start')
  @RequirePermissions('hr.qiwa.manage')
  startQiwa(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.qiwa.startDocumentation(companyId, employeeId, user.userId);
  }

  @Post('employees/:employeeId/qiwa-contract/mark-sent')
  @RequirePermissions('hr.qiwa.manage')
  markQiwaSent(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.qiwa.markSent(companyId, employeeId, user.userId);
  }

  @Post('employees/:employeeId/qiwa-contract/mark-rejected')
  @RequirePermissions('hr.qiwa.manage')
  markQiwaRejected(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Body() body: QiwaRejectBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.qiwa.markRejected(
      companyId,
      employeeId,
      user.userId,
      body.notes,
    );
  }

  @Post('employees/:employeeId/qiwa-contract/retry')
  @RequirePermissions('hr.qiwa.manage')
  retryQiwa(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.qiwa.retryDocumentation(companyId, employeeId, user.userId);
  }

  @Post('employees/:employeeId/qiwa-contract/confirm')
  @RequirePermissions('hr.qiwa.manage')
  confirmQiwa(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Body() body: QiwaConfirmBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.qiwa.confirmDocumentation(
      companyId,
      employeeId,
      user.userId,
      body,
    );
  }

  @Post('employees/:employeeId/qiwa-contract/approve')
  @RequirePermissions('hr.qiwa.approve')
  approveQiwa(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.qiwa.approveDocumentation(companyId, employeeId, user.userId);
  }

  @Post('employees/:employeeId/qiwa-contract/reject-approval')
  @RequirePermissions('hr.qiwa.approve')
  rejectQiwaApproval(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Body() body: QiwaRejectBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.qiwa.rejectApproval(
      companyId,
      employeeId,
      user.userId,
      body.notes,
    );
  }

  @Post('employees/:employeeId/shifts')
  @RequirePermissions('hr.write')
  assignShift(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Body() body: AssignShiftBody,
  ) {
    return this.hr.assignEmployeeShift(companyId, employeeId, body);
  }

  @Get('employees/:employeeId/personal-report')
  @RequirePermissions('hr.read')
  personalReport(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.hr.personalReport(companyId, employeeId, from, to);
  }

  @Get('attendance')
  @RequirePermissions('hr.read')
  listAttendance(@Param('companyId') companyId: string) {
    return this.hr.listAttendance(companyId);
  }

  @Post('attendance')
  @RequirePermissions('hr.write')
  upsertAttendance(
    @Param('companyId') companyId: string,
    @Body() body: UpsertAttendanceBody,
  ) {
    return this.hr.upsertAttendance({ companyId, ...body });
  }

  @Get('leaves')
  @RequirePermissions('hr.read')
  listLeaves(@Param('companyId') companyId: string) {
    return this.hr.listLeaves(companyId);
  }

  @Post('leaves')
  @RequirePermissions('hr.write')
  createLeave(
    @Param('companyId') companyId: string,
    @Body() body: CreateLeaveBody,
  ) {
    return this.hr.createLeave({ companyId, ...body });
  }

  @Patch('leaves/:leaveId/decision')
  @RequirePermissions('hr.write')
  decideLeave(
    @Param('companyId') companyId: string,
    @Param('leaveId') leaveId: string,
    @Body() body: DecideLeaveBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hr.decideLeave(companyId, leaveId, body.status, user.userId);
  }

  @Get('payroll-runs')
  @RequirePermissions('hr.read')
  listPayroll(@Param('companyId') companyId: string) {
    return this.hr.listPayrollRuns(companyId);
  }

  @Post('payroll-runs')
  @RequirePermissions('hr.write')
  createPayroll(
    @Param('companyId') companyId: string,
    @Body() body: CreatePayrollBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hr.createPayrollRun({
      companyId,
      createdById: user.userId,
      ...body,
    });
  }

  @Patch('payroll-runs/:payrollRunId/status')
  @RequirePermissions('hr.write')
  updatePayrollStatus(
    @Param('companyId') companyId: string,
    @Param('payrollRunId') payrollRunId: string,
    @Body() body: UpdatePayrollStatusBody,
  ) {
    return this.hr.updatePayrollStatus(companyId, payrollRunId, body.status);
  }

  @Get('contracts')
  @RequirePermissions('hr.read')
  listContracts(
    @Param('companyId') companyId: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.hr.listContracts(companyId, employeeId);
  }

  @Post('contracts')
  @RequirePermissions('hr.write')
  createContract(
    @Param('companyId') companyId: string,
    @Body() body: CreateContractBody,
  ) {
    return this.hr.createContract({ companyId, ...body });
  }

  @Patch('contracts/:contractId')
  @RequirePermissions('hr.write')
  updateContract(
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Body() body: UpdateContractBody,
  ) {
    return this.hr.updateContract(companyId, contractId, body);
  }

  @Post('contracts/:contractId/submit')
  @RequirePermissions('hr.write')
  submitContract(
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
  ) {
    return this.hr.submitContract(companyId, contractId);
  }

  @Get('advances')
  @RequirePermissions('hr.read')
  listAdvances(
    @Param('companyId') companyId: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.hr.listAdvances(companyId, employeeId);
  }

  @Post('advances')
  @RequirePermissions('hr.write')
  requestAdvance(
    @Param('companyId') companyId: string,
    @Body() body: AdvanceBody,
  ) {
    return this.hr.requestAdvance({ companyId, ...body });
  }

  @Patch('advances/:advanceId/decision')
  @RequirePermissions('hr.write')
  decideAdvance(
    @Param('companyId') companyId: string,
    @Param('advanceId') advanceId: string,
    @Body() body: DecideAdvanceBody,
    @CurrentUser() user: AuthUser,
  ) {
    if (!['APPROVED', 'REJECTED', 'PAID', 'CANCELLED'].includes(body.status)) {
      return this.hr.decideAdvance(
        companyId,
        advanceId,
        'REJECTED',
        user.userId,
      );
    }
    return this.hr.decideAdvance(
      companyId,
      advanceId,
      body.status as 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED',
      user.userId,
    );
  }

  @Get('shifts')
  @RequirePermissions('hr.read')
  listShifts(@Param('companyId') companyId: string) {
    return this.hr.listShifts(companyId);
  }

  @Post('shifts')
  @RequirePermissions('hr.write')
  createShift(
    @Param('companyId') companyId: string,
    @Body() body: CreateShiftBody,
  ) {
    return this.hr.createShift({ companyId, ...body });
  }

  @Get('sales-submissions')
  @RequirePermissions('hr.read')
  listSales(
    @Param('companyId') companyId: string,
    @Query('status') status?: EmployeeSalesStatus,
  ) {
    return this.hr.listSalesSubmissions(companyId, status);
  }

  @Get('payable-invoices')
  @RequireAnyPermission('hr.self', 'hr.read')
  listPayableInvoices(@Param('companyId') companyId: string) {
    return this.hr.listPayableInvoices(companyId);
  }

  @Post('sales-submissions')
  @RequirePermissions('hr.write')
  submitSale(
    @Param('companyId') companyId: string,
    @Body() body: AdminSubmitSaleBody,
  ) {
    if (!body.employeeId?.trim()) {
      throw new BadRequestException('employeeId is required');
    }
    return this.hr.submitSale({
      companyId,
      employeeId: body.employeeId,
      saleDate: body.saleDate,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      invoiceNumber: body.invoiceNumber,
      salesInvoiceId: body.salesInvoiceId,
      notes: body.notes,
      receiptAttachmentId: body.receiptAttachmentId,
    });
  }

  @Post('sales-submissions/:id/receipt')
  @RequirePermissions('hr.write')
  attachReceipt(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: AttachmentBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hr.attachSaleReceipt(companyId, id, user.userId, body);
  }

  @Patch('sales-submissions/:id/decision')
  @RequirePermissions('hr.read')
  decideSale(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: DecideSaleBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hr.decideSale(
      companyId,
      id,
      body.status,
      user.userId,
      user.permissions ?? [],
      user.isPlatformAdmin,
    );
  }

  @Get('personal-reports')
  @RequirePermissions('hr.read')
  listPersonalReports(
    @Param('companyId') companyId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.hr.listPersonalReports(companyId, from, to, employeeId);
  }

  @Get('purchase-operators')
  @RequirePermissions('purchasing.read')
  listOperators(@Param('companyId') companyId: string) {
    return this.hr.listPurchaseOperators(companyId);
  }

  @Post('ewallets')
  @RequirePermissions('purchasing.write')
  upsertEwallet(
    @Param('companyId') companyId: string,
    @Body() body: EwalletBody,
  ) {
    return this.hr.upsertEwallet({ companyId, ...body });
  }

  @Get('devices')
  @RequirePermissions('hr.read')
  listDevices(@Param('companyId') companyId: string) {
    return this.hr.listDevices(companyId);
  }

  @Post('devices')
  @RequirePermissions('hr.write')
  createDevice(
    @Param('companyId') companyId: string,
    @Body() body: CreateDeviceBody,
  ) {
    return this.hr.createDevice({ companyId, ...body });
  }

  @Get('device-events')
  @RequirePermissions('hr.read')
  listDeviceEvents(@Param('companyId') companyId: string) {
    return this.hr.listDeviceEvents(companyId);
  }

  @Public()
  @Post('devices/punch')
  devicePunch(
    @Param('companyId') companyId: string,
    @Body() body: DevicePunchBody,
  ) {
    return this.hr.ingestDevicePunch({ companyId, ...body });
  }

  @Get('me')
  @RequireAnyPermission('hr.self', 'hr.read')
  myProfile(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hr.myProfile(companyId, user.userId);
  }

  @Patch('me')
  @RequireAnyPermission('hr.self', 'hr.read')
  updateMyProfile(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: MyProfileBody,
  ) {
    return this.hr.updateMyInfo(companyId, user.userId, body);
  }

  @Post('me/advances')
  @RequireAnyPermission('hr.self', 'hr.read')
  myAdvance(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: MyAdvanceBody,
  ) {
    return this.hr.myRequestAdvance(
      companyId,
      user.userId,
      body.amount,
      body.reason,
    );
  }

  @Post('me/leaves')
  @RequireAnyPermission('hr.self', 'hr.read')
  myLeave(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: MyLeaveBody,
  ) {
    return this.hr.myRequestLeave(companyId, user.userId, body);
  }

  @Post('me/sales')
  @RequireAnyPermission('hr.self', 'hr.read')
  mySalesSubmit(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: SubmitSaleBody,
  ) {
    return this.hr.mySubmitSale(companyId, user.userId, body);
  }

  @Get('me/sales')
  @RequireAnyPermission('hr.self', 'hr.read')
  mySalesList(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hr.listMySales(companyId, user.userId);
  }

  @Patch('me/target-completed')
  @RequireAnyPermission('hr.self', 'hr.read')
  myTargetCompleted(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hr.updateMyTargetCompleted(companyId, user.userId);
  }
}
