"use server";

import { getTranslations } from "next-intl/server";
import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function page(companyId: string, segment: string) {
  return `/c/${companyId}/crm/${segment}`;
}

export async function createContact(companyId: string, formData: FormData) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/contacts`,
    body: {
      contactType: str(formData, "contactType"),
      name: str(formData, "name"),
      companyName: optStr(formData, "companyName"),
      email: optStr(formData, "email"),
      phone: optStr(formData, "phone"),
      source: optStr(formData, "source"),
      notes: optStr(formData, "notes"),
    },
    pagePath: page(companyId, "contacts"),
    okMessage: t("flash.contactCreated"),
  });
}

export async function createOpportunity(companyId: string, formData: FormData) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/opportunities`,
    body: {
      contactId: str(formData, "contactId"),
      title: str(formData, "title"),
      estimatedValue: optStr(formData, "estimatedValue"),
      currency: optStr(formData, "currency") ?? "SAR",
      expectedCloseDate: optStr(formData, "expectedCloseDate"),
    },
    pagePath: page(companyId, "opportunities"),
    okMessage: t("flash.opportunityCreated"),
  });
}

export async function setOpportunityStatus(
  companyId: string,
  opportunityId: string,
  status: string,
) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/opportunities/${opportunityId}/status`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, "opportunities"),
    okMessage: t("flash.statusUpdated", { status }),
  });
}

export async function createActivity(companyId: string, formData: FormData) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/activities`,
    body: {
      activityType: str(formData, "activityType"),
      subject: str(formData, "subject"),
      notes: optStr(formData, "notes"),
      contactId: optStr(formData, "contactId"),
      opportunityId: optStr(formData, "opportunityId"),
      scheduledAt: optStr(formData, "scheduledAt"),
    },
    pagePath: page(companyId, "activities"),
    okMessage: t("flash.activityCreated"),
  });
}

export async function setActivityStatus(
  companyId: string,
  activityId: string,
  status: string,
) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/activities/${activityId}/status`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, "activities"),
    okMessage: t("flash.statusUpdated", { status }),
  });
}

export async function createContract(companyId: string, formData: FormData) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/contracts`,
    body: {
      contactId: str(formData, "contactId"),
      title: str(formData, "title"),
      opportunityId: optStr(formData, "opportunityId"),
      startsOn: optStr(formData, "startsOn"),
      endsOn: optStr(formData, "endsOn"),
      value: optStr(formData, "value"),
      currency: optStr(formData, "currency") ?? "SAR",
      notes: optStr(formData, "notes"),
    },
    pagePath: page(companyId, "contracts"),
    okMessage: t("flash.contractCreated"),
  });
}

export async function setContractStatus(
  companyId: string,
  contractId: string,
  status: string,
) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/contracts/${contractId}/status`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, "contracts"),
    okMessage: t("flash.statusUpdated", { status }),
  });
}
