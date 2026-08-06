import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import {
  CompanyApiKeyStatus,
  CompanyWebhookStatus,
} from '../../generated/prisma/client';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { CompanyIntegrationsService } from './company-integrations.service';

class CreateApiKeyBody {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsNumber()
  rateLimitPerMin?: number;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

class UpdateApiKeyStatusBody {
  @IsEnum(CompanyApiKeyStatus)
  status!: CompanyApiKeyStatus;
}

class LogApiRequestBody {
  @IsString()
  method!: string;

  @IsString()
  path!: string;

  @IsNumber()
  statusCode!: number;

  @IsOptional()
  @IsString()
  companyApiKeyId?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsNumber()
  durationMs?: number;
}

class CreateWebhookBody {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  targetUrl!: string;

  @IsArray()
  @IsString({ each: true })
  events!: string[];
}

class UpdateWebhookStatusBody {
  @IsEnum(CompanyWebhookStatus)
  status!: CompanyWebhookStatus;
}

class DeliverWebhookBody {
  @IsString()
  eventType!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}

class DeliveriesQuery {
  @IsOptional()
  @IsString()
  webhookId?: string;
}

@Controller('companies/:companyId/integration-center')
export class CompanyIntegrationsController {
  constructor(private readonly integrations: CompanyIntegrationsService) {}

  @Get('api-keys')
  @RequirePermissions('integration_center.read')
  listApiKeys(@Param('companyId') companyId: string) {
    return this.integrations.listApiKeys(companyId);
  }

  @Post('api-keys')
  @RequirePermissions('integration_center.write')
  createApiKey(
    @Param('companyId') companyId: string,
    @Body() body: CreateApiKeyBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.integrations.createApiKey({
      companyId,
      createdById: user.userId,
      ...body,
    });
  }

  @Patch('api-keys/:apiKeyId/status')
  @RequirePermissions('integration_center.write')
  updateApiKeyStatus(
    @Param('companyId') companyId: string,
    @Param('apiKeyId') apiKeyId: string,
    @Body() body: UpdateApiKeyStatusBody,
  ) {
    return this.integrations.updateApiKeyStatus(
      companyId,
      apiKeyId,
      body.status,
    );
  }

  @Get('api-request-logs')
  @RequirePermissions('integration_center.read')
  listApiLogs(@Param('companyId') companyId: string) {
    return this.integrations.listApiRequestLogs(companyId);
  }

  @Post('api-request-logs')
  @RequirePermissions('integration_center.write')
  logApiRequest(
    @Param('companyId') companyId: string,
    @Body() body: LogApiRequestBody,
  ) {
    return this.integrations.logApiRequest({ companyId, ...body });
  }

  @Get('webhooks')
  @RequirePermissions('integration_center.read')
  listWebhooks(@Param('companyId') companyId: string) {
    return this.integrations.listWebhooks(companyId);
  }

  @Post('webhooks')
  @RequirePermissions('integration_center.write')
  createWebhook(
    @Param('companyId') companyId: string,
    @Body() body: CreateWebhookBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.integrations.createWebhook({
      companyId,
      createdById: user.userId,
      ...body,
    });
  }

  @Patch('webhooks/:webhookId/status')
  @RequirePermissions('integration_center.write')
  updateWebhookStatus(
    @Param('companyId') companyId: string,
    @Param('webhookId') webhookId: string,
    @Body() body: UpdateWebhookStatusBody,
  ) {
    return this.integrations.updateWebhookStatus(
      companyId,
      webhookId,
      body.status,
    );
  }

  @Post('webhooks/:webhookId/deliver')
  @RequirePermissions('integration_center.write')
  deliverWebhook(
    @Param('companyId') companyId: string,
    @Param('webhookId') webhookId: string,
    @Body() body: DeliverWebhookBody,
  ) {
    return this.integrations.deliverWebhookEvent(
      companyId,
      webhookId,
      body.eventType,
      body.payload ?? {},
    );
  }

  @Get('webhook-deliveries')
  @RequirePermissions('integration_center.read')
  listDeliveries(
    @Param('companyId') companyId: string,
    @Query() query: DeliveriesQuery,
  ) {
    return this.integrations.listWebhookDeliveries(
      companyId,
      query.webhookId,
    );
  }
}
