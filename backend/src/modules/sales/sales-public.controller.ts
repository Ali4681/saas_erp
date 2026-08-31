import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/auth/auth.decorators';
import { verifyInvoiceShareToken } from '../../common/documents/invoice-share-token';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { SalesService } from './sales.service';

@Controller('public/sales')
export class SalesPublicController {
  constructor(
    private readonly sales: SalesService,
    private readonly tenant: TenantContextService,
  ) {}

  /** QR / share link: PDF without QR, no login required (signed token). */
  @Public()
  @Get('invoice-pdf')
  async sharedInvoicePdf(
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ) {
    if (!token) {
      throw new BadRequestException('token is required');
    }
    let payload;
    try {
      payload = verifyInvoiceShareToken(token);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid token',
      );
    }

    this.tenant.setCompanyId(payload.companyId);
    const pdf = await this.sales.invoicePdf(
      payload.companyId,
      payload.invoiceId,
      {
        theme: payload.theme as 'CLASSIC' | 'MODERN' | 'MINIMAL',
        format: payload.format as 'A4' | 'A12' | 'THERMAL',
        includeQr: false,
      },
    );

    const bytes = Buffer.from(pdf.contentBase64, 'base64');
    res.setHeader('Content-Type', pdf.mimeType || 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${pdf.fileName || 'invoice.pdf'}"`,
    );
    res.send(bytes);
  }
}
