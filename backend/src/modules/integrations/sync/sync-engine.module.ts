import { Module } from '@nestjs/common';
import { EffectiveCapabilityService } from '../effective-capability.service';
import { ExtensionBridgeController } from '../extension/extension-bridge.controller';
import { ExtensionBridgeService } from '../extension/extension-bridge.service';
import { HungerStationExtensionGateway } from '../extension/hungerstation-extension.gateway';
import { MrsoolExtensionGateway } from '../extension/mrsool-extension.gateway';
import { NinjaExtensionGateway } from '../extension/ninja-extension.gateway';
import { ToYouExtensionGateway } from '../extension/toyou-extension.gateway';
import { MirrorUpsertService } from '../mirrors/mirror-upsert.service';
import { AdapterRegistry } from './adapters/adapter.registry';
import { HungerStationClient } from './adapters/hungerstation.client';
import { HungerStationProviderAdapter } from './adapters/hungerstation.adapter';
import { MadfuClient } from './adapters/madfu.client';
import { MadfuProviderAdapter } from './adapters/madfu.adapter';
import { CatalogScaffoldAdapters } from './adapters/catalog-scaffold.adapter';
import { MrsoolClient } from './adapters/mrsool.client';
import { MrsoolProviderAdapter } from './adapters/mrsool.adapter';
import { NinjaClient } from './adapters/ninja.client';
import { NinjaProviderAdapter } from './adapters/ninja.adapter';
import { StubProviderAdapter } from './adapters/stub.adapter';
import { ToYouClient } from './adapters/toyou.client';
import { ToYouProviderAdapter } from './adapters/toyou.adapter';
import { ZidProviderAdapter } from './adapters/zid.adapter';
import { SallaProviderAdapter } from './adapters/salla.adapter';
import { TabbyProviderAdapter } from './adapters/tabby.adapter';
import { TamaraProviderAdapter } from './adapters/tamara.adapter';
import { IntegrationErrorsService } from './integration-errors.service';
import { JobDispatcherService } from './job-dispatcher.service';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { SyncRunnerService } from './sync-runner.service';

@Module({
  controllers: [JobsController, ExtensionBridgeController],
  providers: [
    EffectiveCapabilityService,
    MirrorUpsertService,
    ExtensionBridgeService,
    HungerStationExtensionGateway,
    NinjaExtensionGateway,
    ToYouExtensionGateway,
    MrsoolExtensionGateway,
    HungerStationClient,
    NinjaClient,
    ToYouClient,
    MrsoolClient,
    MadfuClient,
    CatalogScaffoldAdapters,
    StubProviderAdapter,
    ZidProviderAdapter,
    SallaProviderAdapter,
    TabbyProviderAdapter,
    TamaraProviderAdapter,
    HungerStationProviderAdapter,
    NinjaProviderAdapter,
    ToYouProviderAdapter,
    MrsoolProviderAdapter,
    MadfuProviderAdapter,
    AdapterRegistry,
    IntegrationErrorsService,
    SyncRunnerService,
    JobDispatcherService,
    JobsService,
  ],
  exports: [
    EffectiveCapabilityService,
    MirrorUpsertService,
    JobDispatcherService,
    JobsService,
    AdapterRegistry,
    SyncRunnerService,
    ExtensionBridgeService,
  ],
})
export class SyncEngineModule {}
