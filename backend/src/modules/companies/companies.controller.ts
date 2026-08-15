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
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { CompanyBusinessCategory } from '../../generated/prisma/client';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { CompaniesService } from './companies.service';

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

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  @RequirePermissions('companies.read')
  list() {
    return this.companies.list();
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
