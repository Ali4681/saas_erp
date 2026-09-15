import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CurrentUser,
  RequireAnyPermission,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { PosService } from './pos.service';
import { PosTerminalService } from './pos-terminal.service';
import {
  POS_TERMINAL_ACCESS,
  resolvePosRoleOps,
} from './pos-role-ops';

class CreatePosBody {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  companyBranchId?: string;

  @IsOptional()
  @IsString()
  locationNote?: string;
}

class UpdatePosBody {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  companyBranchId?: string | null;

  @IsOptional()
  @IsString()
  locationNote?: string | null;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

class AddCashierBody {
  @IsString()
  employeeId!: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}

class UpdateCashierBody {
  @IsOptional()
  @IsString()
  displayName?: string | null;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

  @IsOptional()
  @IsObject()
  permissions?: Record<string, boolean | number>;
}

class TerminalLineBody {
  @IsOptional()
  @IsString()
  itemId?: string;

  @IsString()
  description!: string;

  @Type(() => Number)
  @IsNumber()
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitPrice?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  taxAmount?: number;
}

class QuickLineBody {
  @IsOptional()
  @IsString()
  itemId?: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @Type(() => Number)
  @IsNumber()
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  unitPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  taxAmount?: number;
}

class QuickCheckoutBody {
  @IsOptional()
  @IsString()
  pointOfSaleId?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsIn(['CASH', 'CARD', 'MIXED'])
  paymentMethod!: 'CASH' | 'CARD' | 'MIXED';

  @IsOptional()
  @IsArray()
  paymentSplits?: Array<{ method: string; amount: number | string }>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuickLineBody)
  lines!: QuickLineBody[];

  @IsOptional()
  @IsString()
  notes?: string;
}

class CheckoutBody {
  @IsOptional()
  @IsString()
  pointOfSaleId?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TerminalLineBody)
  lines!: TerminalLineBody[];

  @IsIn(['CASH', 'CARD', 'CREDIT', 'MIXED', 'GIFT', 'WALLET'])
  paymentMethod!: 'CASH' | 'CARD' | 'CREDIT' | 'MIXED' | 'GIFT' | 'WALLET';

  @IsOptional()
  @IsArray()
  paymentSplits?: Array<{ method: string; amount: number | string }>;

  @IsOptional()
  @IsNumber()
  extraDiscountPct?: number;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsString()
  overrideCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['ISSUED', 'ON_HOLD'])
  status?: 'ISSUED' | 'ON_HOLD';
}

class QuoteCheckoutBody {
  @IsOptional()
  @IsString()
  pointOfSaleId?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TerminalLineBody)
  lines!: TerminalLineBody[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  expiresOn?: string;
}

class ValidatePosCouponBody {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  orderAmount?: number;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  pointOfSaleId?: string;
}

class QuickPosCustomerBody {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  pointOfSaleId?: string;
}

class IssueHeldBody {
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsArray()
  paymentSplits?: Array<{ method: string; amount: number | string }>;
}

class ApplyTemplateBody {
  @IsString()
  templateCode!: string;

  @IsOptional()
  @IsString()
  pointOfSaleId?: string;

  @IsOptional()
  @IsBoolean()
  seedCategories?: boolean;
}

class SaveLayoutBody {
  @IsString()
  pointOfSaleId!: string;

  @IsOptional()
  @IsObject()
  layoutJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  templateCode?: string | null;
}

class DrawerBody {
  @IsString()
  @MinLength(2)
  reason!: string;
}

class SupervisorPinBody {
  @IsString()
  @MinLength(4)
  pin!: string;
}

class ExchangeRatesBody {
  @IsObject()
  exchangeRates!: Record<string, number>;
}

class ReturnLineBody {
  @IsString()
  salesInvoiceItemId!: string;

  @Type(() => Number)
  @IsNumber()
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;
}

class ReturnBody {
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  overridePin?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnLineBody)
  items!: ReturnLineBody[];
}

class DenominationBody {
  @Type(() => Number)
  @IsNumber()
  value!: number;

  @Type(() => Number)
  @IsNumber()
  count!: number;
}

class OpenShiftBody {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  openingFloat?: number;

  @IsOptional()
  @IsString()
  pointOfSaleId?: string;
}

class CloseShiftBody {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DenominationBody)
  denominations!: DenominationBody[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pettyExpenses?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  overridePin?: string;

  @IsOptional()
  @IsString()
  pointOfSaleId?: string;
}

@Controller('companies/:companyId/sales/pos')
export class PosController {
  constructor(
    private readonly pos: PosService,
    private readonly terminal: PosTerminalService,
  ) {}

  @Get('branches')
  @RequirePermissions('sales.read')
  listBranches(@Param('companyId') companyId: string) {
    return this.pos.listBranches(companyId);
  }

  @Get()
  @RequirePermissions('sales.read')
  list(@Param('companyId') companyId: string) {
    return this.pos.listPointsOfSale(companyId);
  }

  @Get('cashiers')
  @RequirePermissions('sales.read')
  listCashiers(
    @Param('companyId') companyId: string,
    @Query('pointOfSaleId') pointOfSaleId?: string,
  ) {
    return this.pos.listCashiers(companyId, pointOfSaleId);
  }

  @Get('templates')
  @RequirePermissions('sales.read')
  listTemplates() {
    return this.terminal.listTemplates();
  }

  @Get('terminal/bootstrap')
  @RequireAnyPermission(...POS_TERMINAL_ACCESS)
  async bootstrap(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Query('pointOfSaleId') pointOfSaleId?: string,
  ) {
    const boot = await this.terminal.bootstrap(
      companyId,
      user.userId,
      pointOfSaleId,
    );
    return {
      ...boot,
      roleOps: resolvePosRoleOps(user),
    };
  }

  @Get('terminal/permission-templates')
  @RequirePermissions('sales.read')
  permissionTemplates() {
    return this.terminal.permissionTemplates();
  }

  @Get('terminal/exchange-rates')
  @RequirePermissions('sales.read')
  getExchangeRates(@Param('companyId') companyId: string) {
    return this.terminal.getExchangeRates(companyId);
  }

  @Patch('terminal/exchange-rates')
  @RequireAnyPermission('sales.write', 'pos.invoice_create')
  patchExchangeRates(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: ExchangeRatesBody,
  ) {
    return this.terminal.patchExchangeRates(
      companyId,
      user.userId,
      body.exchangeRates,
    );
  }

  @Post('terminal/settings/supervisor-pin')
  @RequireAnyPermission('sales.write')
  setSupervisorPin(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: SupervisorPinBody,
  ) {
    return this.terminal.setSupervisorPin(companyId, user.userId, body.pin);
  }

  @Post('terminal/verify-pin')
  @RequireAnyPermission(...POS_TERMINAL_ACCESS)
  verifyPin(
    @Param('companyId') companyId: string,
    @Body() body: SupervisorPinBody,
  ) {
    return this.terminal.verifySupervisorPin(companyId, body.pin);
  }

  @Get('terminal/invoices/lookup')
  @RequireAnyPermission(...POS_TERMINAL_ACCESS)
  lookupInvoice(
    @Param('companyId') companyId: string,
    @Query('q') q?: string,
  ) {
    return this.terminal.lookupInvoice(companyId, q ?? '');
  }

  @Post('terminal/returns')
  @RequireAnyPermission(...POS_TERMINAL_ACCESS)
  createReturn(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: ReturnBody,
  ) {
    return this.terminal.createReturn(companyId, user.userId, body);
  }

  @Get('terminal/shift/summary')
  @RequireAnyPermission(...POS_TERMINAL_ACCESS)
  shiftSummary(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Query('pointOfSaleId') pointOfSaleId?: string,
  ) {
    return this.terminal.shiftSummary(companyId, user.userId, pointOfSaleId);
  }

  @Post('terminal/shift/open')
  @RequireAnyPermission(...POS_TERMINAL_ACCESS)
  openShift(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: OpenShiftBody,
  ) {
    return this.terminal.openShift(companyId, user.userId, body);
  }

  @Post('terminal/shift/close')
  @RequireAnyPermission(...POS_TERMINAL_ACCESS)
  closeShift(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CloseShiftBody,
  ) {
    return this.terminal.closeShift(companyId, user.userId, body);
  }

  @Get('terminal/audit')
  @RequirePermissions('sales.read')
  audit(
    @Param('companyId') companyId: string,
    @Query('limit') limit?: string,
  ) {
    return this.terminal.listAudit(
      companyId,
      limit ? Number(limit) : 50,
    );
  }

  @Post('terminal/checkout')
  @RequireAnyPermission('sales.write', 'pos.invoice_create')
  checkout(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CheckoutBody,
  ) {
    return this.terminal.checkout(companyId, user.userId, body);
  }

  @Post('terminal/quick-checkout')
  @RequireAnyPermission('sales.write', 'pos.quick_invoice')
  quickCheckout(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: QuickCheckoutBody,
  ) {
    return this.terminal.quickCheckout(companyId, user.userId, body);
  }

  @Post('terminal/quote')
  @RequireAnyPermission('sales.write', 'pos.quote_create')
  checkoutQuote(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: QuoteCheckoutBody,
  ) {
    return this.terminal.checkoutQuote(companyId, user.userId, body);
  }

  @Get('terminal/quotes')
  @RequireAnyPermission(
    'sales.write',
    'pos.quote_create',
    'pos.quote_delete',
    'pos.quote_convert',
    'pos.quote_send_whatsapp',
  )
  listQuotes(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.terminal.listRecentQuotes(companyId, user.userId);
  }

  @Get('terminal/documents')
  @RequireAnyPermission(...POS_TERMINAL_ACCESS)
  listDocuments(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.terminal.listPosDocuments(companyId, user.userId);
  }

  @Post('terminal/quotes/:quoteId/cancel')
  @RequireAnyPermission('sales.write', 'pos.quote_delete')
  cancelQuote(
    @Param('companyId') companyId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.terminal.cancelPosQuote(companyId, user.userId, quoteId);
  }

  @Post('terminal/quotes/:quoteId/convert')
  @RequireAnyPermission('sales.write', 'pos.quote_convert')
  convertQuote(
    @Param('companyId') companyId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.terminal.convertPosQuote(companyId, user.userId, quoteId);
  }

  @Get('terminal/quotes/:quoteId')
  @RequireAnyPermission('sales.write', 'pos.quote_create')
  getQuote(
    @Param('companyId') companyId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.terminal.getPosQuote(companyId, user.userId, quoteId);
  }

  @Patch('terminal/quotes/:quoteId')
  @RequireAnyPermission('sales.write', 'pos.quote_create')
  updateQuote(
    @Param('companyId') companyId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: QuoteCheckoutBody,
  ) {
    return this.terminal.updatePosQuote(companyId, user.userId, quoteId, body);
  }

  @Post('terminal/coupons/validate')
  @RequireAnyPermission(...POS_TERMINAL_ACCESS)
  validateCoupon(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: ValidatePosCouponBody,
  ) {
    return this.terminal.validatePosCoupon(companyId, user.userId, body);
  }

  @Post('terminal/customers/quick')
  @RequireAnyPermission(...POS_TERMINAL_ACCESS)
  quickCustomer(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: QuickPosCustomerBody,
  ) {
    return this.terminal.quickPosCustomer(companyId, user.userId, body);
  }

  @Post('terminal/held/:invoiceId/issue')
  @RequireAnyPermission('sales.write', 'pos.invoice_create')
  issueHeld(
    @Param('companyId') companyId: string,
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: IssueHeldBody,
  ) {
    return this.terminal.issueHeld(companyId, user.userId, invoiceId, body);
  }

  @Post('terminal/held/:invoiceId/void')
  @RequireAnyPermission(...POS_TERMINAL_ACCESS)
  voidHeld(
    @Param('companyId') companyId: string,
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.terminal.voidHeld(companyId, user.userId, invoiceId);
  }

  @Post('terminal/drawer/open')
  @RequireAnyPermission(...POS_TERMINAL_ACCESS)
  openDrawer(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: DrawerBody,
  ) {
    return this.terminal.openCashDrawer(companyId, user.userId, body.reason);
  }

  @Post('terminal/layout')
  @RequireAnyPermission('sales.write')
  saveLayout(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: SaveLayoutBody,
  ) {
    return this.terminal.saveLayout(companyId, user.userId, body);
  }

  @Post('terminal/templates/apply')
  @RequireAnyPermission('sales.write')
  applyTemplate(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: ApplyTemplateBody,
  ) {
    return this.terminal.applyTemplate(companyId, user.userId, body);
  }

  @Post()
  @RequirePermissions('sales.write')
  create(
    @Param('companyId') companyId: string,
    @Body() body: CreatePosBody,
  ) {
    return this.pos.createPointOfSale({ companyId, ...body });
  }

  @Patch('cashiers/:cashierId')
  @RequirePermissions('sales.write')
  async updateCashier(
    @Param('companyId') companyId: string,
    @Param('cashierId') cashierId: string,
    @Body() body: UpdateCashierBody,
  ) {
    const updated = await this.pos.updateCashier(companyId, cashierId, body);
    if (body.permissions) {
      await this.terminal.updateCashierPermissions(
        companyId,
        cashierId,
        body.permissions as never,
      );
    }
    return updated;
  }

  @Post('cashiers/:cashierId/deactivate')
  @RequirePermissions('sales.write')
  deactivateCashier(
    @Param('companyId') companyId: string,
    @Param('cashierId') cashierId: string,
  ) {
    return this.pos.removeCashier(companyId, cashierId);
  }

  @Post(':posId/cashiers')
  @RequirePermissions('sales.write')
  addCashier(
    @Param('companyId') companyId: string,
    @Param('posId') posId: string,
    @Body() body: AddCashierBody,
  ) {
    return this.pos.addCashier({
      companyId,
      pointOfSaleId: posId,
      ...body,
    });
  }

  @Patch(':posId')
  @RequirePermissions('sales.write')
  update(
    @Param('companyId') companyId: string,
    @Param('posId') posId: string,
    @Body() body: UpdatePosBody,
  ) {
    return this.pos.updatePointOfSale(companyId, posId, body);
  }
}
