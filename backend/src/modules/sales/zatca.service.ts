import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';

/** ZATCA Phase-1 simplified e-invoice TLV QR (tags 1–5). */
@Injectable()
export class ZatcaService {
  buildTlvQr(input: {
    sellerName: string;
    vatNumber: string;
    timestamp: Date;
    total: number;
    vat: number;
  }) {
    const parts = [
      this.tlv(1, input.sellerName),
      this.tlv(2, input.vatNumber.replace(/\s/g, '')),
      this.tlv(3, input.timestamp.toISOString()),
      this.tlv(4, input.total.toFixed(2)),
      this.tlv(5, input.vat.toFixed(2)),
    ];
    return Buffer.concat(parts).toString('base64');
  }

  buildSimplifiedXml(input: {
    invoiceNumber: string;
    sellerName: string;
    vatNumber: string;
    issuedOn: Date;
    total: number;
    vat: number;
    buyerName?: string;
  }) {
    const hash = createHash('sha256')
      .update(`${input.invoiceNumber}|${input.total}|${input.issuedOn.toISOString()}`)
      .digest('hex');
    return {
      hash,
      xml: `<?xml version="1.0" encoding="UTF-8"?>
<Invoice>
  <ProfileID>reporting:1.0</ProfileID>
  <ID>${this.esc(input.invoiceNumber)}</ID>
  <IssueDate>${input.issuedOn.toISOString().slice(0, 10)}</IssueDate>
  <DocumentCurrencyCode>SAR</DocumentCurrencyCode>
  <AccountingSupplierParty>
    <PartyName>${this.esc(input.sellerName)}</PartyName>
    <CompanyID>${this.esc(input.vatNumber)}</CompanyID>
  </AccountingSupplierParty>
  <AccountingCustomerParty>
    <PartyName>${this.esc(input.buyerName ?? '')}</PartyName>
  </AccountingCustomerParty>
  <LegalMonetaryTotal>
    <PayableAmount>${input.total.toFixed(2)}</PayableAmount>
    <TaxAmount>${input.vat.toFixed(2)}</TaxAmount>
  </LegalMonetaryTotal>
  <DocumentHash>${hash}</DocumentHash>
</Invoice>`,
    };
  }

  private tlv(tag: number, value: string) {
    const buf = Buffer.from(value, 'utf8');
    return Buffer.concat([Buffer.from([tag, buf.length]), buf]);
  }

  private esc(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
