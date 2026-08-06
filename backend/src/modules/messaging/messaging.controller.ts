import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { MessagingProvider } from '../../generated/prisma/client';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { MessagingService } from './messaging.service';

class CreateChannelBody {
  @IsEnum(MessagingProvider)
  provider!: MessagingProvider;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

class CreateTemplateBody {
  @IsString()
  messagingChannelId!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(1)
  bodyTemplate!: string;

  @IsOptional()
  @IsString()
  subject?: string;
}

class SendMessageBody {
  @IsString()
  messagingChannelId!: string;

  @IsString()
  @MinLength(3)
  recipient!: string;

  @IsOptional()
  @IsString()
  messageTemplateId?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}

@Controller('companies/:companyId/messaging')
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get('channels')
  @RequirePermissions('messaging.read')
  listChannels(@Param('companyId') companyId: string) {
    return this.messaging.listChannels(companyId);
  }

  @Post('channels')
  @RequirePermissions('messaging.write')
  createChannel(
    @Param('companyId') companyId: string,
    @Body() body: CreateChannelBody,
  ) {
    return this.messaging.createChannel({ companyId, ...body });
  }

  @Get('templates')
  @RequirePermissions('messaging.read')
  listTemplates(@Param('companyId') companyId: string) {
    return this.messaging.listTemplates(companyId);
  }

  @Post('templates')
  @RequirePermissions('messaging.write')
  createTemplate(
    @Param('companyId') companyId: string,
    @Body() body: CreateTemplateBody,
  ) {
    return this.messaging.createTemplate({ companyId, ...body });
  }

  @Get('deliveries')
  @RequirePermissions('messaging.read')
  listDeliveries(@Param('companyId') companyId: string) {
    return this.messaging.listDeliveries(companyId);
  }

  @Post('send')
  @RequirePermissions('messaging.write')
  send(
    @Param('companyId') companyId: string,
    @Body() body: SendMessageBody,
  ) {
    return this.messaging.sendMessage({ companyId, ...body });
  }
}
