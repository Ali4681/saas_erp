import { Module, forwardRef } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { PurchasingController } from './purchasing.controller';
import { PurchasingService } from './purchasing.service';

@Module({
  imports: [forwardRef(() => FinanceModule)],
  controllers: [PurchasingController],
  providers: [PurchasingService],
  exports: [PurchasingService],
})
export class PurchasingModule {}
