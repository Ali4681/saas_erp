import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { MirrorsController } from './mirrors/mirrors.controller';
import { MirrorsService } from './mirrors/mirrors.service';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { SyncEngineModule } from './sync/sync-engine.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [PlansModule, SyncEngineModule],
  controllers: [
    CatalogController,
    ProjectsController,
    OperationsController,
    WebhooksController,
    MirrorsController,
  ],
  providers: [
    CatalogService,
    ProjectsService,
    OperationsService,
    WebhooksService,
    MirrorsService,
  ],
  exports: [ProjectsService, SyncEngineModule],
})
export class IntegrationsModule {}
