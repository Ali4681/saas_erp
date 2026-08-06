import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { ReportsModule } from '../reports/reports.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OpenAiClient } from './openai.client';

@Module({
  imports: [PlansModule, ReportsModule],
  controllers: [AiController],
  providers: [AiService, OpenAiClient],
  exports: [AiService],
})
export class AiModule {}
