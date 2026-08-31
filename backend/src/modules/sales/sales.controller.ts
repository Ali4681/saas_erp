import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
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

class UpdateQuoteBody {
  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  issuedOn?: string;

  @IsOptional()
  @IsString()
  expiresOn?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemBody)
  items?: LineItemBody[];
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

class PaymentSplitBody {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsNumberString()
  amount!: string;
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
  @IsEnum({ DRAFT: 'DRAFT', ISSUED: 'ISSUED', ON_HOLD: 'ON_HOLD' })
  status?: 'DRAFT' | 'ISSUED' | 'ON_HOLD';

  @IsOptional()
  @IsString()
  companyBranchId?: string;

  @IsOptional()
  @IsString()
  saleChannel?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentSplitBody)
  paymentSplits?: PaymentSplitBody[];

  @IsOptional()
  @IsString()
  pointOfSaleId?: string;

  @IsOptional()
  @IsString()
  posCashierId?: string;

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

class IssueInvoiceBody {
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentSplitBody)
  paymentSplits?: PaymentSplitBody[];

  @IsOptional()
  @IsString()
  dueOn?: string;
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

  @Patch('quotes/:quoteId')
  @RequirePermissions('sales.write')
  updateQuote(
    @Param('companyId') companyId: string,
    @Param('quoteId') quoteId: string,
    @Body() body: UpdateQuoteBody,
  ) {
    return this.sales.updateQuote(companyId, quoteId, body);
  }

  @Get('quotes/:quoteId/pdf')
  @RequirePermissions('sales.read')
  quotePdf(
    @Param('companyId') companyId: string,
    @Param('quoteId') quoteId: string,
    @Query('theme') theme?: 'CLASSIC' | 'MODERN' | 'MINIMAL',
  ) {
    return this.sales.quotePdf(companyId, quoteId, theme);
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

  @Patch('invoices/:invoiceId')
  @RequirePermissions('sales.write')
  updateInvoice(
    @Param('companyId') companyId: string,
    @Param('invoiceId') invoiceId: string,
    @Body()
    body: {
      contactId?: string;
      issuedOn?: string;
      dueOn?: string | null;
      currency?: string;
      saleChannel?: string;
      items?: LineItemBody[];
    },
  ) {
    return this.sales.updateInvoice(companyId, invoiceId, body);
  }

  @Post('invoices/:invoiceId/cancel')
  @RequirePermissions('sales.write')
  cancelInvoice(
    @Param('companyId') companyId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.sales.cancelInvoice(companyId, invoiceId);
  }

  @Post('invoices/:invoiceId/issue')
  @RequirePermissions('sales.write')
  issueInvoice(
    @Param('companyId') companyId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() body: IssueInvoiceBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.issueHeldInvoice({
      companyId,
      invoiceId,
      createdById: user.userId,
      paymentMethod: body.paymentMethod,
      paymentSplits: body.paymentSplits,
      dueOn: body.dueOn,
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

  @Get('customer-statements')
  @RequirePermissions('sales.read')
  listCustomerStatements(@Param('companyId') companyId: string) {
    return this.sales.listCustomerStatements(companyId);
  }

  @Get('contacts/:contactId/statement')
  @RequirePermissions('sales.read')
  getCustomerStatement(
    @Param('companyId') companyId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.sales.getCustomerStatement(companyId, contactId);
  }

  @Get('contacts/:contactId/statement/pdf')
  @RequirePermissions('sales.read')
  customerStatementPdf(
    @Param('companyId') companyId: string,
    @Param('contactId') contactId: string,
    @Query('theme') theme?: 'CLASSIC' | 'MODERN' | 'MINIMAL',
  ) {
    return this.sales.customerStatementPdf(companyId, contactId, theme);
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

  @Patch('credit-notes/:creditNoteId')
  @RequirePermissions('sales.write')
  updateCreditNote(
    @Param('companyId') companyId: string,
    @Param('creditNoteId') creditNoteId: string,
    @Body()
    body: {
      reason?: string;
      issuedOn?: string;
      items?: Array<{
        description: string;
        quantity: string;
        amount: string;
      }>;
    },
  ) {
    return this.sales.updateCreditNote(companyId, creditNoteId, body);
  }

  @Post('credit-notes/:creditNoteId/cancel')
  @RequirePermissions('sales.write')
  cancelCreditNote(
    @Param('companyId') companyId: string,
    @Param('creditNoteId') creditNoteId: string,
  ) {
    return this.sales.cancelCreditNote(companyId, creditNoteId);
  }

  @Get('credit-notes/:creditNoteId/pdf')
  @RequirePermissions('sales.read')
  creditNotePdf(
    @Param('companyId') companyId: string,
    @Param('creditNoteId') creditNoteId: string,
    @Query('theme') theme?: 'CLASSIC' | 'MODERN' | 'MINIMAL',
  ) {
    return this.sales.creditNotePdf(companyId, creditNoteId, theme);
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
    @Query() query?: { theme?: 'CLASSIC' | 'MODERN' | 'MINIMAL'; format?: 'A4' | 'A12' | 'THERMAL'; noQr?: string; qrUrl?: string },
  ) {
    return this.sales.invoicePdf(companyId, invoiceId, { theme: query?.theme, format: query?.format, includeQr: query?.noQr !== '1', qrUrl: query?.qrUrl });
  }
}
