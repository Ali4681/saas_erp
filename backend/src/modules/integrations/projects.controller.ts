import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AuthType,
  ProjectEnvironment,
  ProjectStatus,
} from '../../generated/prisma/client';
import {
  CurrentUser,
  RequirePermissions,
} from '../../common/auth/auth.decorators';
import type { AuthUser } from '../../common/auth/auth.decorators';
import { ProjectsService } from './projects.service';

class CredentialBody {
  @IsEnum(AuthType)
  authType!: AuthType;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

class CreateProjectBody {
  @IsString()
  categoryCode!: string;

  @IsString()
  providerCode!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsEnum(ProjectEnvironment)
  environment?: ProjectEnvironment;

  @IsOptional()
  @IsString()
  externalAccountId?: string;

  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CredentialBody)
  credentials?: CredentialBody;
}

class UpdateStatusBody {
  @IsEnum(ProjectStatus)
  status!: ProjectStatus;
}

@Controller('companies/:companyId/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @RequirePermissions('integrations.read')
  list(@Param('companyId') companyId: string) {
    return this.projects.list(companyId);
  }

  @Post()
  @RequirePermissions('integrations.write')
  create(
    @Param('companyId') companyId: string,
    @Body() body: CreateProjectBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.create({
      companyId,
      categoryCode: body.categoryCode,
      providerCode: body.providerCode,
      name: body.name,
      createdById: user.userId,
      environment: body.environment,
      externalAccountId: body.externalAccountId,
      defaultCurrency: body.defaultCurrency,
      credentials: body.credentials
        ? {
            authType: body.credentials.authType,
            payload: body.credentials.payload,
            expiresAt: body.credentials.expiresAt,
          }
        : undefined,
    });
  }

  @Get(':projectId')
  @RequirePermissions('integrations.read')
  get(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.get(companyId, projectId);
  }

  @Patch(':projectId/status')
  @RequirePermissions('integrations.write')
  updateStatus(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
    @Body() body: UpdateStatusBody,
  ) {
    return this.projects.updateStatus(companyId, projectId, body.status);
  }

  @Put(':projectId/credentials')
  @RequirePermissions('integrations.write')
  upsertCredentials(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
    @Body() body: CredentialBody,
  ) {
    return this.projects.upsertCredentials(companyId, projectId, {
      authType: body.authType,
      payload: body.payload,
      expiresAt: body.expiresAt,
    });
  }

  @Get(':projectId/adapter-status')
  @RequirePermissions('integrations.read')
  adapterStatus(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.adapterStatus(companyId, projectId);
  }

  @Post(':projectId/test-auth')
  @RequirePermissions('integrations.write')
  testAuth(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.testAuth(companyId, projectId);
  }

  @Get(':projectId/effective-capabilities')
  @RequirePermissions('integrations.read')
  effectiveCapabilities(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.listEffectiveCapabilities(companyId, projectId);
  }
}
