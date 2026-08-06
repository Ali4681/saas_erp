import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AiCompletionResult = {
  content: string;
  provider: string;
  model: string;
  mode: 'OPENAI' | 'LOCAL_STUB';
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
};

/**
 * OpenAI chat client. When OPENAI_API_KEY is empty, callers should use
 * local stubs — this client still exposes `isConfigured`.
 */
@Injectable()
export class OpenAiClient {
  private readonly logger = new Logger(OpenAiClient.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly provider: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('OPENAI_API_KEY')?.trim() || undefined;
    this.baseUrl = (
      config.get<string>('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1'
    ).replace(/\/$/, '');
    this.model = config.get<string>('AI_MODEL') ?? 'gpt-4o-mini';
    this.provider = config.get<string>('AI_PROVIDER') ?? 'openai';
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  get defaultModel(): string {
    return this.model;
  }

  get defaultProvider(): string {
    return this.provider;
  }

  async completeJson(input: {
    system: string;
    user: string;
    temperature?: number;
  }): Promise<AiCompletionResult> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const body = {
      model: this.model,
      temperature: input.temperature ?? 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.user },
      ] satisfies AiChatMessage[],
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const raw = (await res.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };

    if (!res.ok) {
      const msg = raw.error?.message ?? `OpenAI HTTP ${res.status}`;
      this.logger.warn(`OpenAI error: ${msg}`);
      throw new Error(msg);
    }

    const content = raw.choices?.[0]?.message?.content ?? '{}';
    const inputTokens = raw.usage?.prompt_tokens ?? 0;
    const outputTokens = raw.usage?.completion_tokens ?? 0;
    // Rough gpt-4o-mini USD estimate
    const estimatedCost =
      (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.6;

    return {
      content,
      provider: this.provider,
      model: raw.model ?? this.model,
      mode: 'OPENAI',
      inputTokens,
      outputTokens,
      estimatedCost,
    };
  }
}
