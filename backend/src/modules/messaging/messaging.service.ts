import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MessagingProvider,
  Prisma,
} from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { BrevoClient } from './brevo.client';

type ChannelConfig = {
  fromEmail?: string;
  fromName?: string;
  smsSender?: string;
  provider?: string;
};

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly brevo: BrevoClient,
  ) {}

  listChannels(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.messagingChannel.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
  }

  async createChannel(input: {
    companyId: string;
    provider: MessagingProvider;
    name: string;
    config?: Record<string, unknown>;
  }) {
    this.tenant.setCompanyId(input.companyId);
    return this.prisma.messagingChannel.create({
      data: {
        companyId: input.companyId,
        provider: input.provider,
        name: input.name,
        config: (input.config ?? { transport: 'brevo' }) as Prisma.InputJsonValue,
      },
    });
  }

  listTemplates(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.messageTemplate.findMany({
      include: { channel: { select: { id: true, name: true, provider: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async createTemplate(input: {
    companyId: string;
    messagingChannelId: string;
    code: string;
    name: string;
    bodyTemplate: string;
    subject?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const channel = await this.prisma.messagingChannel.findFirst({
      where: { id: input.messagingChannelId, companyId: input.companyId },
    });
    if (!channel) {
      throw new BadRequestException('Messaging channel not found');
    }
    return this.prisma.messageTemplate.create({
      data: {
        companyId: input.companyId,
        messagingChannelId: input.messagingChannelId,
        code: input.code,
        name: input.name,
        bodyTemplate: input.bodyTemplate,
        subject: input.subject,
      },
    });
  }

  listDeliveries(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.messageDelivery.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Sends via Brevo for SMTP (email) and SMS channels. */
  async sendMessage(input: {
    companyId: string;
    messagingChannelId: string;
    recipient: string;
    messageTemplateId?: string;
    subject?: string;
    body?: string;
    variables?: Record<string, string>;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const channel = await this.prisma.messagingChannel.findFirst({
      where: { id: input.messagingChannelId, companyId: input.companyId },
    });
    if (!channel) {
      throw new NotFoundException('Messaging channel not found');
    }
    if (channel.status !== 'ACTIVE') {
      throw new BadRequestException('Channel is not ACTIVE');
    }

    let subject = input.subject;
    let body = input.body;
    if (input.messageTemplateId) {
      const template = await this.prisma.messageTemplate.findFirst({
        where: {
          id: input.messageTemplateId,
          companyId: input.companyId,
          messagingChannelId: input.messagingChannelId,
        },
      });
      if (!template) {
        throw new BadRequestException('Template not found for channel');
      }
      subject = subject ?? template.subject ?? undefined;
      body = this.render(template.bodyTemplate, input.variables ?? {});
      if (subject) {
        subject = this.render(subject, input.variables ?? {});
      }
    }
    if (!body?.trim()) {
      throw new BadRequestException('Message body is required');
    }

    const config = this.readConfig(channel.config);
    const sendResult = await this.dispatchToBrevo({
      provider: channel.provider,
      recipient: input.recipient,
      subject,
      body,
      config,
    });

    return this.prisma.messageDelivery.create({
      data: {
        companyId: input.companyId,
        messagingChannelId: input.messagingChannelId,
        messageTemplateId: input.messageTemplateId,
        recipient: input.recipient,
        subject,
        body,
        status: sendResult.ok ? 'SENT' : 'FAILED',
        providerMessageId: sendResult.providerMessageId,
        errorMessage: sendResult.errorMessage,
        sentAt: sendResult.ok ? new Date() : null,
      },
    });
  }

  private async dispatchToBrevo(input: {
    provider: MessagingProvider;
    recipient: string;
    subject?: string;
    body: string;
    config: ChannelConfig;
  }) {
    if (input.provider === 'SMTP') {
      return this.brevo.sendEmail({
        to: input.recipient,
        subject: input.subject ?? '(no subject)',
        body: input.body,
        senderEmail: input.config.fromEmail,
        senderName: input.config.fromName,
      });
    }

    if (input.provider === 'SMS') {
      return this.brevo.sendSms({
        to: input.recipient,
        content: input.body,
        sender: input.config.smsSender,
      });
    }

    return {
      ok: false,
      errorMessage: `Provider ${input.provider} is not wired to Brevo yet (use SMTP or SMS)`,
    };
  }

  private readConfig(value: Prisma.JsonValue): ChannelConfig {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    const obj = value as Record<string, unknown>;
    return {
      fromEmail:
        typeof obj.fromEmail === 'string' ? obj.fromEmail : undefined,
      fromName: typeof obj.fromName === 'string' ? obj.fromName : undefined,
      smsSender: typeof obj.smsSender === 'string' ? obj.smsSender : undefined,
      provider: typeof obj.provider === 'string' ? obj.provider : undefined,
    };
  }

  private render(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
      return variables[key] ?? '';
    });
  }
}
