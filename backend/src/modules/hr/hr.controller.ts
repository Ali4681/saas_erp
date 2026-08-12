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
  MinLength,
} from 'class-validator';
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
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { HrService } from './hr.service';

class CreateEmployeeBody {
  @IsString()
  @MinLength(1)
  employeeNumber!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEnum(EmployeeIdentityType)
  identityType!: EmployeeIdentityType;

  @IsString()
  @MinLength(1)
  identityNumber!: string;

  @IsOptional()
  @IsString()
  identityExpiresOn?: string;

  @IsOptional()
  @IsString()
  iban?: string;

  @IsOptional()
  @IsString()
  ibanBankName?: string;

  @IsOptional()
  @IsEnum(SalesTargetMode)
  salesTargetMode?: SalesTargetMode;

  @IsOptional()
  @IsNumberString()
  salesTargetAmount?: string;

  @IsOptional()
  @IsNumberString()
  lateHourRate?: string;

  @IsOptional()
  @IsNumberString()
  advanceAllowanceMonthly?: string;

  @IsOptional()
  @IsString()
  advanceAllowanceMonth?: string;

  @IsOptional()
  @IsEnum(EmployeeApprovalStatus)
  approvalStatus?: EmployeeApprovalStatus;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  companyBranchId?: string;

  @IsOptional()
  @IsString()
  companyDepartmentId?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  hireDate?: string;

  @IsOptional()
  @IsNumberString()
  basicSalary?: string;

  @IsOptional()
  @IsNumberString()
  targetPercent?: string;

  @IsOptional()
  @IsNumberString()
  targetCompletedPercent?: string;

  @IsOptional()
  @IsNumberString()
  absenceDiscountPerDay?: string;

  @IsOptional()
  @IsNumberString()
  lateDiscountAmount?: string;

  @IsOptional()
  @IsBoolean()
  isPurchaseOperator?: boolean;

  @IsOptional()
  @IsString()
  currency?: string;
}

class UpdateEmployeeBody {
  @IsOptional()
  @IsEnum(EmployeeIdentityType)
  identityType?: EmployeeIdentityType;

  @IsOptional()
  @IsString()
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
  advanceAllowanceMonthly?: string;

  @IsOptional()
  @IsString()
  advanceAllowanceMonth?: string;

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

  @IsString()
  @MinLength(4)
  deviceKey!: string;

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
  @IsString()
  month!: string;

  @IsNumberString()
  amount!: string;
}

class QiwaBody {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  ref?: string;
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
  @IsNumberString()
  targetCompletedPercent!: string;
}

@Controller('companies/:companyId/hr')
export class HrController {
  constructor(private readonly hr: HrService) {}

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
  @RequirePermissions('hr.write')
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
  @RequirePermissions('hr.read')
  myProfile(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hr.myProfile(companyId, user.userId);
  }

  @Patch('me')
  @RequirePermissions('hr.read')
  updateMyProfile(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: MyProfileBody,
  ) {
    return this.hr.updateMyInfo(companyId, user.userId, body);
  }

  @Post('me/advances')
  @RequirePermissions('hr.read')
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
  @RequirePermissions('hr.read')
  myLeave(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: MyLeaveBody,
  ) {
    return this.hr.myRequestLeave(companyId, user.userId, body);
  }

  @Post('me/sales')
  @RequirePermissions('hr.read')
  mySalesSubmit(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: SubmitSaleBody,
  ) {
    return this.hr.mySubmitSale(companyId, user.userId, body);
  }

  @Get('me/sales')
  @RequirePermissions('hr.read')
  mySalesList(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hr.listMySales(companyId, user.userId);
  }

  @Patch('me/target-completed')
  @RequirePermissions('hr.read')
  myTargetCompleted(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: TargetCompletedBody,
  ) {
    return this.hr.updateMyTargetCompleted(
      companyId,
      user.userId,
      body.targetCompletedPercent,
    );
  }
}
