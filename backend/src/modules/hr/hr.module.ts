import { Module, forwardRef } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';

@Module({
  imports: [forwardRef(() => AutomationModule)],
  controllers: [HrController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
