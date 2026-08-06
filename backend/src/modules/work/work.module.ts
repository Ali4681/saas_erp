import { Module, forwardRef } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { WorkController } from './work.controller';
import { WorkService } from './work.service';

@Module({
  imports: [forwardRef(() => AutomationModule)],
  controllers: [WorkController],
  providers: [WorkService],
  exports: [WorkService],
})
export class WorkModule {}
