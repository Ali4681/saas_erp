import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  IsArray,
  IsEnum,
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
      ...body,
    });
  }

  @Post('payments')
  @RequirePermissions('sales.write')
  recordPayment(
    @Param('companyId') companyId: string,
    @Body() body: RecordPaymentBody,
  ) {
    return this.sales.recordPayment({ companyId, ...body });
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
  ) {
    return this.sales.createCreditNote({ companyId, ...body });
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
