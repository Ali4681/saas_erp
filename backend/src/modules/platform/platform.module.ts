import { Module, forwardRef } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { MarketingPublisherService } from './marketing.publisher';
import { MarketingSchedulerService } from './marketing.scheduler';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  imports: [forwardRef(() => AutomationModule)],
  controllers: [PlatformController],
  providers: [
    PlatformService,
    MarketingPublisherService,
    MarketingSchedulerService,
  ],
  exports: [PlatformService],
})
export class PlatformModule {}
