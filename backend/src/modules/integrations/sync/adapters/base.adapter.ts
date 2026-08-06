import { NotImplementedException } from '@nestjs/common';
import type { CredentialPayload } from '../../effective-capability.service';
import { hasAnyAuthSecret } from './credential-shapes';
import type {
  AdapterAuthContext,
  AdapterOperationContext,
  AdapterOperationResult,
  AdapterSyncContext,
  AdapterSyncResult,
  AdapterWebhookContext,
  AdapterWebhookResult,
  ProviderAdapter,
} from './adapter.types';

/**
 * Base helpers for real provider adapters.
 * Subclasses override the methods they support.
 */
export abstract class BaseProviderAdapter implements ProviderAdapter {
  abstract readonly providerCode: string;

  /** True when this adapter talks to a real external API (not stub data). */
  readonly isReal = true;

  async testAuth(ctx: AdapterAuthContext): Promise<boolean> {
    return hasAnyAuthSecret(ctx.credentials);
  }

  async syncEntity(_ctx: AdapterSyncContext): Promise<AdapterSyncResult> {
    throw new NotImplementedException(
      `${this.providerCode}: syncEntity not implemented yet`,
    );
  }

  async executeOperation(
    _ctx: AdapterOperationContext,
  ): Promise<AdapterOperationResult> {
    throw new NotImplementedException(
      `${this.providerCode}: executeOperation not implemented yet`,
    );
  }

  async processWebhook(
    _ctx: AdapterWebhookContext,
  ): Promise<AdapterWebhookResult> {
    return {
      ignored: true,
      reason: `${this.providerCode}: webhook handler not implemented yet`,
    };
  }

  verifyWebhookSignature?(input: {
    rawBody: string;
    signatureHeader: string | undefined;
    credentials: CredentialPayload;
  }): boolean;

  protected requireCredential(
    credentials: CredentialPayload,
    key: keyof CredentialPayload,
  ): string {
    const value = credentials[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new NotImplementedException(
        `${this.providerCode}: missing credential field "${String(key)}"`,
      );
    }
    return value.trim();
  }
}
