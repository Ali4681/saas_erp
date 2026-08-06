import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Public } from '../../common/auth/auth.decorators';
import { WebhooksService } from './webhooks.service';

class IngestWebhookBody {
  @IsString()
  @MinLength(2)
  eventType!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  providerEventId?: string;

  @IsOptional()
  @IsBoolean()
  signatureValid?: boolean;
}

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Public()
  @Post(':projectId')
  ingest(
    @Param('projectId') projectId: string,
    @Body() body: IngestWebhookBody,
    @Headers('x-provider-event-id') headerEventId?: string,
    @Headers('x-signature') signatureHeader?: string,
    @Headers('x-hub-signature-256') hubSignature?: string,
  ) {
    return this.webhooks.ingest({
      projectId,
      eventType: body.eventType,
      payload: body.payload,
      providerEventId: body.providerEventId ?? headerEventId,
      signatureValid: body.signatureValid,
      signatureHeader: signatureHeader ?? hubSignature,
      rawBody: JSON.stringify(body.payload ?? {}),
    });
  }
}
