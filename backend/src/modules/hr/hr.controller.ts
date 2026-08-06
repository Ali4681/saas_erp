import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  IsEnum,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import {
  AttendanceStatus,
  EmploymentStatus,
  LeaveStatus,
  PayrollStatus,
} from '../../generated/prisma/client';
import {
  CurrentUser,
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
  @IsString()
  currency?: string;
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

  @IsOptional()
  @IsString()
  reason?: string;
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

@Controller('companies/:companyId/hr')
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Get('employees')
  @RequirePermissions('hr.read')
  listEmployees(@Param('companyId') companyId: string) {
    return this.hr.listEmployees(companyId);
  }

  @Post('employees')
  @RequirePermissions('hr.write')
  createEmployee(
    @Param('companyId') companyId: string,
    @Body() body: CreateEmployeeBody,
  ) {
    return this.hr.createEmployee({ companyId, ...body });
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
}
