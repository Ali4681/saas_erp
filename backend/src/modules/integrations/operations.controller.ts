import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import {
  CurrentUser,
  RequirePermissions,
} from '../../common/auth/auth.decorators';
import type { AuthUser } from '../../common/auth/auth.decorators';
import { OperationsService } from './operations.service';

class CreateOperationBody {
  @IsString()
  capabilityCode!: string;

  @IsString()
  @MinLength(2)
  operationType!: string;

  @IsString()
  @MinLength(8)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  externalTargetId?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

@Controller('companies/:companyId/projects/:projectId/operations')
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get()
  @RequirePermissions('integrations.read')
  list(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.operations.list(companyId, projectId);
  }

  @Get(':operationId')
  @RequirePermissions('integrations.read')
  getOne(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
    @Param('operationId') operationId: string,
  ) {
    return this.operations.getOne(companyId, projectId, operationId);
  }

  @Post('invoke')
  @RequirePermissions('integrations.write')
  invoke(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
    @Body() body: CreateOperationBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.operations.invoke({
      companyId,
      projectId,
      capabilityCode: body.capabilityCode,
      operationType: body.operationType,
      idempotencyKey: body.idempotencyKey,
      requestedById: user.userId,
      externalTargetId: body.externalTargetId,
      payload: body.payload,
    });
  }

  @Post()
  @RequirePermissions('integrations.write')
  create(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
    @Body() body: CreateOperationBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.operations.create({
      companyId,
      projectId,
      capabilityCode: body.capabilityCode,
      operationType: body.operationType,
      idempotencyKey: body.idempotencyKey,
      requestedById: user.userId,
      externalTargetId: body.externalTargetId,
      payload: body.payload,
    });
  }
}
