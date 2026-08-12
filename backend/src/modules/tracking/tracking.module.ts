import { Module } from '@nestjs/common';
import { HrModule } from '../hr/hr.module';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

@Module({
  imports: [HrModule],
  controllers: [TrackingController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
