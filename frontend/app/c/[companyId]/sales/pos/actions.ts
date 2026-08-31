"use server";

import { getTranslations } from "next-intl/server";
import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function page(companyId: string) {
  return `/c/${companyId}/sales/pos`;
}

export async function createPointOfSale(companyId: string, formData: FormData) {
  const t = await getTranslations("sales");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/pos`,
    body: {
      code: str(formData, "code"),
      name: str(formData, "name"),
      companyBranchId: optStr(formData, "companyBranchId"),
      locationNote: optStr(formData, "locationNote"),
    },
    pagePath: page(companyId),
    okMessage: t("pos.flashCreated"),
  });
}

export async function updatePointOfSale(
  companyId: string,
  posId: string,
  formData: FormData,
) {
  const t = await getTranslations("sales");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/pos/${posId}`,
    method: "PATCH",
    body: {
      name: optStr(formData, "name"),
      companyBranchId: optStr(formData, "companyBranchId") || null,
      locationNote: optStr(formData, "locationNote"),
      status: optStr(formData, "status"),
    },
    pagePath: page(companyId),
    okMessage: t("pos.flashUpdated"),
  });
}

export async function addPosCashier(
  companyId: string,
  posId: string,
  formData: FormData,
) {
  const t = await getTranslations("sales");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/pos/${posId}/cashiers`,
    body: {
      employeeId: str(formData, "employeeId"),
      displayName: optStr(formData, "displayName"),
    },
    pagePath: page(companyId),
    okMessage: t("pos.flashCashierAdded"),
  });
}

export async function deactivatePosCashier(
  companyId: string,
  cashierId: string,
) {
  const t = await getTranslations("sales");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/pos/cashiers/${cashierId}/deactivate`,
    body: {},
    pagePath: page(companyId),
    okMessage: t("pos.flashCashierRemoved"),
  });
}
