import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export type DocumentTheme = 'CLASSIC' | 'MODERN' | 'MINIMAL';
export type InvoiceFormat = 'A4' | 'A12' | 'THERMAL';

export type SalesPdfData = {
  kind: 'QUOTE' | 'INVOICE' | 'CREDIT_NOTE' | 'STATEMENT';
  number: string;
  status: string;
  issuedOn: Date;
  secondaryDate?: Date | null;
  currency: string;
  customer: string;
  customerTaxNumber?: string | null;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  balanceDue?: string;
  reason?: string | null;
  relatedInvoiceNumber?: string | null;
  paymentMethod?: string | null;
  companyName: string;
  companyTaxNumber?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  lines: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    taxAmount: string;
    totalAmount: string;
  }>;
  logo?: Buffer | null;
  qrUrl?: string | null;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

type LayoutCtx = {
  doc: PdfDoc;
  data: SalesPdfData;
  format: InvoiceFormat;
  size: [number, number];
  margin: number;
  contentWidth: number;
  compact: boolean;
  titleSize: number;
  bodySize: number;
  labelSize: number;
};

function pageSize(format: InvoiceFormat, lineCount: number): [number, number] {
  if (format === 'THERMAL') {
    return [226.77, Math.max(640, 460 + lineCount * 36)];
  }
  if (format === 'A12') {
    return [298.08, 419.53];
  }
  return [595.28, 841.89];
}

function money(value: string, currency: string) {
  return `${value} ${currency}`;
}

function docKindLabel(kind: SalesPdfData['kind']) {
  if (kind === 'QUOTE') return 'QUOTATION';
  if (kind === 'CREDIT_NOTE') return 'CREDIT NOTE';
  if (kind === 'STATEMENT') return 'ACCOUNT STATEMENT';
  return 'TAX INVOICE';
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function drawQr(
  ctx: LayoutCtx,
  x: number,
  y: number,
  size: number,
  caption?: string,
) {
  if (!ctx.data.qrUrl) return y;
  const qr = await QRCode.toBuffer(ctx.data.qrUrl, {
    type: 'png',
    margin: 1,
    width: 180,
    errorCorrectionLevel: 'M',
  });
  ctx.doc.image(qr, x, y, { width: size });
  if (caption) {
    ctx.doc
      .fontSize(ctx.labelSize)
      .fillColor('#6b7280')
      .font('Helvetica')
      .text(caption, x + size + 8, y + size / 2 - 6, {
        width: Math.max(80, ctx.contentWidth - size - 24),
      });
  }
  return y + size + 8;
}

function drawFooter(ctx: LayoutCtx, note?: string) {
  const footerY = ctx.size[1] - (ctx.compact ? 26 : 34);
  ctx.doc
    .fontSize(ctx.labelSize)
    .fillColor('#9ca3af')
    .font('Helvetica')
    .text(
      note ??
        `${ctx.data.companyName} · ${docKindLabel(ctx.data.kind)} ${ctx.data.number}`,
      ctx.margin,
      footerY,
      { width: ctx.contentWidth, align: 'center' },
    );
}

function tryLogo(
  doc: PdfDoc,
  logo: Buffer | null | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!logo) return false;
  try {
    doc.image(logo, x, y, { fit: [w, h] });
    return true;
  } catch {
    return false;
  }
}

/** CLASSIC — formal letterhead, ruled table, signature block */
function drawClassic(ctx: LayoutCtx) {
  const { doc, data, margin, contentWidth, compact, titleSize, bodySize, labelSize } =
    ctx;
  const ink = '#1a1a1a';
  const rule = '#1a1a1a';
  let y = margin;

  const logoW = compact ? 44 : 64;
  const logoH = compact ? 32 : 48;
  const hasLogo = tryLogo(doc, data.logo, margin, y, logoW, logoH);

  doc
    .fillColor(ink)
    .font('Helvetica-Bold')
    .fontSize(compact ? 12 : 16)
    .text(data.companyName, margin + (hasLogo ? logoW + 10 : 0), y + 2, {
      width: contentWidth - (hasLogo ? logoW + 10 : 0),
      align: 'center',
    });
  doc
    .font('Helvetica')
    .fontSize(labelSize)
    .fillColor('#4b5563')
    .text(
      [data.companyTaxNumber ? `VAT ${data.companyTaxNumber}` : null, data.companyPhone, data.companyAddress]
        .filter(Boolean)
        .join('  ·  ') || ' ',
      margin,
      y + (compact ? 18 : 24),
      { width: contentWidth, align: 'center' },
    );

  y += compact ? 48 : 64;
  doc
    .moveTo(margin, y)
    .lineTo(margin + contentWidth, y)
    .strokeColor(rule)
    .lineWidth(1.8)
    .stroke();
  doc
    .moveTo(margin, y + 3)
    .lineTo(margin + contentWidth, y + 3)
    .lineWidth(0.5)
    .stroke();

  y += 14;
  doc
    .fillColor(ink)
    .font('Helvetica-Bold')
    .fontSize(titleSize)
    .text(docKindLabel(data.kind), margin, y, {
      width: contentWidth,
      align: 'center',
    });
  y += compact ? 16 : 22;
  doc
    .font('Helvetica')
    .fontSize(bodySize)
    .text(`No. ${data.number}    ·    Status: ${data.status}`, {
      width: contentWidth,
      align: 'center',
    });

  y += compact ? 20 : 28;
  const half = contentWidth / 2 - 6;
  doc.font('Helvetica-Bold').fontSize(labelSize).fillColor('#4b5563').text('BILL TO', margin, y);
  doc
    .font('Helvetica-Bold')
    .fontSize(bodySize)
    .fillColor(ink)
    .text(data.customer, margin, y + 12, { width: half });
  if (data.customerTaxNumber) {
    doc
      .font('Helvetica')
      .fontSize(labelSize)
      .fillColor('#4b5563')
      .text(`Tax #: ${data.customerTaxNumber}`, { width: half });
  }

  const metaX = margin + half + 12;
  doc.font('Helvetica-Bold').fontSize(labelSize).fillColor('#4b5563').text('DETAILS', metaX, y);
  doc
    .font('Helvetica')
    .fontSize(bodySize)
    .fillColor(ink)
    .text(`Issued: ${iso(data.issuedOn)}`, metaX, y + 12, { width: half });
  if (data.secondaryDate) {
    doc.text(
      `${data.kind === 'QUOTE' ? 'Expires' : data.kind === 'CREDIT_NOTE' ? 'Related' : 'Due'}: ${
        data.kind === 'CREDIT_NOTE' && data.relatedInvoiceNumber
          ? data.relatedInvoiceNumber
          : iso(data.secondaryDate)
      }`,
      { width: half },
    );
  } else if (data.relatedInvoiceNumber) {
    doc.text(`Invoice: ${data.relatedInvoiceNumber}`, { width: half });
  }
  if (data.paymentMethod) {
    doc.text(`Payment: ${data.paymentMethod}`, { width: half });
  }

  y = Math.max(doc.y, y + (compact ? 48 : 58)) + 10;
  y = drawRuledTable(ctx, y, {
    headerFill: null,
    headerStroke: true,
    rowRules: true,
    ink,
    accent: ink,
  });

  if (data.reason) {
    doc
      .font('Helvetica-Oblique')
      .fontSize(labelSize)
      .fillColor('#4b5563')
      .text(`Reason: ${data.reason}`, margin, y, { width: contentWidth * 0.55 });
    y = doc.y + 8;
  }

  y = drawTotalsBlock(ctx, y, {
    style: 'classic',
    ink,
    accent: ink,
    soft: '#f5f5f5',
  });

  // Signature lines
  if (!compact) {
    const sigY = Math.min(y + 28, ctx.size[1] - 90);
    doc
      .moveTo(margin, sigY)
      .lineTo(margin + 140, sigY)
      .strokeColor('#9ca3af')
      .lineWidth(0.6)
      .stroke();
    doc
      .fontSize(labelSize)
      .fillColor('#6b7280')
      .font('Helvetica')
      .text('Authorized signature', margin, sigY + 4, { width: 140 });
    doc
      .moveTo(margin + contentWidth - 140, sigY)
      .lineTo(margin + contentWidth, sigY)
      .stroke();
    doc.text('Customer acknowledgment', margin + contentWidth - 140, sigY + 4, {
      width: 140,
    });
  }

  drawFooter(ctx);
}

/** MODERN — bold sidebar, large number, strong hierarchy */
function drawModern(ctx: LayoutCtx) {
  const { doc, data, margin, contentWidth, compact, size, titleSize, bodySize, labelSize } =
    ctx;
  const accent = '#0d4f4a';
  const soft = '#e6f2f0';
  const ink = '#0f172a';
  const sidebar = compact ? 0 : 18;

  if (!compact) {
    doc.rect(0, 0, sidebar, size[1]).fill(accent);
  }
  doc.rect(sidebar, 0, size[0] - sidebar, compact ? 72 : 96).fill(accent);

  const left = margin + (compact ? 0 : 6);
  const width = contentWidth - (compact ? 0 : 6);
  const logoW = compact ? 40 : 56;
  const logoH = compact ? 30 : 44;
  const hasLogo = tryLogo(doc, data.logo, left, compact ? 16 : 22, logoW, logoH);

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(compact ? 10 : 13)
    .text(data.companyName, left + (hasLogo ? logoW + 10 : 0), compact ? 18 : 24, {
      width: width * 0.55,
    });
  if (data.companyTaxNumber) {
    doc
      .font('Helvetica')
      .fontSize(labelSize)
      .fillColor('#b7ddd8')
      .text(`VAT ${data.companyTaxNumber}`, {
        width: width * 0.55,
      });
  }

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(compact ? 9 : 11)
    .text(docKindLabel(data.kind), left + width * 0.5, compact ? 18 : 22, {
      width: width * 0.5,
      align: 'right',
    });
  doc
    .font('Helvetica')
    .fontSize(compact ? 14 : 20)
    .text(data.number, {
      width: width * 0.5,
      align: 'right',
    });

  let y = compact ? 86 : 118;

  // Customer panel
  doc.roundedRect(left, y, width * 0.58, compact ? 54 : 70, 8).fill(soft);
  doc
    .fillColor(accent)
    .font('Helvetica-Bold')
    .fontSize(labelSize)
    .text('CUSTOMER', left + 12, y + 10, { width: width * 0.58 - 24 });
  doc
    .fillColor(ink)
    .font('Helvetica-Bold')
    .fontSize(bodySize + 1)
    .text(data.customer, left + 12, y + 24, {
      width: width * 0.58 - 24,
      height: compact ? 24 : 32,
    });
  if (data.customerTaxNumber) {
    doc
      .font('Helvetica')
      .fontSize(labelSize)
      .fillColor('#5f736f')
      .text(`Tax #: ${data.customerTaxNumber}`, left + 12, y + (compact ? 42 : 52), {
        width: width * 0.58 - 24,
      });
  }

  const metaX = left + width * 0.6;
  const metaRows: Array<[string, string]> = [
    ['Issued', iso(data.issuedOn)],
    ['Status', data.status],
  ];
  if (data.secondaryDate && data.kind !== 'CREDIT_NOTE') {
    metaRows.push([data.kind === 'QUOTE' ? 'Expires' : 'Due', iso(data.secondaryDate)]);
  }
  if (data.relatedInvoiceNumber) {
    metaRows.push(['Invoice', data.relatedInvoiceNumber]);
  }
  if (data.paymentMethod) {
    metaRows.push(['Payment', data.paymentMethod]);
  }
  metaRows.forEach(([k, v], i) => {
    const my = y + 8 + i * (compact ? 12 : 14);
    doc
      .fillColor('#6b7280')
      .font('Helvetica')
      .fontSize(labelSize)
      .text(k, metaX, my, { width: width * 0.18 });
    doc
      .fillColor(ink)
      .font('Helvetica-Bold')
      .fontSize(bodySize)
      .text(v, metaX + width * 0.18, my, { width: width * 0.22, align: 'right' });
  });

  y += compact ? 66 : 86;
  y = drawRuledTable(ctx, y, {
    headerFill: accent,
    headerStroke: false,
    rowRules: false,
    zebra: true,
    ink,
    accent,
    leftOffset: compact ? 0 : 6,
  });

  if (data.reason) {
    doc
      .roundedRect(left, y, width, 28, 6)
      .fill(soft);
    doc
      .font('Helvetica')
      .fontSize(labelSize)
      .fillColor(accent)
      .text(data.reason, left + 10, y + 9, { width: width - 20 });
    y += 36;
  }

  // Large total callout
  const totalsW = Math.min(width * 0.5, compact ? 150 : 230);
  const totalsX = left + width - totalsW;
  doc.roundedRect(totalsX, y, totalsW, compact ? 56 : 72, 10).fill(accent);
  doc
    .fillColor('#b7ddd8')
    .font('Helvetica')
    .fontSize(labelSize)
    .text('TOTAL', totalsX + 12, y + 10, { width: totalsW - 24 });
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(compact ? 12 : 16)
    .text(money(data.totalAmount, data.currency), totalsX + 12, y + (compact ? 24 : 28), {
      width: totalsW - 24,
    });
  if (data.balanceDue != null) {
    doc
      .font('Helvetica')
      .fontSize(labelSize)
      .fillColor('#d1fae5')
      .text(`Balance ${money(data.balanceDue, data.currency)}`, totalsX + 12, y + (compact ? 42 : 52), {
        width: totalsW - 24,
      });
  }

  const detailY = y + 4;
  doc
    .fillColor('#6b7280')
    .font('Helvetica')
    .fontSize(labelSize)
    .text(`Subtotal  ${money(data.subtotal, data.currency)}`, left, detailY);
  doc.text(`Discount  ${money(data.discountAmount, data.currency)}`);
  doc.text(`Tax  ${money(data.taxAmount, data.currency)}`);

  drawFooter(ctx, `${data.companyName} · ${docKindLabel(data.kind)} ${data.number}`);
}

/** MINIMAL / Simple — typography & hairlines, lots of air */
function drawMinimal(ctx: LayoutCtx) {
  const { doc, data, margin, contentWidth, compact, titleSize, bodySize, labelSize } =
    ctx;
  const ink = '#111827';
  const muted = '#6b7280';
  let y = margin;

  const hasLogo = tryLogo(doc, data.logo, margin, y, compact ? 36 : 48, compact ? 28 : 40);
  doc
    .fillColor(ink)
    .font('Helvetica')
    .fontSize(labelSize)
    .text(data.companyName.toUpperCase(), margin + (hasLogo ? (compact ? 44 : 58) : 0), y + 4, {
      characterSpacing: 1.2,
    });
  doc
    .font('Helvetica-Bold')
    .fontSize(compact ? 16 : 26)
    .text(docKindLabel(data.kind), margin, y + (compact ? 28 : 40), {
      width: contentWidth * 0.62,
    });
  doc
    .font('Helvetica')
    .fontSize(bodySize)
    .fillColor(muted)
    .text(data.number, margin + contentWidth * 0.62, y + (compact ? 34 : 48), {
      width: contentWidth * 0.38,
      align: 'right',
    });

  y += compact ? 58 : 84;
  doc
    .moveTo(margin, y)
    .lineTo(margin + contentWidth, y)
    .strokeColor('#e5e7eb')
    .lineWidth(0.7)
    .stroke();
  y += 16;

  const col = contentWidth / 3;
  const meta: Array<[string, string]> = [
    ['Customer', data.customer],
    ['Issued', iso(data.issuedOn)],
    ['Status', data.status],
  ];
  if (data.paymentMethod) meta[2] = ['Payment', data.paymentMethod];
  meta.forEach(([k, v], i) => {
    const x = margin + i * col;
    doc.fillColor(muted).font('Helvetica').fontSize(labelSize).text(k, x, y, { width: col - 8 });
    doc
      .fillColor(ink)
      .font('Helvetica')
      .fontSize(bodySize)
      .text(v, x, y + 12, { width: col - 8, height: 28 });
  });
  y += compact ? 44 : 52;
  if (data.relatedInvoiceNumber || data.customerTaxNumber || data.secondaryDate) {
    const extras = [
      data.relatedInvoiceNumber ? `Invoice ${data.relatedInvoiceNumber}` : null,
      data.customerTaxNumber ? `Customer VAT ${data.customerTaxNumber}` : null,
      data.secondaryDate && data.kind !== 'CREDIT_NOTE'
        ? `${data.kind === 'QUOTE' ? 'Expires' : 'Due'} ${iso(data.secondaryDate)}`
        : null,
    ]
      .filter(Boolean)
      .join('   ·   ');
    if (extras) {
      doc.fillColor(muted).fontSize(labelSize).text(extras, margin, y, { width: contentWidth });
      y += 16;
    }
  }

  y = drawRuledTable(ctx, y, {
    headerFill: null,
    headerStroke: false,
    hairlineHeader: true,
    rowRules: true,
    ink,
    accent: ink,
  });

  if (data.reason) {
    doc
      .fillColor(muted)
      .font('Helvetica')
      .fontSize(labelSize)
      .text(data.reason, margin, y, { width: contentWidth * 0.55 });
    y = doc.y + 10;
  }

  y = drawTotalsBlock(ctx, y, {
    style: 'minimal',
    ink,
    accent: ink,
    soft: '#ffffff',
  });

  drawFooter(ctx);
}

function drawRuledTable(
  ctx: LayoutCtx,
  startY: number,
  opts: {
    headerFill: string | null;
    headerStroke: boolean;
    hairlineHeader?: boolean;
    rowRules: boolean;
    zebra?: boolean;
    ink: string;
    accent: string;
    leftOffset?: number;
  },
) {
  const { doc, data, margin, contentWidth, compact, bodySize, labelSize } = ctx;
  const left = margin + (opts.leftOffset ?? 0);
  const width = contentWidth - (opts.leftOffset ?? 0);
  let y = startY;
  const descW = width * (compact ? 0.4 : 0.46);
  const otherW = (width - descW) / 4;
  const columns = [
    left,
    left + descW,
    left + descW + otherW,
    left + descW + otherW * 2,
    left + descW + otherW * 3,
  ];
  const headers = ['Description', 'Qty', 'Price', 'Tax', 'Total'];
  const rowH = compact ? 18 : 22;
  const headH = compact ? 16 : 20;

  if (opts.headerFill) {
    doc.rect(left, y, width, headH).fill(opts.headerFill);
  } else if (opts.headerStroke) {
    doc.rect(left, y, width, headH).strokeColor(opts.accent).lineWidth(1).stroke();
  } else if (opts.hairlineHeader) {
    doc
      .moveTo(left, y + headH)
      .lineTo(left + width, y + headH)
      .strokeColor('#111827')
      .lineWidth(1)
      .stroke();
  }

  headers.forEach((h, i) => {
    doc
      .fillColor(opts.headerFill ? '#ffffff' : opts.ink)
      .font('Helvetica-Bold')
      .fontSize(labelSize)
      .text(h, columns[i]! + (i === 0 ? 4 : 0), y + (compact ? 4 : 5), {
        width: i === 0 ? descW - 8 : otherW - 4,
        align: i === 0 ? 'left' : 'right',
      });
  });
  y += headH + 4;

  data.lines.forEach((line, index) => {
    if (opts.zebra && index % 2 === 0) {
      doc.rect(left, y - 2, width, rowH).fill('#f8fafc');
    }
    const values = [
      line.description,
      line.quantity,
      line.unitPrice,
      line.taxAmount,
      line.totalAmount,
    ];
    values.forEach((v, i) => {
      doc
        .fillColor(opts.ink)
        .font('Helvetica')
        .fontSize(bodySize)
        .text(String(v), columns[i]! + (i === 0 ? 4 : 0), y, {
          width: i === 0 ? descW - 8 : otherW - 4,
          align: i === 0 ? 'left' : 'right',
        });
    });
    y += rowH;
    if (opts.rowRules) {
      doc
        .moveTo(left, y - 2)
        .lineTo(left + width, y - 2)
        .strokeColor('#e5e7eb')
        .lineWidth(0.5)
        .stroke();
    }
  });

  return y + 8;
}

function drawTotalsBlock(
  ctx: LayoutCtx,
  y: number,
  opts: { style: 'classic' | 'minimal'; ink: string; accent: string; soft: string },
) {
  const { doc, data, margin, contentWidth, compact, bodySize, labelSize } = ctx;
  const totalsW = Math.min(contentWidth * 0.46, compact ? 150 : 220);
  const totalsX = margin + contentWidth - totalsW;
  const rows: Array<[string, string, boolean]> = [
    ['Subtotal', money(data.subtotal, data.currency), false],
    ['Discount', money(data.discountAmount, data.currency), false],
    ['Tax', money(data.taxAmount, data.currency), false],
    ['Total', money(data.totalAmount, data.currency), true],
  ];
  if (data.balanceDue != null) {
    rows.push(['Balance due', money(data.balanceDue, data.currency), true]);
  }

  if (opts.style === 'classic') {
    doc.rect(totalsX, y, totalsW, rows.length * (compact ? 14 : 17) + 10).strokeColor(opts.accent).lineWidth(1).stroke();
  }

  let ty = y + 6;
  rows.forEach(([label, value, bold]) => {
    if (bold && opts.style === 'minimal') {
      doc
        .moveTo(totalsX, ty - 2)
        .lineTo(totalsX + totalsW, ty - 2)
        .strokeColor(opts.ink)
        .lineWidth(0.8)
        .stroke();
      ty += 4;
    }
    doc
      .fillColor(bold ? opts.ink : '#6b7280')
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(bold ? bodySize : labelSize)
      .text(label, totalsX + 8, ty, { width: totalsW * 0.42 });
    doc.text(value, totalsX + totalsW * 0.42, ty, {
      width: totalsW * 0.52,
      align: 'right',
    });
    ty += compact ? 14 : 17;
  });
  return ty + 8;
}

/** Compact thermal / A12 receipt-style (shared structure, theme accents only) */
function drawCompact(ctx: LayoutCtx, theme: DocumentTheme) {
  const { doc, data, margin, contentWidth, bodySize, labelSize } = ctx;
  const accent =
    theme === 'CLASSIC' ? '#1a1a1a' : theme === 'MODERN' ? '#0d4f4a' : '#111827';

  if (theme === 'MODERN') {
    doc.rect(0, 0, ctx.size[0], 56).fill(accent);
  }

  tryLogo(doc, data.logo, margin, theme === 'MODERN' ? 10 : margin, 40, 28);
  doc
    .fillColor(theme === 'MODERN' ? '#ffffff' : accent)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(data.companyName, margin, theme === 'MODERN' ? 12 : margin, {
      width: contentWidth,
      align: 'center',
    });
  doc
    .font('Helvetica')
    .fontSize(8)
    .text(docKindLabel(data.kind), { align: 'center' });
  doc.text(data.number, { align: 'center' });

  let y = theme === 'MODERN' ? 68 : margin + 48;
  doc
    .fillColor('#111827')
    .fontSize(bodySize)
    .text(data.customer, margin, y, { width: contentWidth });
  doc
    .fillColor('#6b7280')
    .fontSize(labelSize)
    .text(`${iso(data.issuedOn)} · ${data.status}`, { width: contentWidth });
  if (data.paymentMethod) doc.text(`Pay: ${data.paymentMethod}`);
  y = doc.y + 8;

  data.lines.forEach((line) => {
    doc
      .fillColor('#111827')
      .fontSize(bodySize)
      .text(line.description, margin, y, { width: contentWidth * 0.62 });
    doc.text(money(line.totalAmount, data.currency), margin + contentWidth * 0.62, y, {
      width: contentWidth * 0.38,
      align: 'right',
    });
    doc
      .fillColor('#6b7280')
      .fontSize(labelSize)
      .text(`${line.quantity} × ${line.unitPrice}`, margin, doc.y, {
        width: contentWidth,
      });
    y = doc.y + 6;
  });

  doc
    .moveTo(margin, y)
    .lineTo(margin + contentWidth, y)
    .strokeColor(accent)
    .lineWidth(1)
    .stroke();
  y += 8;
  doc
    .fillColor('#111827')
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('TOTAL', margin, y);
  doc.text(money(data.totalAmount, data.currency), margin, y, {
    width: contentWidth,
    align: 'right',
  });
  if (data.balanceDue != null) {
    doc
      .font('Helvetica')
      .fontSize(labelSize)
      .text(`Balance ${money(data.balanceDue, data.currency)}`, margin, y + 16, {
        width: contentWidth,
        align: 'right',
      });
  }

  drawFooter(ctx);
}

export async function buildSalesDocumentPdf(
  data: SalesPdfData,
  theme: DocumentTheme,
  format: InvoiceFormat,
): Promise<Buffer> {
  const size = pageSize(format, data.lines.length);
  const margin = format === 'THERMAL' ? 14 : format === 'A12' ? 18 : 42;
  const doc = new PDFDocument({
    size,
    margin,
    bufferPages: true,
    info: {
      Title: `${data.kind} ${data.number}`,
      Author: data.companyName,
    },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const ctx: LayoutCtx = {
    doc,
    data,
    format,
    size,
    margin,
    contentWidth: size[0] - margin * 2,
    compact: format !== 'A4',
    titleSize: format !== 'A4' ? 11 : 18,
    bodySize: format !== 'A4' ? 7 : 9,
    labelSize: format !== 'A4' ? 6.5 : 8,
  };

  if (format !== 'A4') {
    drawCompact(ctx, theme);
  } else if (theme === 'CLASSIC') {
    drawClassic(ctx);
  } else if (theme === 'MINIMAL') {
    drawMinimal(ctx);
  } else {
    drawModern(ctx);
  }

  if (format === 'A4' && data.qrUrl) {
    if (theme === 'CLASSIC') {
      await drawQr(ctx, margin, size[1] - 120, 72, 'Scan for PDF copy');
    } else if (theme === 'MODERN') {
      await drawQr(ctx, margin + 6, size[1] - 130, 64, 'Scan for PDF copy');
    } else {
      await drawQr(ctx, margin, size[1] - 120, 56);
    }
  }

  doc.end();
  return done;
}
