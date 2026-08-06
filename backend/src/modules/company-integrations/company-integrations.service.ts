import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyApiKeyStatus,
  CompanyWebhookStatus,
  Prisma,
} from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class CompanyIntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  // --- API keys ---

  listApiKeys(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.companyApiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimitPerMin: true,
        status: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  async createApiKey(input: {
    companyId: string;
    createdById: string;
    name: string;
    scopes?: string[];
    rateLimitPerMin?: number;
    expiresAt?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const rawKey = `serp_${randomBytes(24).toString('hex')}`;
    const keyPrefix = rawKey.slice(0, 12);
    const created = await this.prisma.companyApiKey.create({
      data: {
        companyId: input.companyId,
        createdById: input.createdById,
        name: input.name,
        keyPrefix,
        keyHash: sha256(rawKey),
        scopes: (input.scopes ?? ['*']) as Prisma.InputJsonValue,
        rateLimitPerMin: input.rateLimitPerMin ?? 60,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimitPerMin: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    return { ...created, apiKey: rawKey };
  }

  async updateApiKeyStatus(
    companyId: string,
    apiKeyId: string,
    status: CompanyApiKeyStatus,
  ) {
    this.tenant.setCompanyId(companyId);
    const key = await this.prisma.companyApiKey.findFirst({
      where: { id: apiKeyId, companyId },
    });
    if (!key) {
      throw new NotFoundException('API key not found');
    }
    return this.prisma.companyApiKey.update({
      where: { id: apiKeyId },
      data: { status },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async logApiRequest(input: {
    companyId: string;
    companyApiKeyId?: string;
    method: string;
    path: string;
    statusCode: number;
    ipAddress?: string;
    durationMs?: number;
  }) {
    this.tenant.setCompanyId(input.companyId);
    return this.prisma.apiRequestLog.create({
      data: {
        companyId: input.companyId,
        companyApiKeyId: input.companyApiKeyId,
        method: input.method,
        path: input.path,
        statusCode: input.statusCode,
        ipAddress: input.ipAddress,
        durationMs: input.durationMs,
      },
    });
  }

  listApiRequestLogs(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.apiRequestLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // --- Company webhooks ---

  listWebhooks(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.companyWebhook.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        targetUrl: true,
        events: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createWebhook(input: {
    companyId: string;
    createdById: string;
    name: string;
    targetUrl: string;
    events: string[];
  }) {
    this.tenant.setCompanyId(input.companyId);
    if (!input.events?.length) {
      throw new BadRequestException('events must be non-empty');
    }
    if (!/^https?:\/\//i.test(input.targetUrl)) {
      throw new BadRequestException('targetUrl must be http(s)');
    }
    const secret = randomBytes(24).toString('hex');
    const created = await this.prisma.companyWebhook.create({
      data: {
        companyId: input.companyId,
        createdById: input.createdById,
        name: input.name,
        targetUrl: input.targetUrl,
        secretHash: sha256(secret),
        events: input.events as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        name: true,
        targetUrl: true,
        events: true,
        status: true,
        createdAt: true,
      },
    });
    return { ...created, signingSecret: secret };
  }

  async updateWebhookStatus(
    companyId: string,
    webhookId: string,
    status: CompanyWebhookStatus,
  ) {
    this.tenant.setCompanyId(companyId);
    const webhook = await this.prisma.companyWebhook.findFirst({
      where: { id: webhookId, companyId },
    });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    return this.prisma.companyWebhook.update({
      where: { id: webhookId },
      data: { status },
    });
  }

  /** Stub delivery: records attempt without outbound HTTP in V1. */
  async deliverWebhookEvent(
    companyId: string,
    webhookId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    this.tenant.setCompanyId(companyId);
    const webhook = await this.prisma.companyWebhook.findFirst({
      where: { id: webhookId, companyId },
    });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    if (webhook.status !== 'ACTIVE') {
      throw new BadRequestException('Webhook is not ACTIVE');
    }
    const events = Array.isArray(webhook.events)
      ? (webhook.events as string[])
      : [];
    if (!events.includes(eventType) && !events.includes('*')) {
      return this.prisma.webhookDelivery.create({
        data: {
          companyWebhookId: webhook.id,
          eventType,
          payload: payload as Prisma.InputJsonValue,
          status: 'SKIPPED',
          errorMessage: 'Event not subscribed',
        },
      });
    }

    return this.prisma.webhookDelivery.create({
      data: {
        companyWebhookId: webhook.id,
        eventType,
        payload: payload as Prisma.InputJsonValue,
        status: 'SUCCEEDED',
        responseCode: 200,
      },
    });
  }

  listWebhookDeliveries(companyId: string, webhookId?: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.webhookDelivery.findMany({
      where: {
        webhook: { companyId },
        ...(webhookId ? { companyWebhookId: webhookId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
