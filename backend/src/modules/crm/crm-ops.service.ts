import { createHash, randomInt } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';

export type CrmOpsSettings = {
  loyalty: {
    b2cRatePct: number;
    b2bRatePct: number;
    birthdayBonus: number;
    otpRequired: boolean;
  };
  pos: {
    maxDiscountPct: number;
    overrideCode: string;
  };
  zatca: {
    sellerName: string;
    vatNumber: string;
  };
};

const DEFAULTS: CrmOpsSettings = {
  loyalty: {
    b2cRatePct: 1,
    b2bRatePct: 0.5,
    birthdayBonus: 50,
    otpRequired: true,
  },
  pos: { maxDiscountPct: 5, overrideCode: '0000' },
  zatca: { sellerName: '', vatNumber: '' },
};

@Injectable()
export class CrmOpsService {
  private readonly logger = new Logger(CrmOpsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly messaging: MessagingService,
    private readonly notifications: NotificationsService,
  ) {}

  async getSettings(companyId: string): Promise<CrmOpsSettings> {
    this.tenant.setCompanyId(companyId);
    const row = await this.prisma.companySettings.findUnique({
      where: { companyId },
    });
    const raw = (row?.settings ?? {}) as Record<string, unknown>;
    const loyalty = (raw.loyalty ?? {}) as Record<string, unknown>;
    const pos = (raw.pos ?? {}) as Record<string, unknown>;
    const zatca = (raw.zatca ?? {}) as Record<string, unknown>;
    return {
      loyalty: {
        b2cRatePct: Number(loyalty.b2cRatePct ?? DEFAULTS.loyalty.b2cRatePct),
        b2bRatePct: Number(loyalty.b2bRatePct ?? DEFAULTS.loyalty.b2bRatePct),
        birthdayBonus: Number(
          loyalty.birthdayBonus ?? DEFAULTS.loyalty.birthdayBonus,
        ),
        otpRequired: loyalty.otpRequired !== false,
      },
      pos: {
        maxDiscountPct: Number(pos.maxDiscountPct ?? DEFAULTS.pos.maxDiscountPct),
        overrideCode: String(pos.overrideCode ?? DEFAULTS.pos.overrideCode),
      },
      zatca: {
        sellerName: String(zatca.sellerName ?? row?.emailFromName ?? ''),
        vatNumber: String(zatca.vatNumber ?? row?.taxNumber ?? ''),
      },
    };
  }

  async saveSettings(companyId: string, patch: Partial<CrmOpsSettings>) {
    this.tenant.setCompanyId(companyId);
    const current = await this.getSettings(companyId);
    const next = {
      loyalty: { ...current.loyalty, ...patch.loyalty },
      pos: { ...current.pos, ...patch.pos },
      zatca: { ...current.zatca, ...patch.zatca },
    };
    await this.prisma.companySettings.upsert({
      where: { companyId },
      create: {
        companyId,
        settings: next as unknown as Prisma.InputJsonValue,
      },
      update: { settings: next as unknown as Prisma.InputJsonValue },
    });
    return next;
  }

  async requestOtp(companyId: string, contactId: string, purpose: string) {
    this.tenant.setCompanyId(companyId);
    const contact = await this.prisma.crmContact.findFirst({
      where: { id: contactId, companyId },
    });
    if (!contact) throw new BadRequestException('Contact not found');
    const code = String(randomInt(100000, 999999));
    const codeHash = createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await this.prisma.crmOtpChallenge.create({
      data: { companyId, contactId, purpose, codeHash, expiresAt },
    });
    await this.notifyContact(
      companyId,
      contact.phone,
      contact.email,
      contact.ownerUserId,
      `رمز التحقق: ${code}`,
      `OTP ${purpose}`,
    );
    return { sent: true, expiresAt };
  }

  async verifyOtp(
    companyId: string,
    contactId: string,
    purpose: string,
    code: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const codeHash = createHash('sha256').update(code.trim()).digest('hex');
    const row = await this.prisma.crmOtpChallenge.findFirst({
      where: {
        companyId,
        contactId,
        purpose,
        codeHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) throw new BadRequestException('Invalid or expired OTP');
    await this.prisma.crmOtpChallenge.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    return true;
  }

  async notifyContact(
    companyId: string,
    phone: string | null | undefined,
    email: string | null | undefined,
    ownerUserId: string | null | undefined,
    body: string,
    subject: string,
  ) {
    this.tenant.setCompanyId(companyId);
    try {
      const recipient = phone || email;
      if (recipient) {
        await this.messaging.sendDirect({
          companyId,
          recipient,
          subject,
          body,
          preferSms: !!phone,
        });
      }
    } catch (error) {
      this.logger.warn(
        `messaging failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
    if (ownerUserId) {
      try {
        await this.notifications.createAndPush({
          companyId,
          userId: ownerUserId,
          type: 'crm',
          title: subject,
          body,
          sendPush: true,
        });
      } catch (error) {
        this.logger.warn(
          `notify owner failed: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }
  }
}
