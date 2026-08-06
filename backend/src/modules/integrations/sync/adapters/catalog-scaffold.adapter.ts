import { Injectable } from '@nestjs/common';
import { BaseProviderAdapter } from './base.adapter';
import { ProviderHttpError } from './provider-http.client';
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

export type CatalogScaffoldMeta = {
  code: string;
  reason: string;
  docsUrl?: string;
};

/** Phase 4 catalog providers without a ported API client yet. */
export const PHASE4_CATALOG_SCAFFOLDS: CatalogScaffoldMeta[] = [
  {
    code: 'MIS_PAY',
    reason:
      'MIS Pay public docs exist but checkout/track REST is not ported into ERP yet — awaiting verified endpoint mapping and merchant credentials',
    docsUrl: 'https://www.mispay.dev/integration',
  },
  {
    code: 'EMKAN',
    reason:
      'Emkan is partner-portal / account-gated — awaiting partner credentials and approved API package',
  },
  {
    code: 'JAHEZ',
    reason:
      'Jahez integration portal access required — connector scaffold only until partner scopes are available',
    docsUrl: 'https://integration-portal.jahez.net/',
  },
  {
    code: 'KEETA',
    reason:
      'Keeta API is NDA/SIT gated — scaffold only until merchant OAuth credentials are provisioned',
    docsUrl: 'https://api-docs.mykeeta.com/',
  },
  {
    code: 'THE_CHEFZ',
    reason:
      'The Chefz public API is unverified — no documented connector in reference material yet',
  },
  {
    code: 'SHGARDI',
    reason:
      'Shgardi public API is unverified — no documented connector in reference material yet',
  },
];

/**
 * Dedicated adapter that fails clearly instead of returning stub fake data.
 * Registered so UI shows "real dedicated adapter" with honest errors.
 */
export class DocumentedUnsupportedAdapter
  extends BaseProviderAdapter
  implements ProviderAdapter
{
  readonly providerCode: string;

  constructor(private readonly meta: CatalogScaffoldMeta) {
    super();
    this.providerCode = meta.code.toUpperCase();
  }

  private fail(action: string): never {
    const docs = this.meta.docsUrl ? ` Docs: ${this.meta.docsUrl}` : '';
    throw new ProviderHttpError(
      `${this.providerCode}: ${action} not available — ${this.meta.reason}.${docs}`,
      501,
      {
        scaffold: true,
        providerCode: this.providerCode,
        docsUrl: this.meta.docsUrl ?? null,
      },
      this.providerCode.toLowerCase(),
    );
  }

  async testAuth(_ctx: AdapterAuthContext): Promise<boolean> {
    // Honest negative: credentials alone do not prove connectivity.
    return false;
  }

  async syncEntity(_ctx: AdapterSyncContext): Promise<AdapterSyncResult> {
    this.fail('sync');
  }

  async executeOperation(
    _ctx: AdapterOperationContext,
  ): Promise<AdapterOperationResult> {
    this.fail('operation');
  }

  async processWebhook(
    _ctx: AdapterWebhookContext,
  ): Promise<AdapterWebhookResult> {
    return {
      ignored: true,
      reason: `${this.providerCode}: webhook handler scaffold only — ${this.meta.reason}`,
    };
  }
}

@Injectable()
export class CatalogScaffoldAdapters {
  readonly adapters: ProviderAdapter[] = PHASE4_CATALOG_SCAFFOLDS.map(
    (meta) => new DocumentedUnsupportedAdapter(meta),
  );
}
