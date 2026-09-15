export type LineInput = {
  description: string;
  quantity: string | number;
  unitPrice?: string | number;
  unitCost?: string | number;
  discountAmount?: string | number;
  taxAmount?: string | number;
  itemId?: string;
};

export type ComputedLine = {
  description: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  itemId?: string;
  position: number;
};

export type ComputedDocumentTotals = {
  lines: ComputedLine[];
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function money2(n: number): string {
  return round2(n).toFixed(2);
}

export function computeLines(items: LineInput[]): ComputedDocumentTotals {
  if (!items.length) {
    throw new Error('At least one line item is required');
  }

  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let grand = 0;

  const lines = items.map((item, index) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice ?? item.unitCost ?? 0);
    const discountAmount = Number(item.discountAmount ?? 0);
    const taxAmount = Number(item.taxAmount ?? 0);
    if (!(quantity > 0)) {
      throw new Error(`Line ${index + 1}: quantity must be > 0`);
    }
    if (unitPrice < 0 || discountAmount < 0 || taxAmount < 0) {
      throw new Error(`Line ${index + 1}: amounts must be >= 0`);
    }
    const lineSub = quantity * unitPrice;
    const totalAmount = lineSub - discountAmount + taxAmount;
    if (totalAmount < 0) {
      throw new Error(`Line ${index + 1}: total cannot be negative`);
    }
    subtotal += lineSub;
    discountTotal += discountAmount;
    taxTotal += taxAmount;
    grand += totalAmount;
    return {
      description: item.description,
      quantity: quantity.toFixed(3),
      unitPrice: unitPrice.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      itemId: item.itemId,
      position: index + 1,
    };
  });

  return {
    lines,
    subtotal: subtotal.toFixed(2),
    discountAmount: discountTotal.toFixed(2),
    taxAmount: taxTotal.toFixed(2),
    totalAmount: grand.toFixed(2),
  };
}

/**
 * Apply a document-level discount on the net (ex-VAT) subtotal, allocate it
 * across lines, then recalculate VAT on the reduced taxable base.
 */
export function applyDocumentDiscount(
  computed: ComputedDocumentTotals,
  additionalDiscount: number,
): ComputedDocumentTotals {
  const requested = round2(Math.max(0, Number(additionalDiscount) || 0));
  if (!(requested > 0)) return computed;

  const subtotal = round2(Number(computed.subtotal));
  const existingDisc = round2(Number(computed.discountAmount));
  const toAllocate = Math.min(
    requested,
    Math.max(0, round2(subtotal - existingDisc)),
  );
  if (!(toAllocate > 0)) return computed;

  const lineCount = computed.lines.length;
  let allocated = 0;
  const lines = computed.lines.map((line, index) => {
    const qty = Number(line.quantity);
    const unit = Number(line.unitPrice);
    const lineNet = round2(qty * unit);
    const lineDisc0 = round2(Number(line.discountAmount));
    const share =
      index === lineCount - 1
        ? round2(toAllocate - allocated)
        : subtotal > 0
          ? round2(toAllocate * (lineNet / subtotal))
          : 0;
    allocated = round2(allocated + share);
    const lineDisc = round2(lineDisc0 + Math.max(0, share));
    const taxable0 = Math.max(0, round2(lineNet - lineDisc0));
    const taxable = Math.max(0, round2(lineNet - lineDisc));
    const rate = taxable0 > 0 ? Number(line.taxAmount) / taxable0 : 0;
    const taxAmount = round2(taxable * rate);
    const totalAmount = round2(taxable + taxAmount);
    return {
      ...line,
      discountAmount: money2(lineDisc),
      taxAmount: money2(taxAmount),
      totalAmount: money2(totalAmount),
    };
  });

  return {
    lines,
    subtotal: money2(subtotal),
    discountAmount: money2(existingDisc + toAllocate),
    taxAmount: money2(
      lines.reduce((sum, line) => sum + Number(line.taxAmount), 0),
    ),
    totalAmount: money2(
      lines.reduce((sum, line) => sum + Number(line.totalAmount), 0),
    ),
  };
}
