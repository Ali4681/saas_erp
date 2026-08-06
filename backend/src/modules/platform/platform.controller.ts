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
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MarketingChannel,
  MarketingConnectionStatus,
  MarketingMediaType,
  MarketingPostStatus,
} from '../../generated/prisma/client';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { PlatformService } from './platform.service';

class MediaBody {
  @IsEnum(MarketingMediaType)
  mediaType!: MarketingMediaType;

  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsNumberString()
  sizeBytes!: string;

  @IsOptional()
  @IsString()
  contentBase64?: string;

  @IsOptional()
  @IsString()
  checksumSha256?: string;

  @IsOptional()
  @IsNumber()
  position?: number;
}

class CreatePostBody {
  @IsString()
  @MinLength(1)
  content!: string;

  @IsEnum(MarketingChannel)
  channel!: MarketingChannel;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(MarketingPostStatus)
  status?: MarketingPostStatus;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaBody)
  media?: MediaBody[];
}

class UpdatePostBody {
  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

  @IsOptional()
  @IsString()
  title?: string | null;

  @IsOptional()
  @IsEnum(MarketingChannel)
  channel?: MarketingChannel;

  @IsOptional()
  @IsEnum(MarketingPostStatus)
  status?: MarketingPostStatus;

  @IsOptional()
  @IsString()
  scheduledAt?: string | null;
}

class ScheduleBody {
  @IsString()
  scheduledAt!: string;
}

class ListPostsQuery {
  @IsOptional()
  @IsEnum(MarketingPostStatus)
  status?: MarketingPostStatus;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeArchived?: boolean;
}

class CalendarQuery {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsEnum(MarketingChannel)
  channel?: MarketingChannel;
}

class LimitQuery {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;
}

class UpsertConnectionBody {
  @IsEnum(MarketingChannel)
  channel!: MarketingChannel;

  @IsString()
  @MinLength(1)
  displayName!: string;

  @IsOptional()
  @IsString()
  externalAccountId?: string;

  @IsOptional()
  @IsEnum(MarketingConnectionStatus)
  status?: MarketingConnectionStatus;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;
}

class ConnectionStatusBody {
  @IsEnum(MarketingConnectionStatus)
  status!: MarketingConnectionStatus;

  @IsOptional()
  @IsString()
  lastError?: string;
}

class RegisterAttachmentBody {
  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;

  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsNumberString()
  sizeBytes!: string;

  @IsOptional()
  @IsString()
  contentBase64?: string;

  @IsOptional()
  @IsString()
  checksumSha256?: string;
}

class LogAiUsageBody {
  @IsString()
  module!: string;

  @IsString()
  provider!: string;

  @IsString()
  model!: string;

  @IsOptional()
  @IsNumber()
  inputTokens?: number;

  @IsOptional()
  @IsNumber()
  outputTokens?: number;

  @IsOptional()
  @IsNumberString()
  estimatedCost?: string;

  @IsOptional()
  @IsString()
  requestReference?: string;
}

class AttachmentsQuery {
  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;
}

@Controller('companies/:companyId')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  // --- Marketing 14.1–14.4 ---

  @Get('marketing/posts')
  @RequirePermissions('marketing.read')
  listPosts(
    @Param('companyId') companyId: string,
    @Query() query: ListPostsQuery,
  ) {
    return this.platform.listPosts(companyId, query);
  }

  @Get('marketing/posts/:postId')
  @RequirePermissions('marketing.read')
  getPost(
    @Param('companyId') companyId: string,
    @Param('postId') postId: string,
  ) {
    return this.platform.getPost(companyId, postId);
  }

  @Post('marketing/posts')
  @RequirePermissions('marketing.write')
  createPost(
    @Param('companyId') companyId: string,
    @Body() body: CreatePostBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.platform.createPost({
      companyId,
      createdById: user.userId,
      ...body,
    });
  }

  @Patch('marketing/posts/:postId')
  @RequirePermissions('marketing.write')
  updatePost(
    @Param('companyId') companyId: string,
    @Param('postId') postId: string,
    @Body() body: UpdatePostBody,
  ) {
    return this.platform.updatePost(companyId, postId, body);
  }

  @Post('marketing/posts/:postId/media')
  @RequirePermissions('marketing.write')
  addMedia(
    @Param('companyId') companyId: string,
    @Param('postId') postId: string,
    @Body() body: MediaBody,
  ) {
    return this.platform.addPostMedia(companyId, postId, body);
  }

  @Delete('marketing/posts/:postId/media/:mediaId')
  @RequirePermissions('marketing.write')
  removeMedia(
    @Param('companyId') companyId: string,
    @Param('postId') postId: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.platform.removePostMedia(companyId, postId, mediaId);
  }

  @Post('marketing/posts/:postId/schedule')
  @RequirePermissions('marketing.write')
  schedulePost(
    @Param('companyId') companyId: string,
    @Param('postId') postId: string,
    @Body() body: ScheduleBody,
  ) {
    return this.platform.schedulePost(companyId, postId, body.scheduledAt);
  }

  @Patch('marketing/posts/:postId/reschedule')
  @RequirePermissions('marketing.write')
  reschedulePost(
    @Param('companyId') companyId: string,
    @Param('postId') postId: string,
    @Body() body: ScheduleBody,
  ) {
    return this.platform.reschedulePost(companyId, postId, body.scheduledAt);
  }

  @Post('marketing/posts/:postId/publish')
  @RequirePermissions('marketing.write')
  publishPost(
    @Param('companyId') companyId: string,
    @Param('postId') postId: string,
  ) {
    return this.platform.publishPost(companyId, postId);
  }

  @Post('marketing/posts/:postId/archive')
  @RequirePermissions('marketing.write')
  archivePost(
    @Param('companyId') companyId: string,
    @Param('postId') postId: string,
  ) {
    return this.platform.archivePost(companyId, postId);
  }

  @Get('marketing/calendar')
  @RequirePermissions('marketing.read')
  calendar(
    @Param('companyId') companyId: string,
    @Query() query: CalendarQuery,
  ) {
    return this.platform.calendar(companyId, query);
  }

  @Get('marketing/calendar/upcoming')
  @RequirePermissions('marketing.read')
  upcoming(
    @Param('companyId') companyId: string,
    @Query() query: LimitQuery,
  ) {
    return this.platform.upcomingPosts(companyId, query.limit);
  }

  @Get('marketing/calendar/published')
  @RequirePermissions('marketing.read')
  published(
    @Param('companyId') companyId: string,
    @Query() query: LimitQuery,
  ) {
    return this.platform.publishedPosts(companyId, query.limit);
  }

  @Get('marketing/connections')
  @RequirePermissions('marketing.read')
  listConnections(@Param('companyId') companyId: string) {
    return this.platform.listConnections(companyId);
  }

  @Post('marketing/connections')
  @RequirePermissions('marketing.write')
  upsertConnection(
    @Param('companyId') companyId: string,
    @Body() body: UpsertConnectionBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.platform.upsertConnection({
      companyId,
      createdById: user.userId,
      ...body,
    });
  }

  @Patch('marketing/connections/:connectionId/status')
  @RequirePermissions('marketing.write')
  connectionStatus(
    @Param('companyId') companyId: string,
    @Param('connectionId') connectionId: string,
    @Body() body: ConnectionStatusBody,
  ) {
    return this.platform.updateConnectionStatus(
      companyId,
      connectionId,
      body.status,
      body.lastError,
    );
  }

  // --- Attachments ---

  @Get('attachments')
  @RequirePermissions('attachments.read')
  listAttachments(
    @Param('companyId') companyId: string,
    @Query() query: AttachmentsQuery,
  ) {
    return this.platform.listAttachments(
      companyId,
      query.entityType,
      query.entityId,
    );
  }

  @Get('attachments/:attachmentId')
  @RequirePermissions('attachments.read')
  getAttachment(
    @Param('companyId') companyId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.platform.getAttachment(companyId, attachmentId);
  }

  @Post('attachments')
  @RequirePermissions('attachments.write')
  registerAttachment(
    @Param('companyId') companyId: string,
    @Body() body: RegisterAttachmentBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.platform.registerAttachment({
      companyId,
      uploadedById: user.userId,
      ...body,
    });
  }

  // --- AI usage ---

  @Get('ai-usage')
  @RequirePermissions('ai.read')
  listAiUsage(@Param('companyId') companyId: string) {
    return this.platform.listAiUsage(companyId);
  }

  @Get('ai-usage/summary')
  @RequirePermissions('ai.read')
  aiSummary(@Param('companyId') companyId: string) {
    return this.platform.aiUsageSummary(companyId);
  }

  @Post('ai-usage')
  @RequirePermissions('ai.write')
  logAiUsage(
    @Param('companyId') companyId: string,
    @Body() body: LogAiUsageBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.platform.logAiUsage({
      companyId,
      userId: user.userId,
      ...body,
    });
  }
}
