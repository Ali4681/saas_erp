import { Module } from '@nestjs/common';
import { BusinessHoursService } from './business-hours.service';
import { GovernanceController } from './governance.controller';
import { GovernanceService } from './governance.service';
import { IndustryService } from './industry.service';

@Module({
  controllers: [GovernanceController],
  providers: [BusinessHoursService, IndustryService, GovernanceService],
  exports: [BusinessHoursService, IndustryService, GovernanceService],
})
export class GovernanceModule {}
