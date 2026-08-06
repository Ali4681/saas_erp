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

export function computeLines(items: LineInput[]): {
  lines: ComputedLine[];
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
} {
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
