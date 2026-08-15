import { Controller, Get, Param, Query } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { RequirePermissions } from '../auth/auth.decorators';
import { AuditService } from './audit.service';

class AuditQuery {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  actorUserId?: string;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  operation?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

@Controller('companies/:companyId/audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('audit.read')
  list(@Param('companyId') companyId: string, @Query() query: AuditQuery) {
    return this.audit.list(companyId, {
      ...query,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }
}
