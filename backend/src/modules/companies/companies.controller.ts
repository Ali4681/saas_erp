import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CompanyBusinessCategory,
  ServiceRequestStatus,
} from '../../generated/prisma/client';
import {
  CurrentUser,
  RequireAnyPermission,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { CompaniesService } from './companies.service';
import { OnboardingService } from './onboarding.service';

class CreateCompanyBody {
  @IsString()
  @MinLength(2)
  legalName!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsString()
  @MinLength(2)
  slug!: string;

  @IsOptional()
  @IsEnum(CompanyBusinessCategory)
  businessCategory?: CompanyBusinessCategory;

  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  planCode?: string;

  /** Default VAT / tax rate (%) set by platform admin at company creation. */
  @IsOptional()
  @IsNumberString()
  defaultTaxRate?: string;

  /** Optional: create a tenant owner login. Platform can manage the company without this. */
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  ownerPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  ownerFullName?: string;

  @IsOptional()
  @IsString()
  logoFileName?: string;

  @IsOptional()
  @IsString()
  logoMimeType?: string;

  @IsOptional()
  @IsNumberString()
  logoSizeBytes?: string;

  @IsOptional()
  @IsString()
  logoContentBase64?: string;

  /** Establishment identity collected at signup / company creation. */
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @IsOptional()
  @IsString()
  commercialRegistrationNumber?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  unifiedNumber?: string;

  @IsOptional()
  @IsString()
  addressLine?: string;

  @IsOptional()
  @IsString()
  activityDescription?: string;

  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @IsOptional()
  @IsString()
  companyPhone?: string;

  @IsOptional()
  @IsEmail()
  companyEmail?: string;
}

class UpdateCompanyBody {
  @IsOptional()
  @IsString()
  @MinLength(2)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;

  @IsOptional()
  @IsEnum(CompanyBusinessCategory)
  businessCategory?: CompanyBusinessCategory;

  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  logoAttachmentId?: string;

  @IsOptional()
  @IsEnum({ ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED', CLOSED: 'CLOSED' })
  status?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
}

class UpdateCompanyLogoBody {
  @IsString() logoFileName!: string;
  @IsString() logoMimeType!: string;
  @IsNumberString() logoSizeBytes!: string;
  @IsString() logoContentBase64!: string;
}

class UpdateSettingsBody {
  @IsOptional()
  @IsString()
  taxNumber?: string | null;

  @IsOptional()
  @IsString()
  invoicePrefix?: string;

  @IsOptional()
  @IsString()
  defaultTaxRate?: string;

  @IsOptional()
  @IsString()
  emailFromName?: string | null;

  @IsOptional()
  @IsString()
  emailFromAddress?: string | null;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

class CreateDepartmentBody {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  parentDepartmentId?: string;
}

class UpdateDepartmentBody {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsOptional()
  @IsString()
  branchId?: string | null;

  @IsOptional()
  @IsString()
  parentDepartmentId?: string | null;

  @IsOptional()
  @IsEnum({ ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', ARCHIVED: 'ARCHIVED' })
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

class DepartmentsQuery {
  @IsOptional()
  @IsString()
  branchId?: string;
}

class ServiceRequestsQuery {
  @IsOptional()
  @IsEnum(ServiceRequestStatus)
  status?: ServiceRequestStatus;
}

class SaveOnboardingStepBody {
  @IsObject()
  data!: Record<string, unknown>;
}

class CreateServiceRequestBody {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  step!: number;

  @IsString()
  @MinLength(2)
  requestType!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class UpdateServiceRequestBody {
  @IsEnum(ServiceRequestStatus)
  status!: ServiceRequestStatus;
}

@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companies: CompaniesService,
    private readonly onboarding: OnboardingService,
  ) {}

  @Get()
  @RequirePermissions('companies.read')
  list() {
    return this.companies.list();
  }

  /** Platform inbox — must be registered before :id */
  @Get('service-requests')
  @RequirePermissions('companies.read')
  listServiceRequests(@Query() query: ServiceRequestsQuery) {
    return this.onboarding.listServiceRequests({ status: query.status });
  }

  @Patch('service-requests/:requestId')
  @RequirePermissions('companies.write')
  updateServiceRequest(
    @Param('requestId') requestId: string,
    @Body() body: UpdateServiceRequestBody,
  ) {
    return this.onboarding.updateServiceRequestStatus(requestId, body.status);
  }

  @Get(':id/onboarding')
  @RequirePermissions('companies.read')
  getOnboarding(@Param('id') id: string) {
    return this.onboarding.getStatus(id);
  }

  @Patch(':id/onboarding/steps/:step')
  @RequirePermissions('companies.write')
  saveOnboardingStep(
    @Param('id') id: string,
    @Param('step') stepRaw: string,
    @Body() body: SaveOnboardingStepBody,
    @CurrentUser() user: AuthUser,
  ) {
    const step = Number(stepRaw);
    return this.onboarding.saveStep(id, step, body.data ?? {}, user.userId);
  }

  @Post(':id/onboarding/steps/:step/skip')
  @RequirePermissions('companies.write')
  skipOnboardingStep(
    @Param('id') id: string,
    @Param('step') stepRaw: string,
  ) {
    return this.onboarding.skipStep(id, Number(stepRaw));
  }

  @Post(':id/onboarding/complete')
  @RequirePermissions('companies.write')
  completeOnboarding(@Param('id') id: string) {
    return this.onboarding.complete(id);
  }

  @Post(':id/onboarding/service-requests')
  @RequirePermissions('companies.write')
  createServiceRequest(
    @Param('id') id: string,
    @Body() body: CreateServiceRequestBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.onboarding.createServiceRequest(id, {
      step: body.step,
      requestType: body.requestType,
      note: body.note,
      userId: user.userId,
    });
  }

  @Get(':id/logo')
  @RequireAnyPermission('hr.self', 'companies.read', 'attachments.read')
  async getLogo(@Param('id') id: string) {
    return this.companies.getLogoFile(id);
  }

  @Get(':id')
  @RequirePermissions('companies.read')
  get(@Param('id') id: string) {
    return this.companies.get(id);
  }

  @Post()
  @RequirePermissions('companies.write')
  create(@Body() body: CreateCompanyBody, @CurrentUser() user: AuthUser) {
    return this.companies.create({
      ...body,
      uploadedById: user.userId,
    });
  }

  @Patch(':id')
  @RequirePermissions('companies.write')
  update(@Param('id') id: string, @Body() body: UpdateCompanyBody) {
    return this.companies.update(id, body);
  }

  @Patch(':id/logo')
  @RequirePermissions('companies.write')
  updateLogo(@Param('id') id: string, @Body() body: UpdateCompanyLogoBody, @CurrentUser() user: AuthUser) {
    return this.companies.updateLogo(id, body, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('companies.write')
  softDelete(@Param('id') id: string) {
    return this.companies.softDelete(id);
  }

  @Patch(':id/settings')
  @RequirePermissions('companies.write')
  updateSettings(@Param('id') id: string, @Body() body: UpdateSettingsBody) {
    return this.companies.updateSettings(id, body);
  }

  @Get(':id/departments')
  @RequirePermissions('companies.read')
  listDepartments(@Param('id') id: string, @Query() query: DepartmentsQuery) {
    return this.companies.listDepartments(id, query.branchId);
  }

  @Post(':id/departments')
  @RequirePermissions('companies.write')
  createDepartment(
    @Param('id') id: string,
    @Body() body: CreateDepartmentBody,
  ) {
    return this.companies.createDepartment({ companyId: id, ...body });
  }

  @Patch(':id/departments/:departmentId')
  @RequirePermissions('companies.write')
  updateDepartment(
    @Param('id') id: string,
    @Param('departmentId') departmentId: string,
    @Body() body: UpdateDepartmentBody,
  ) {
    return this.companies.updateDepartment(id, departmentId, body);
  }
}
