import { Module } from '@nestjs/common';
import { GovernanceModule } from '../governance/governance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { ComplianceExpiryScheduler } from './compliance-expiry.scheduler';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [GovernanceModule, NotificationsModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, OnboardingService, ComplianceExpiryScheduler],
  exports: [CompaniesService, OnboardingService],
})
export class CompaniesModule {}
