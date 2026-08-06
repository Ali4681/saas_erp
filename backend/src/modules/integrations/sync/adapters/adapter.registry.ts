import { Injectable, OnModuleInit } from '@nestjs/common';
import { StubProviderAdapter } from './stub.adapter';
import { ZidProviderAdapter } from './zid.adapter';
import { SallaProviderAdapter } from './salla.adapter';
import { TabbyProviderAdapter } from './tabby.adapter';
import { TamaraProviderAdapter } from './tamara.adapter';
import { HungerStationProviderAdapter } from './hungerstation.adapter';
import { NinjaProviderAdapter } from './ninja.adapter';
import { ToYouProviderAdapter } from './toyou.adapter';
import { MrsoolProviderAdapter } from './mrsool.adapter';
import { MadfuProviderAdapter } from './madfu.adapter';
import { CatalogScaffoldAdapters } from './catalog-scaffold.adapter';
import type { ProviderAdapter } from './adapter.types';

export type AdapterResolution = {
  providerCode: string;
  mode: 'real' | 'stub';
  registeredCodes: string[];
};

@Injectable()
export class AdapterRegistry implements OnModuleInit {
  private readonly adapters = new Map<string, ProviderAdapter>();

  constructor(
    private readonly stub: StubProviderAdapter,
    private readonly zid: ZidProviderAdapter,
    private readonly salla: SallaProviderAdapter,
    private readonly tabby: TabbyProviderAdapter,
    private readonly tamara: TamaraProviderAdapter,
    private readonly hungerstation: HungerStationProviderAdapter,
    private readonly ninja: NinjaProviderAdapter,
    private readonly toyou: ToYouProviderAdapter,
    private readonly mrsool: MrsoolProviderAdapter,
    private readonly madfu: MadfuProviderAdapter,
    private readonly scaffolds: CatalogScaffoldAdapters,
  ) {}

  onModuleInit() {
    this.register(this.zid);
    this.register(this.salla);
    this.register(this.tabby);
    this.register(this.tamara);
    this.register(this.hungerstation);
    this.register(this.ninja);
    this.register(this.toyou);
    this.register(this.mrsool);
    this.register(this.madfu);
    for (const adapter of this.scaffolds.adapters) {
      this.register(adapter);
    }
    this.register(this.stub);
  }

  register(adapter: ProviderAdapter) {
    this.adapters.set(adapter.providerCode.toUpperCase(), adapter);
  }

  /** Exact dedicated adapter (excludes catch-all stub `*`). */
  hasDedicated(providerCode: string): boolean {
    const code = providerCode.toUpperCase();
    return code !== '*' && this.adapters.has(code);
  }

  listDedicatedCodes(): string[] {
    return [...this.adapters.keys()].filter((code) => code !== '*').sort();
  }

  resolve(providerCode: string): AdapterResolution {
    const dedicated = this.hasDedicated(providerCode);
    return {
      providerCode: providerCode.toUpperCase(),
      mode: dedicated ? 'real' : 'stub',
      registeredCodes: this.listDedicatedCodes(),
    };
  }

  get(providerCode: string): ProviderAdapter {
    return (
      this.adapters.get(providerCode.toUpperCase()) ??
      this.adapters.get('*') ??
      this.stub
    );
  }
}
