import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { FirebaseAdminService } from './firebase-admin.service';

const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly firebase: FirebaseAdminService,
  ) {}

  firebaseStatus() {
    return this.firebase.status;
  }

  listMine(
    companyId: string,
    userId: string,
    opts?: { unreadOnly?: boolean; limit?: number },
  ) {
    this.tenant.setCompanyId(companyId);
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    return this.prisma.notification.findMany({
      where: {
        companyId,
        userId,
        ...(opts?.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async unreadCount(companyId: string, userId: string) {
    this.tenant.setCompanyId(companyId);
    const count = await this.prisma.notification.count({
      where: { companyId, userId, readAt: null },
    });
    return { count };
  }

  async markRead(companyId: string, userId: string, notificationId: string) {
    this.tenant.setCompanyId(companyId);
    const row = await this.prisma.notification.findFirst({
      where: { id: notificationId, companyId, userId },
    });
    if (!row) throw new NotFoundException('Notification not found');
    if (row.readAt) return row;
    return this.prisma.notification.update({
      where: { id: row.id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(companyId: string, userId: string) {
    this.tenant.setCompanyId(companyId);
    const result = await this.prisma.notification.updateMany({
      where: { companyId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  listDevices(companyId: string, userId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.userPushDevice
      .findMany({
        where: { companyId, userId, disabledAt: null },
        orderBy: { lastSeenAt: 'desc' },
        select: {
          id: true,
          platform: true,
          deviceName: true,
          lastSeenAt: true,
          createdAt: true,
          token: true,
        },
      })
      .then((rows) =>
        rows.map(({ token, ...row }) => ({
          ...row,
          tokenPreview: `${token.slice(0, 12)}…`,
        })),
      );
  }

  async registerDevice(input: {
    companyId: string;
    userId: string;
    token: string;
    platform: string;
    deviceName?: string;
  }) {
    const token = input.token.trim();
    if (token.length < 20) {
      throw new BadRequestException('Invalid FCM token');
    }
    const platform = input.platform.trim().toUpperCase();
    if (!['WEB', 'ANDROID', 'IOS'].includes(platform)) {
      throw new BadRequestException('platform must be WEB, ANDROID, or IOS');
    }

    this.tenant.setCompanyId(input.companyId);

    const existing = await this.prisma.userPushDevice.findUnique({
      where: { token },
    });
    if (existing) {
      return this.prisma.userPushDevice.update({
        where: { id: existing.id },
        data: {
          companyId: input.companyId,
          userId: input.userId,
          platform,
          deviceName: input.deviceName?.trim() || existing.deviceName,
          lastSeenAt: new Date(),
          disabledAt: null,
        },
        select: {
          id: true,
          platform: true,
          deviceName: true,
          lastSeenAt: true,
          createdAt: true,
        },
      });
    }

    return this.prisma.userPushDevice.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        token,
        platform,
        deviceName: input.deviceName?.trim(),
      },
      select: {
        id: true,
        platform: true,
        deviceName: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
  }

  async registerForAuthenticatedUser(
    user: { userId: string; isPlatformAdmin: boolean; companyId?: string },
    input: {
      token: string;
      platform: string;
      deviceName?: string;
      companyId?: string;
    },
  ) {
    let companyId = input.companyId?.trim() || user.companyId;
    if (!companyId) {
      const company = await this.prisma.withoutTenant().company.findFirst({
        where: { deletedAt: null, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      companyId = company?.id;
    }
    if (!companyId) {
      throw new BadRequestException(
        'No active company available for FCM registration',
      );
    }

    return this.registerDevice({
      companyId,
      userId: user.userId,
      token: input.token,
      platform: input.platform,
      deviceName: input.deviceName,
    });
  }

  async unregisterDevice(
    companyId: string,
    userId: string,
    input: { deviceId?: string; token?: string },
  ) {
    this.tenant.setCompanyId(companyId);
    const device = await this.prisma.userPushDevice.findFirst({
      where: {
        companyId,
        userId,
        disabledAt: null,
        ...(input.deviceId ? { id: input.deviceId } : {}),
        ...(input.token ? { token: input.token } : {}),
      },
    });
    if (!device) throw new NotFoundException('Device not found');
    await this.prisma.userPushDevice.update({
      where: { id: device.id },
      data: { disabledAt: new Date() },
    });
    return { ok: true };
  }

  async createAndPush(input: {
    companyId: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    actionUrl?: string;
    data?: Record<string, unknown>;
    sendPush?: boolean;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const membership = await this.prisma.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId: input.companyId,
          userId: input.userId,
        },
      },
    });
    if (!membership) {
      throw new NotFoundException('User is not a member of this company');
    }

    const notification = await this.prisma.notification.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        type: input.type.trim().slice(0, 60),
        title: input.title.trim().slice(0, 180),
        body: input.body,
        actionUrl: input.actionUrl,
        data: (input.data ?? {}) as Prisma.InputJsonValue,
      },
    });

    let push: Awaited<
      ReturnType<NotificationsService['sendPushToUser']>
    > | null = null;
    if (input.sendPush !== false) {
      push = await this.sendPushToUser({
        companyId: input.companyId,
        userId: input.userId,
        title: notification.title,
        body: notification.body,
        data: {
          notificationId: notification.id,
          type: notification.type,
          actionUrl: notification.actionUrl ?? '',
          ...(input.data ?? {}),
        },
      });
      if (push.successCount > 0 || push.mode === 'LOCAL_STUB') {
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { pushSentAt: new Date() },
        });
        notification.pushSentAt = new Date();
      }
    }

    return { notification, push };
  }

  async sendPushToUser(input: {
    companyId: string;
    userId: string;
    title: string;
    body: string;
    data?: Record<string, string | unknown>;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const devices = await this.prisma.userPushDevice.findMany({
      where: {
        userId: input.userId,
        disabledAt: null,
      },
    });
    if (!devices.length) {
      return {
        mode: this.firebase.isReady
          ? ('LIVE' as const)
          : ('LOCAL_STUB' as const),
        successCount: 0,
        failureCount: 0,
        skipped: 'no_devices' as const,
      };
    }

    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.data ?? {})) {
      if (value == null) continue;
      data[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }

    const messaging = this.firebase.messaging();
    if (!messaging || this.firebase.isDryRun) {
      this.logger.debug(
        `FCM stub to ${devices.length} device(s): ${input.title}`,
      );
      return {
        mode: 'LOCAL_STUB' as const,
        successCount: devices.length,
        failureCount: 0,
        tokens: devices.length,
        dryRun: this.firebase.isDryRun,
        ready: this.firebase.isReady,
      };
    }

    const response = await messaging.sendEachForMulticast({
      tokens: devices.map((d) => d.token),
      notification: {
        title: input.title,
        body: input.body,
      },
      data,
    });

    const invalidIds: string[] = [];
    response.responses.forEach((res, index) => {
      if (res.success) return;
      const code = res.error?.code;
      if (code && INVALID_TOKEN_CODES.has(code)) {
        invalidIds.push(devices[index].id);
      } else {
        this.logger.warn(
          `FCM failure: ${code ?? 'unknown'} ${res.error?.message ?? ''}`,
        );
      }
    });
    if (invalidIds.length) {
      await this.prisma.userPushDevice.updateMany({
        where: { id: { in: invalidIds } },
        data: { disabledAt: new Date() },
      });
    }

    return {
      mode: 'LIVE' as const,
      successCount: response.successCount,
      failureCount: response.failureCount,
      disabledInvalidTokens: invalidIds.length,
    };
  }
}
