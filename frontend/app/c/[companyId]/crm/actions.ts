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
      customerTrack: str(formData, "customerTrack"),
      name: str(formData, "name"),
      companyName: optStr(formData, "companyName"),
      email: optStr(formData, "email"),
      phone: optStr(formData, "phone"),
      taxNumber: optStr(formData, "taxNumber"),
      companyRegNumber: optStr(formData, "companyRegNumber"),
      creditLimit: optStr(formData, "creditLimit"),
      creditTermsDays: optStr(formData, "creditTermsDays"),
      dateOfBirth: optStr(formData, "dateOfBirth"),
      notes: optStr(formData, "notes"),
    },
    pagePath: page(companyId, "contacts"),
    okMessage: t("flash.contactCreated"),
  });
}

export async function updateContact(companyId: string, contactId: string, formData: FormData) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/contacts/${contactId}`,
    method: "PATCH",
    body: {
      contactType: optStr(formData, "contactType"),
      customerTrack: optStr(formData, "customerTrack"),
      name: str(formData, "name"),
      companyName: optStr(formData, "companyName"),
      email: optStr(formData, "email"),
      phone: optStr(formData, "phone"),
      taxNumber: optStr(formData, "taxNumber"),
      companyRegNumber: optStr(formData, "companyRegNumber"),
      creditLimit: optStr(formData, "creditLimit"),
      creditTermsDays: optStr(formData, "creditTermsDays"),
      dateOfBirth: optStr(formData, "dateOfBirth"),
      notes: optStr(formData, "notes"),
      status: optStr(formData, "status"),
    },
    pagePath: page(companyId, "contacts"),
    okMessage: t("flash.contactUpdated"),
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
      contractType: optStr(formData, "contractType"),
      autoRenew: optStr(formData, "autoRenew") === "true",
      priceListId: optStr(formData, "priceListId"),
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

export async function renewContract(companyId: string, contractId: string) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/contracts/${contractId}/renew`,
    method: "POST",
    body: {},
    pagePath: page(companyId, "contracts"),
    okMessage: t("flash.contractRenewed"),
  });
}

export async function earnLoyaltyPoints(
  companyId: string,
  contactId: string,
  formData: FormData,
) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/contacts/${contactId}/loyalty/earn`,
    method: "POST",
    body: {
      points: Number(str(formData, "points")),
      note: optStr(formData, "note"),
    },
    pagePath: page(companyId, `contacts/${contactId}/loyalty`),
    okMessage: t("flash.pointsEarned"),
  });
}

export async function requestLoyaltyOtp(companyId: string, contactId: string) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/contacts/${contactId}/otp`,
    method: "POST",
    body: { purpose: "LOYALTY_REDEEM" },
    pagePath: page(companyId, `contacts/${contactId}/loyalty`),
    okMessage: t("flash.otpSent"),
  });
}

export async function redeemLoyaltyPoints(
  companyId: string,
  contactId: string,
  formData: FormData,
) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/contacts/${contactId}/loyalty/redeem`,
    method: "POST",
    body: {
      points: Number(str(formData, "points")),
      otpCode: optStr(formData, "otpCode"),
      note: optStr(formData, "note"),
    },
    pagePath: page(companyId, `contacts/${contactId}/loyalty`),
    okMessage: t("flash.pointsRedeemed"),
  });
}

export async function creditStoreWallet(
  companyId: string,
  contactId: string,
  formData: FormData,
) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/contacts/${contactId}/store-credit/credit`,
    method: "POST",
    body: {
      amount: Number(str(formData, "amount")),
      note: optStr(formData, "note"),
    },
    pagePath: page(companyId, `contacts/${contactId}/store-credit`),
    okMessage: t("flash.storeCreditAdded"),
  });
}

export async function debitStoreWallet(
  companyId: string,
  contactId: string,
  formData: FormData,
) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/contacts/${contactId}/store-credit/debit`,
    method: "POST",
    body: {
      amount: Number(str(formData, "amount")),
      note: optStr(formData, "note"),
    },
    pagePath: page(companyId, `contacts/${contactId}/store-credit`),
    okMessage: t("flash.storeCreditUsed"),
  });
}

export async function createPriceList(companyId: string, formData: FormData) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/pricing/price-lists`,
    body: {
      name: str(formData, "name"),
      listType: optStr(formData, "listType") ?? "RETAIL",
      currency: optStr(formData, "currency") ?? "SAR",
      notes: optStr(formData, "notes"),
    },
    pagePath: page(companyId, "pricing/price-lists"),
    okMessage: t("flash.priceListCreated"),
  });
}

export async function createCoupon(companyId: string, formData: FormData) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/pricing/coupons`,
    body: {
      code: str(formData, "code"),
      couponType: optStr(formData, "couponType") ?? "PERCENT",
      discountValue: Number(str(formData, "discountValue")),
      maxUsages: optStr(formData, "maxUsages") ? Number(optStr(formData, "maxUsages")) : null,
      validFrom: optStr(formData, "validFrom"),
      validTo: optStr(formData, "validTo"),
      notes: optStr(formData, "notes"),
    },
    pagePath: page(companyId, "pricing/coupons"),
    okMessage: t("flash.couponCreated"),
  });
}

export async function createBundle(companyId: string, formData: FormData) {
  const t = await getTranslations("crm");
  const items = [
    { itemId: str(formData, "itemId"), quantity: Number(str(formData, "quantity") || "1") },
  ];
  const itemId2 = optStr(formData, "itemId2");
  if (itemId2) {
    items.push({
      itemId: itemId2,
      quantity: Number(str(formData, "quantity2") || "1"),
    });
  }
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/pricing/bundles`,
    body: {
      name: str(formData, "name"),
      sku: optStr(formData, "sku"),
      bundlePrice: Number(str(formData, "bundlePrice")),
      items,
    },
    pagePath: page(companyId, "pricing/bundles"),
    okMessage: t("flash.bundleCreated"),
  });
}

export async function createTicket(companyId: string, formData: FormData) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/tickets`,
    body: {
      contactId: str(formData, "contactId"),
      subject: str(formData, "subject"),
      priority: optStr(formData, "priority") ?? "NORMAL",
      description: optStr(formData, "description"),
      slaDeadline: optStr(formData, "slaDeadline"),
      ticketKind: optStr(formData, "ticketKind") ?? "SUPPORT",
      itemId: optStr(formData, "itemId"),
      invoiceId: optStr(formData, "invoiceId"),
      warrantyExpiresOn: optStr(formData, "warrantyExpiresOn"),
    },
    pagePath: page(companyId, "tickets"),
    okMessage: t("flash.ticketCreated"),
  });
}

export async function setTicketStatus(
  companyId: string,
  ticketId: string,
  status: string,
) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/tickets/${ticketId}/status`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, "tickets"),
    okMessage: t("flash.statusUpdated", { status }),
  });
}

export async function saveCrmOpsSettings(companyId: string, formData: FormData) {
  const t = await getTranslations("crm");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/crm/ops-settings`,
    method: "PATCH",
    body: {
      loyalty: {
        b2cRatePct: Number(str(formData, "b2cRatePct") || "1"),
        b2bRatePct: Number(str(formData, "b2bRatePct") || "0.5"),
        birthdayBonus: Number(str(formData, "birthdayBonus") || "50"),
        otpRequired: formData.get("otpRequired") === "on",
      },
      pos: {
        maxDiscountPct: Number(str(formData, "maxDiscountPct") || "5"),
        overrideCode: str(formData, "overrideCode") || "0000",
      },
      zatca: {
        sellerName: optStr(formData, "sellerName") ?? "",
        vatNumber: optStr(formData, "vatNumber") ?? "",
      },
    },
    pagePath: page(companyId, "ops-settings"),
    okMessage: t("contacts.save"),
  });
}
