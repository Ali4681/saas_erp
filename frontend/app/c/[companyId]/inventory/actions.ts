"use server";

import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function page(companyId: string, segment: string) {
  return `/c/${companyId}/inventory/${segment}`;
}

export async function createItem(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/inventory/items`,
    body: {
      unitId: str(formData, "unitId"),
      name: str(formData, "name"),
      itemCategoryId: optStr(formData, "itemCategoryId"),
      parentItemId: optStr(formData, "parentItemId"),
      sku: optStr(formData, "sku"),
      barcode: optStr(formData, "barcode"),
      cost: optStr(formData, "cost"),
      salePrice: optStr(formData, "salePrice"),
      minStock: optStr(formData, "minStock"),
      taxRate: optStr(formData, "taxRate"),
    },
    pagePath: page(companyId, "items"),
    okMessage: "تم إنشاء الصنف",
  });
}

export async function createCategory(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/inventory/categories`,
    body: {
      name: str(formData, "name"),
      code: optStr(formData, "code"),
      parentId: optStr(formData, "parentId"),
      inheritedTaxRate: optStr(formData, "inheritedTaxRate")
        ? Number(optStr(formData, "inheritedTaxRate"))
        : undefined,
      abcClass: optStr(formData, "abcClass"),
    },
    pagePath: page(companyId, "categories"),
    okMessage: "Category created",
  });
}

export async function createWarehouse(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/inventory/warehouses`,
    body: {
      code: str(formData, "code"),
      name: str(formData, "name"),
      addressLine: optStr(formData, "addressLine"),
    },
    pagePath: page(companyId, "warehouses"),
    okMessage: "تم إنشاء المستودع",
  });
}

export async function createMovement(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/inventory/movements`,
    body: {
      warehouseId: str(formData, "warehouseId"),
      itemId: str(formData, "itemId"),
      movementType: str(formData, "movementType"),
      quantity: str(formData, "quantity"),
      unitCost: optStr(formData, "unitCost"),
      notes: optStr(formData, "notes"),
    },
    pagePath: page(companyId, "movements"),
    okMessage: "تم تسجيل الحركة",
  });
}

export async function createCount(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/inventory/counts`,
    body: {
      warehouseId: str(formData, "warehouseId"),
    },
    pagePath: page(companyId, "counts"),
    okMessage: "تم إنشاء جرد",
  });
}

export async function updateCountLine(
  companyId: string,
  stockCountId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/inventory/counts/${stockCountId}/lines`,
    method: "PATCH",
    body: {
      itemId: str(formData, "itemId"),
      countedQuantity: str(formData, "countedQuantity"),
    },
    pagePath: page(companyId, "counts"),
    okMessage: "تم تحديث بند الجرد",
  });
}

export async function approveCount(companyId: string, stockCountId: string) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/inventory/counts/${stockCountId}/approve`,
    body: {},
    pagePath: page(companyId, "counts"),
    okMessage: "تم اعتماد الجرد",
  });
}

export async function createTransfer(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/inventory/transfers`,
    body: {
      fromWarehouseId: str(formData, "fromWarehouseId"),
      toWarehouseId: str(formData, "toWarehouseId"),
      notes: optStr(formData, "notes"),
      items: [
        {
          itemId: str(formData, "itemId"),
          quantity: Number(str(formData, "quantity") || "1"),
        },
      ],
    },
    pagePath: page(companyId, "transfers"),
    okMessage: "Transfer created",
  });
}

export async function shipTransfer(companyId: string, transferId: string) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/inventory/transfers/${transferId}/ship`,
    body: {},
    pagePath: page(companyId, "transfers"),
    okMessage: "Transfer shipped",
  });
}

export async function receiveTransfer(companyId: string, transferId: string) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/inventory/transfers/${transferId}/receive`,
    body: {},
    pagePath: page(companyId, "transfers"),
    okMessage: "Transfer received",
  });
}

export async function createAdjustment(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/inventory/adjustments`,
    body: {
      warehouseId: str(formData, "warehouseId"),
      reasonCode: str(formData, "reasonCode"),
      notes: optStr(formData, "notes"),
      items: [
        {
          itemId: str(formData, "itemId"),
          quantityDelta: Number(str(formData, "quantityDelta") || "0"),
          unitCost: optStr(formData, "unitCost")
            ? Number(optStr(formData, "unitCost"))
            : undefined,
        },
      ],
    },
    pagePath: page(companyId, "adjustments"),
    okMessage: "Adjustment submitted",
  });
}

export async function approveAdjustment(companyId: string, adjustmentId: string) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/inventory/adjustments/${adjustmentId}/approve`,
    body: {},
    pagePath: page(companyId, "adjustments"),
    okMessage: "Adjustment approved",
  });
}

export async function generateBarcode(companyId: string, formData: FormData) {
  const barcodeType = optStr(formData, "barcodeType") ?? "RETAIL";
  const serialBased =
    formData.get("serialBased") === "on" || barcodeType === "SERIAL";
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/inventory/items/${str(formData, "itemId")}/barcodes`,
    body: {
      barcodeType,
      serialBased,
      uniquePerUnit: formData.get("serialMode") !== "shared",
      quantity: serialBased ? Number(str(formData, "quantity") || "1") : 1,
    },
    pagePath: page(companyId, "barcodes"),
    okMessage: "تم توليد الباركود",
  });
}

export async function bulkImportItems(companyId: string, formData: FormData) {
  const raw = str(formData, "csv");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const rows = lines.slice(1).map((line) => {
    const [name, unitCode, sku, barcode, categoryCode, cost, salePrice, taxRate, minStock] =
      line.split(",").map((c) => c.trim());
    return {
      name,
      unitCode,
      sku: sku || undefined,
      barcode: barcode || undefined,
      categoryCode: categoryCode || undefined,
      cost: cost ? Number(cost) : undefined,
      salePrice: salePrice ? Number(salePrice) : undefined,
      taxRate: taxRate ? Number(taxRate) : undefined,
      minStock: minStock ? Number(minStock) : undefined,
    };
  });
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/inventory/items/bulk-import`,
    body: { rows },
    pagePath: page(companyId, "import"),
    okMessage: "Bulk import finished",
  });
}

export async function ensureTemplates(companyId: string) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/inventory/templates/ensure`,
    body: {},
    pagePath: page(companyId, "labels"),
    okMessage: "Templates ready",
  });
}

export async function updateCategoryInheritance(
  companyId: string,
  categoryId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/inventory/categories/${categoryId}/inheritance`,
    method: "PATCH",
    body: {
      inheritedTaxRate: optStr(formData, "inheritedTaxRate")
        ? Number(optStr(formData, "inheritedTaxRate"))
        : null,
      abcClass: optStr(formData, "abcClass"),
      shelfLifeDaysAlert: optStr(formData, "shelfLifeDaysAlert")
        ? Number(optStr(formData, "shelfLifeDaysAlert"))
        : null,
    },
    pagePath: page(companyId, "categories"),
    okMessage: "Category inheritance updated",
  });
}
