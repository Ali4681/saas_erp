import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { ReportsService, type ReportModule } from './reports.service';

class ReportQuery {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

const MODULES = new Set<string>([
  'customers',
  'crm',
  'sales',
  'purchases',
  'purchasing',
  'inventory',
  'hr',
  'finance',
  'daily-closing',
  'projects',
  'work',
  'notes',
  'notebook',
  'automation',
]);

@Controller('companies/:companyId/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** 17.1 Executive / GM dashboard */
  @Get('executive')
  @RequirePermissions('reports.read')
  executive(
    @Param('companyId') companyId: string,
    @Query() query: ReportQuery,
  ) {
    return this.reports.executiveDashboard(companyId, {
      ...query,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  /** 17.2 Operational reports + 17.3 shared filters */
  @Get('modules/:module')
  @RequirePermissions('reports.read')
  moduleReport(
    @Param('companyId') companyId: string,
    @Param('module') module: string,
    @Query() query: ReportQuery,
  ) {
    if (!MODULES.has(module)) {
      throw new BadRequestException(
        `Unknown module: ${module}. Use one of: customers, sales, purchases, inventory, hr, finance, projects, notes, automation`,
      );
    }
    return this.reports.operationalReport(companyId, module as ReportModule, {
      ...query,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }
}
