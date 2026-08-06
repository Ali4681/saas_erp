import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  MarketingChannel,
  MarketingConnectionStatus,
} from '../../generated/prisma/client';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { PrismaService } from '../../database/prisma.service';

export type PublishAttemptResult = {
  ok: boolean;
  mode: 'EXTERNAL_STUB' | 'LOCAL_STUB' | 'FAILED';
  externalPostId?: string;
  errorMessage?: string;
  platformNote?: string;
};

const PLATFORM_NOTES: Partial<Record<MarketingChannel, string>> = {
  FACEBOOK:
    'Facebook Graph API requires app review and page publish permissions.',
  INSTAGRAM:
    'Instagram Content Publishing API requires a Facebook Business connection.',
  LINKEDIN: 'LinkedIn Marketing API requires partner / community access.',
  X: 'X (Twitter) API v2 write access requires elevated / paid tiers.',
  TIKTOK: 'TikTok Content Posting API requires approved developer app.',
  GOOGLE_BUSINESS_PROFILE:
    'Google Business Profile API requires verified location ownership.',
};

/**
 * External social publishers (14.4).
 * Real network calls are gated behind CONNECTED credentials; without them
 * we return a clear LOCAL_STUB / FAILED result so the product stays demo-ready
 * while remaining API-policy compliant.
 */
@Injectable()
export class MarketingPublisherService {
  private readonly logger = new Logger(MarketingPublisherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async publish(input: {
    companyId: string;
    channel: MarketingChannel;
    content: string;
    title?: string | null;
    mediaCount: number;
  }): Promise<PublishAttemptResult> {
    if (input.channel === 'INTERNAL_DRAFT' || input.channel === 'OTHER') {
      return {
        ok: true,
        mode: 'LOCAL_STUB',
        externalPostId: `local-${randomUUID()}`,
        platformNote: 'Internal / other channel — stored locally only.',
      };
    }

    const connection = await this.prisma.marketingPlatformConnection.findFirst({
      where: {
        companyId: input.companyId,
        channel: input.channel,
        status: 'CONNECTED' as MarketingConnectionStatus,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!connection?.credentialsCiphertext) {
      return {
        ok: true,
        mode: 'LOCAL_STUB',
        externalPostId: `pending-${input.channel.toLowerCase()}-${randomUUID()}`,
        platformNote:
          (PLATFORM_NOTES[input.channel] ??
            'External publish requires a connected platform account.') +
          ' Post marked published locally until OAuth/API credentials are linked.',
      };
    }

    try {
      // Decrypt to validate credentials shape; real HTTP clients plug in here.
      const raw = this.encryption.decrypt(
        Buffer.from(connection.credentialsCiphertext),
      );
      JSON.parse(raw);
      this.logger.log(
        `Stub publish to ${input.channel} for company ${input.companyId} (media=${input.mediaCount})`,
      );
      return {
        ok: true,
        mode: 'EXTERNAL_STUB',
        externalPostId: `${input.channel.toLowerCase()}-${randomUUID()}`,
        platformNote:
          PLATFORM_NOTES[input.channel] ??
          'Stub publisher — replace with live platform client when approved.',
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Credential decrypt failed';
      return {
        ok: false,
        mode: 'FAILED',
        errorMessage: message,
        platformNote: PLATFORM_NOTES[input.channel],
      };
    }
  }

  encryptCredentials(payload: Record<string, unknown>) {
    return this.encryption.encrypt(JSON.stringify(payload));
  }
}
