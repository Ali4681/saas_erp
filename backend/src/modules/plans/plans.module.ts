import { Module } from '@nestjs/common';
import { PlanLimitsService } from './plan-limits.service';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  controllers: [PlansController, SubscriptionsController],
  providers: [PlanLimitsService, PlansService, SubscriptionsService],
  exports: [PlanLimitsService, PlansService, SubscriptionsService],
})
export class PlansModule {}
