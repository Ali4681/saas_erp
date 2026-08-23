import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PaymentMethod,
  SalesDocumentStatus,
} from '../../generated/prisma/client';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { SalesService } from './sales.service';

class LineItemBody {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsNumberString()
  quantity!: string;

  @IsNumberString()
  unitPrice!: string;

  @IsOptional()
  @IsNumberString()
  discountAmount?: string;

  @IsOptional()
  @IsNumberString()
  taxAmount?: string;

  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsString()
  bundleId?: string;
}

class CreateQuoteBody {
  @IsString()
  contactId!: string;

  @IsString()
  issuedOn!: string;

  @IsOptional()
  @IsString()
  expiresOn?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemBody)
  items!: LineItemBody[];
}

class UpdateQuoteStatusBody {
  @IsEnum(SalesDocumentStatus)
  status!: SalesDocumentStatus;
}

class ConvertQuoteBody {
  @IsOptional()
  @IsString()
  issuedOn?: string;

  @IsOptional()
  @IsString()
  dueOn?: string;

  @IsOptional()
  @IsString()
  companyBranchId?: string;
}

class CreateInvoiceBody {
  @IsString()
  contactId!: string;

  @IsString()
  issuedOn!: string;

  @IsOptional()
  @IsString()
  dueOn?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum({ DRAFT: 'DRAFT', ISSUED: 'ISSUED' })
  status?: 'DRAFT' | 'ISSUED';

  @IsOptional()
  @IsString()
  companyBranchId?: string;

  @IsOptional()
  @IsString()
  saleChannel?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsString()
  priceListId?: string;

  @IsOptional()
  @IsNumberString()
  storeCreditAmount?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  extraDiscountPct?: number;

  @IsOptional()
  @IsString()
  overrideCode?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemBody)
  items!: LineItemBody[];
}

class RecordPaymentBody {
  @IsString()
  salesInvoiceId!: string;

  @IsNumberString()
  amount!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;
}

class CreateCreditNoteBody {
  @IsString()
  salesInvoiceId!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  issuedOn?: string;

  @IsOptional()
  toStoreCredit?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreditNoteLineBody)
  items?: CreditNoteLineBody[];
}

class CreditNoteLineBody {
  @IsOptional()
  @IsString()
  salesInvoiceItemId?: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsNumberString()
  quantity!: string;

  @IsNumberString()
  amount!: string;
}

@Controller('companies/:companyId/sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get('quotes')
  @RequirePermissions('sales.read')
  listQuotes(@Param('companyId') companyId: string) {
    return this.sales.listQuotes(companyId);
  }

  @Post('quotes')
  @RequirePermissions('sales.write')
  createQuote(
    @Param('companyId') companyId: string,
    @Body() body: CreateQuoteBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.createQuote({
      companyId,
      createdById: user.userId,
      ...body,
    });
  }

  @Patch('quotes/:quoteId/status')
  @RequirePermissions('sales.write')
  updateQuoteStatus(
    @Param('companyId') companyId: string,
    @Param('quoteId') quoteId: string,
    @Body() body: UpdateQuoteStatusBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.updateQuoteStatus(
      companyId,
      quoteId,
      body.status,
      user.userId,
    );
  }

  @Post('quotes/:quoteId/convert')
  @RequirePermissions('sales.write')
  convertQuote(
    @Param('companyId') companyId: string,
    @Param('quoteId') quoteId: string,
    @Body() body: ConvertQuoteBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.convertQuoteToInvoice(
      companyId,
      quoteId,
      body.issuedOn,
      body.dueOn,
      { createdById: user.userId, companyBranchId: body.companyBranchId },
    );
  }

  @Get('invoices')
  @RequirePermissions('sales.read')
  listInvoices(@Param('companyId') companyId: string) {
    return this.sales.listInvoices(companyId);
  }

  @Post('invoices')
  @RequirePermissions('sales.write')
  createInvoice(
    @Param('companyId') companyId: string,
    @Body() body: CreateInvoiceBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.createInvoice({
      companyId,
      createdById: user.userId,
      discountOverrideAuthorized:
        user.isPlatformAdmin ||
        user.permissions.includes('sales.discount_override'),
      ...body,
    });
  }

  @Post('payments')
  @RequirePermissions('sales.write')
  recordPayment(
    @Param('companyId') companyId: string,
    @Body() body: RecordPaymentBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.recordPayment({ companyId, ...body, createdById: user.userId });
  }

  @Get('credit-notes')
  @RequirePermissions('sales.read')
  listCreditNotes(@Param('companyId') companyId: string) {
    return this.sales.listCreditNotes(companyId);
  }

  @Post('credit-notes')
  @RequirePermissions('sales.write')
  createCreditNote(
    @Param('companyId') companyId: string,
    @Body() body: CreateCreditNoteBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.createCreditNote({
      companyId,
      ...body,
      createdById: user.userId,
    });
  }

  @Get('reports/ar-aging')
  @RequirePermissions('sales.read')
  arAging(@Param('companyId') companyId: string) {
    return this.sales.arAging(companyId);
  }

  @Get('reports/channels')
  @RequirePermissions('sales.read')
  channelReport(@Param('companyId') companyId: string) {
    return this.sales.channelReport(companyId);
  }

  @Get('reports/track-revenue')
  @RequirePermissions('sales.read')
  trackRevenue(@Param('companyId') companyId: string) {
    return this.sales.trackRevenueReport(companyId);
  }

  @Get('reports/ticket-cost')
  @RequirePermissions('sales.read')
  ticketCost(@Param('companyId') companyId: string) {
    return this.sales.ticketCostReport(companyId);
  }

  @Get('reports/deferred-revenue')
  @RequirePermissions('sales.read')
  deferredRevenue(@Param('companyId') companyId: string) {
    return this.sales.deferredContractRevenue(companyId);
  }

  @Get('customer-pos')
  @RequirePermissions('sales.read')
  listCustomerPos(@Param('companyId') companyId: string) {
    return this.sales.listCustomerPurchaseOrders(companyId);
  }

  @Post('customer-pos')
  @RequirePermissions('sales.write')
  createCustomerPo(
    @Param('companyId') companyId: string,
    @Body()
    body: {
      contactId: string;
      poNumber: string;
      issuedOn?: string;
      notes?: string;
      items: Array<{
        description: string;
        quantity: string;
        unitPrice: string;
        itemId?: string;
      }>;
    },
  ) {
    return this.sales.createCustomerPurchaseOrder({ companyId, ...body });
  }

  @Post('customer-pos/:poId/convert')
  @RequirePermissions('sales.write')
  convertCustomerPo(
    @Param('companyId') companyId: string,
    @Param('poId') poId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.convertCustomerPurchaseOrder(companyId, poId, user.userId);
  }

  @Post('channel-orders')
  @RequirePermissions('sales.write')
  ingestChannelOrder(
    @Param('companyId') companyId: string,
    @Body()
    body: {
      provider: string;
      externalOrderId: string;
      saleChannel: string;
      contactPhone?: string;
      contactName?: string;
      commissionAmount?: number;
      items: Array<{
        description: string;
        quantity: string;
        unitPrice: string;
        itemId?: string;
      }>;
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.ingestChannelOrder({
      companyId,
      createdById: user.userId,
      ...body,
    });
  }

  @Get('invoices/:invoiceId/zatca')
  @RequirePermissions('sales.read')
  zatca(
    @Param('companyId') companyId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.sales.zatcaDocument(companyId, invoiceId);
  }

  @Get('invoices/:invoiceId/pdf')
  @RequirePermissions('sales.read')
  invoicePdf(
    @Param('companyId') companyId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.sales.invoicePdf(companyId, invoiceId);
  }
}
