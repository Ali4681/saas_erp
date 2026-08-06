import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { SubscriptionsService } from './subscriptions.service';

class ChangePlanBody {
  @IsString()
  @MinLength(2)
  planCode!: string;
}

@Controller('companies/:companyId/subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  @RequirePermissions('subscriptions.read')
  list(@Param('companyId') companyId: string) {
    return this.subscriptions.list(companyId);
  }

  @Get('current')
  @RequirePermissions('subscriptions.read')
  current(@Param('companyId') companyId: string) {
    return this.subscriptions.current(companyId);
  }

  @Get('invoices')
  @RequirePermissions('subscriptions.read')
  invoices(@Param('companyId') companyId: string) {
    return this.subscriptions.listInvoices(companyId);
  }

  @Post('change-plan')
  @RequirePermissions('subscriptions.write')
  changePlan(
    @Param('companyId') companyId: string,
    @Body() body: ChangePlanBody,
  ) {
    return this.subscriptions.changePlan(companyId, body.planCode);
  }

  @Post('cancel')
  @RequirePermissions('subscriptions.write')
  cancel(@Param('companyId') companyId: string) {
    return this.subscriptions.cancel(companyId);
  }

  @Post('suspend')
  @RequirePermissions('subscriptions.write')
  suspend(@Param('companyId') companyId: string) {
    return this.subscriptions.suspend(companyId);
  }

  @Post('renew')
  @RequirePermissions('subscriptions.write')
  renew(@Param('companyId') companyId: string) {
    return this.subscriptions.renew(companyId);
  }
}
