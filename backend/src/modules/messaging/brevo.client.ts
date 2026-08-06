import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type BrevoEmailInput = {
  to: string;
  subject: string;
  body: string;
  senderEmail?: string;
  senderName?: string;
};

export type BrevoSmsInput = {
  to: string;
  content: string;
  sender?: string;
};

export type BrevoSendResult = {
  ok: boolean;
  providerMessageId?: string;
  errorMessage?: string;
  raw?: unknown;
};

@Injectable()
export class BrevoClient {
  private readonly logger = new Logger(BrevoClient.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly defaultFromEmail: string | undefined;
  private readonly defaultFromName: string;
  private readonly defaultSmsSender: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('BREVO_API_KEY')?.trim() || undefined;
    this.baseUrl = (
      config.get<string>('BREVO_API_URL') ?? 'https://api.brevo.com/v3'
    ).replace(/\/$/, '');
    this.defaultFromEmail =
      config.get<string>('BREVO_EMAIL_FROM')?.trim() ||
      config.get<string>('SMTP_FROM')?.trim() ||
      undefined;
    this.defaultFromName =
      config.get<string>('BREVO_EMAIL_FROM_NAME')?.trim() || 'SaaS ERP';
    this.defaultSmsSender =
      config.get<string>('BREVO_SMS_SENDER')?.trim() || 'SaaSERP';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async sendEmail(input: BrevoEmailInput): Promise<BrevoSendResult> {
    if (!this.apiKey) {
      return {
        ok: false,
        errorMessage: 'BREVO_API_KEY is not configured',
      };
    }

    const senderEmail = input.senderEmail ?? this.defaultFromEmail;
    if (!senderEmail) {
      return {
        ok: false,
        errorMessage:
          'Sender email missing (set BREVO_EMAIL_FROM or channel config.fromEmail)',
      };
    }

    const isHtml = /<[a-z][\s\S]*>/i.test(input.body);
    const payload: Record<string, unknown> = {
      sender: {
        email: senderEmail,
        name: input.senderName ?? this.defaultFromName,
      },
      to: [{ email: input.to }],
      subject: input.subject || '(no subject)',
    };
    if (isHtml) {
      payload.htmlContent = input.body;
    } else {
      payload.textContent = input.body;
    }

    return this.post('/smtp/email', payload, (data) => {
      const messageId =
        data && typeof data === 'object' && 'messageId' in data
          ? String((data as { messageId: unknown }).messageId)
          : undefined;
      return messageId;
    });
  }

  async sendSms(input: BrevoSmsInput): Promise<BrevoSendResult> {
    if (!this.apiKey) {
      return {
        ok: false,
        errorMessage: 'BREVO_API_KEY is not configured',
      };
    }

    const recipient = this.normalizePhone(input.to);
    if (!recipient) {
      return {
        ok: false,
        errorMessage: 'SMS recipient must include country code digits',
      };
    }

    const payload = {
      sender: input.sender ?? this.defaultSmsSender,
      recipient,
      content: input.content,
      type: 'transactional',
    };

    return this.post('/transactionalSMS/send', payload, (data) => {
      if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        if (obj.messageId != null) return String(obj.messageId);
        if (obj.reference != null) return String(obj.reference);
      }
      return undefined;
    });
  }

  private async post(
    path: string,
    body: Record<string, unknown>,
    extractId: (data: unknown) => string | undefined,
  ): Promise<BrevoSendResult> {
    const url = `${this.baseUrl}${path}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': this.apiKey!,
        },
        body: JSON.stringify(body),
      });

      const text = await response.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text) as unknown;
        } catch {
          data = { raw: text };
        }
      }

      if (!response.ok) {
        const message = this.formatError(data) ?? `HTTP ${response.status}`;
        this.logger.warn(`Brevo ${path} failed: ${message}`);
        return { ok: false, errorMessage: message, raw: data };
      }

      return {
        ok: true,
        providerMessageId: extractId(data),
        raw: data,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Brevo request failed';
      this.logger.error(`Brevo ${path} error: ${message}`);
      return { ok: false, errorMessage: message };
    }
  }

  private formatError(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const obj = data as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (Array.isArray(obj.message)) return obj.message.map(String).join('; ');
    return null;
  }

  /** Brevo expects digits with country code, no leading +. */
  private normalizePhone(raw: string): string | null {
    const digits = raw.replace(/[^\d]/g, '');
    return digits.length >= 8 ? digits : null;
  }
}
