import { Module } from '@nestjs/common';
import { CompanyIntegrationsController } from './company-integrations.controller';
import { CompanyIntegrationsService } from './company-integrations.service';

@Module({
  controllers: [CompanyIntegrationsController],
  providers: [CompanyIntegrationsService],
  exports: [CompanyIntegrationsService],
})
export class CompanyIntegrationsModule {}
