import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import {
  AttendanceDeviceStatus,
  AttendanceDeviceType,
} from '../../generated/prisma/client';
import { Public, RequirePermissions } from '../../common/auth/auth.decorators';
import { TrackingService } from './tracking.service';

class CreateCameraBody {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  deviceKey?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  streamUrl?: string;

  @IsOptional()
  @IsEnum(AttendanceDeviceType)
  deviceType?: AttendanceDeviceType;
}

class CreateBiometricBody {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  deviceKey?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  streamUrl?: string;

  @IsOptional()
  @IsEnum(AttendanceDeviceType)
  deviceType?: AttendanceDeviceType;
}

class UpdateDeviceBody {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEnum(AttendanceDeviceStatus)
  status?: AttendanceDeviceStatus;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  streamUrl?: string | null;
}

class DevicePunchBody {
  @IsString()
  deviceKey!: string;

  @IsString()
  eventType!: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  externalRef?: string;

  @IsOptional()
  @IsString()
  occurredAt?: string;
}

@Controller('companies/:companyId/tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Get('cameras')
  @RequirePermissions('tracking.read')
  listCameras(@Param('companyId') companyId: string) {
    return this.tracking.listCameras(companyId);
  }

  @Post('cameras')
  @RequirePermissions('tracking.write')
  createCamera(
    @Param('companyId') companyId: string,
    @Body() body: CreateCameraBody,
  ) {
    const deviceType =
      body.deviceType === 'BOTH' || body.deviceType === 'CAMERA'
        ? body.deviceType
        : 'CAMERA';
    return this.tracking.createCamera(companyId, { ...body, deviceType });
  }

  @Get('biometrics')
  @RequirePermissions('tracking.read')
  listBiometrics(@Param('companyId') companyId: string) {
    return this.tracking.listBiometrics(companyId);
  }

  @Post('biometrics')
  @RequirePermissions('tracking.write')
  createBiometric(
    @Param('companyId') companyId: string,
    @Body() body: CreateBiometricBody,
  ) {
    const deviceType =
      body.deviceType === 'BOTH' || body.deviceType === 'BIOMETRIC'
        ? body.deviceType
        : 'BIOMETRIC';
    return this.tracking.createBiometric(companyId, { ...body, deviceType });
  }

  @Patch('devices/:deviceId')
  @RequirePermissions('tracking.write')
  updateDevice(
    @Param('companyId') companyId: string,
    @Param('deviceId') deviceId: string,
    @Body() body: UpdateDeviceBody,
  ) {
    return this.tracking.updateDevice(companyId, deviceId, body);
  }

  @Get('events')
  @RequirePermissions('tracking.read')
  listEvents(
    @Param('companyId') companyId: string,
    @Query('deviceId') deviceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.tracking.listEvents(companyId, {
      deviceId,
      from,
      to,
      employeeId,
    });
  }

  @Public()
  @Post('devices/punch')
  punch(@Param('companyId') companyId: string, @Body() body: DevicePunchBody) {
    return this.tracking.punch(companyId, body);
  }
}
