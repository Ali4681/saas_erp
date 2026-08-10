"use server";

import { getTranslations } from "next-intl/server";
import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function page(companyId: string, segment: string) {
  return `/c/${companyId}/purchasing/${segment}`;
}

export async function createSupplier(companyId: string, formData: FormData) {
  const t = await getTranslations("purchasing");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/purchasing/suppliers`,
    body: {
      name: str(formData, "name"),
      code: optStr(formData, "code"),
      taxNumber: optStr(formData, "taxNumber"),
      email: optStr(formData, "email"),
      phone: optStr(formData, "phone"),
      notes: optStr(formData, "notes"),
    },
    pagePath: page(companyId, "suppliers"),
    okMessage: t("flash.supplierCreated"),
  });
}

export async function createPurchaseOrder(
  companyId: string,
  formData: FormData,
) {
  const t = await getTranslations("purchasing");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/purchasing/purchase-orders`,
    body: {
      supplierId: str(formData, "supplierId"),
      warehouseId: optStr(formData, "warehouseId"),
      orderedOn: optStr(formData, "orderedOn"),
      expectedOn: optStr(formData, "expectedOn"),
      currency: optStr(formData, "currency") ?? "SAR",
      items: [
        {
          itemId: str(formData, "itemId"),
          description: str(formData, "description"),
          quantity: str(formData, "quantity") || "1",
          unitCost: str(formData, "unitCost") || "0",
          taxAmount: optStr(formData, "taxAmount"),
        },
      ],
    },
    pagePath: page(companyId, "purchase-orders"),
    okMessage: t("flash.purchaseOrderCreated"),
  });
}

export async function receivePurchaseOrder(
  companyId: string,
  purchaseOrderId: string,
) {
  const t = await getTranslations("purchasing");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/purchasing/purchase-orders/${purchaseOrderId}/receive`,
    body: {},
    pagePath: page(companyId, "purchase-orders"),
    okMessage: t("flash.purchaseOrderReceived"),
  });
}

export async function setPoStatus(
  companyId: string,
  purchaseOrderId: string,
  status: string,
) {
  const t = await getTranslations("purchasing");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/purchasing/purchase-orders/${purchaseOrderId}/status`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, "purchase-orders"),
    okMessage: t("flash.statusUpdated", { status }),
  });
}

export async function createBill(companyId: string, formData: FormData) {
  const t = await getTranslations("purchasing");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/purchasing/bills`,
    body: {
      supplierId: str(formData, "supplierId"),
      billNumber: str(formData, "billNumber"),
      issuedOn: str(formData, "issuedOn"),
      dueOn: optStr(formData, "dueOn"),
      currency: optStr(formData, "currency") ?? "SAR",
      purchaseOrderId: optStr(formData, "purchaseOrderId"),
      status: str(formData, "status") || "ISSUED",
      items: [
        {
          description: str(formData, "description"),
          quantity: str(formData, "quantity") || "1",
          unitCost: str(formData, "unitCost") || "0",
          taxAmount: optStr(formData, "taxAmount"),
          itemId: optStr(formData, "itemId"),
        },
      ],
    },
    pagePath: page(companyId, "bills"),
    okMessage: t("flash.billCreated"),
  });
}

export async function upsertPurchaseOperatorEwallet(
  companyId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/ewallets`,
    body: {
      employeeId: str(formData, "employeeId"),
      walletCode: optStr(formData, "walletCode"),
      balance: optStr(formData, "balance"),
      currency: optStr(formData, "currency"),
    },
    pagePath: page(companyId, "operators"),
    okMessage: "Purchase operator wallet saved",
  });
}
