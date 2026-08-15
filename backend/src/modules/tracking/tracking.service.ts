import { Injectable } from '@nestjs/common';
import { HrService } from '../hr/hr.service';

@Injectable()
export class TrackingService {
  constructor(private readonly hr: HrService) {}

  listCameras(companyId: string) {
    return this.hr.listDevices(companyId, ['CAMERA', 'BOTH']);
  }

  listBiometrics(companyId: string) {
    return this.hr.listDevices(companyId, ['BIOMETRIC', 'BOTH']);
  }

  createCamera(
    companyId: string,
    input: {
      name: string;
      deviceKey?: string;
      location?: string;
      streamUrl?: string;
      deviceType?: 'CAMERA' | 'BOTH';
    },
  ) {
    return this.hr.createDevice({
      companyId,
      name: input.name,
      deviceKey: input.deviceKey,
      location: input.location,
      streamUrl: input.streamUrl,
      deviceType: input.deviceType ?? 'CAMERA',
    });
  }

  createBiometric(
    companyId: string,
    input: {
      name: string;
      deviceKey?: string;
      location?: string;
      streamUrl?: string;
      deviceType?: 'BIOMETRIC' | 'BOTH';
    },
  ) {
    return this.hr.createDevice({
      companyId,
      name: input.name,
      deviceKey: input.deviceKey,
      location: input.location,
      streamUrl: input.streamUrl,
      deviceType: input.deviceType ?? 'BIOMETRIC',
    });
  }

  updateDevice(
    companyId: string,
    deviceId: string,
    input: {
      name?: string;
      status?: 'ACTIVE' | 'INACTIVE';
      location?: string;
      streamUrl?: string | null;
    },
  ) {
    return this.hr.updateDevice(companyId, deviceId, input);
  }

  listEvents(
    companyId: string,
    filters?: {
      deviceId?: string;
      from?: string;
      to?: string;
      employeeId?: string;
    },
  ) {
    return this.hr.listDeviceEvents(companyId, filters);
  }

  punch(
    companyId: string,
    input: {
      deviceKey: string;
      eventType: string;
      employeeId?: string;
      externalRef?: string;
      occurredAt?: string;
    },
  ) {
    return this.hr.ingestDevicePunch({ companyId, ...input });
  }
}
