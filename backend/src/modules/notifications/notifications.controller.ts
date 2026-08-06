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
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { NotificationsService } from './notifications.service';

class ListQuery {
  @IsOptional()
  @IsString()
  unreadOnly?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

class RegisterDeviceBody {
  @IsString()
  @MinLength(20)
  token!: string;

  @IsString()
  platform!: string;

  @IsOptional()
  @IsString()
  deviceName?: string;
}

class UnregisterDeviceBody {
  @ValidateIf((o: UnregisterDeviceBody) => !o.token)
  @IsString()
  deviceId?: string;

  @ValidateIf((o: UnregisterDeviceBody) => !o.deviceId)
  @IsString()
  token?: string;
}

class SendNotificationBody {
  @IsString()
  userId!: string;

  @IsString()
  @MinLength(2)
  type!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsString()
  actionUrl?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  sendPush?: boolean;
}

@Controller('companies/:companyId/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('firebase/status')
  @RequirePermissions('notifications.read')
  firebaseStatus() {
    return this.notifications.firebaseStatus();
  }

  @Get()
  @RequirePermissions('notifications.read')
  list(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: ListQuery,
  ) {
    return this.notifications.listMine(companyId, user.userId, {
      unreadOnly: query.unreadOnly === 'true' || query.unreadOnly === '1',
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  @Get('unread-count')
  @RequirePermissions('notifications.read')
  unreadCount(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notifications.unreadCount(companyId, user.userId);
  }

  @Patch('read-all')
  @RequirePermissions('notifications.read')
  markAllRead(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notifications.markAllRead(companyId, user.userId);
  }

  @Patch(':notificationId/read')
  @RequirePermissions('notifications.read')
  markRead(
    @Param('companyId') companyId: string,
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notifications.markRead(
      companyId,
      user.userId,
      notificationId,
    );
  }

  @Get('devices')
  @RequirePermissions('notifications.read')
  listDevices(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notifications.listDevices(companyId, user.userId);
  }

  @Post('devices')
  @RequirePermissions('notifications.read')
  registerDevice(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: RegisterDeviceBody,
  ) {
    return this.notifications.registerDevice({
      companyId,
      userId: user.userId,
      ...body,
    });
  }

  @Delete('devices')
  @RequirePermissions('notifications.read')
  unregisterDevice(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: UnregisterDeviceBody,
  ) {
    return this.notifications.unregisterDevice(companyId, user.userId, body);
  }

  @Post('send')
  @RequirePermissions('notifications.write')
  send(
    @Param('companyId') companyId: string,
    @Body() body: SendNotificationBody,
  ) {
    return this.notifications.createAndPush({
      companyId,
      ...body,
    });
  }
}
