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
