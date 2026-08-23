"use server";

import { getTranslations } from "next-intl/server";
import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function page(companyId: string, segment: string) {
  return `/c/${companyId}/sales/${segment}`;
}

export async function createQuote(companyId: string, formData: FormData) {
  const t = await getTranslations("sales");
  const issuedOn = str(formData, "issuedOn") || new Date().toISOString().slice(0, 10);
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/quotes`,
    body: {
      contactId: str(formData, "contactId"),
      issuedOn,
      expiresOn: optStr(formData, "expiresOn"),
      currency: optStr(formData, "currency") ?? "SAR",
      items: [
        {
          description: str(formData, "description"),
          quantity: str(formData, "quantity") || "1",
          unitPrice: str(formData, "unitPrice") || "0",
          taxAmount: optStr(formData, "taxAmount"),
        },
      ],
    },
    pagePath: page(companyId, "quotes"),
    okMessage: t("flash.quoteCreated"),
  });
}

export async function convertQuote(companyId: string, quoteId: string) {
  const t = await getTranslations("sales");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/quotes/${quoteId}/convert`,
    body: {},
    pagePath: page(companyId, "quotes"),
    okMessage: t("flash.quoteConverted"),
  });
}

export async function createInvoice(companyId: string, formData: FormData) {
  const t = await getTranslations("sales");
  const issuedOn = str(formData, "issuedOn") || new Date().toISOString().slice(0, 10);
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/invoices`,
    body: {
      contactId: str(formData, "contactId"),
      issuedOn,
      dueOn: optStr(formData, "dueOn"),
      currency: optStr(formData, "currency") ?? "SAR",
      status: str(formData, "status") || "ISSUED",
      saleChannel: optStr(formData, "saleChannel") ?? "POS",
      couponCode: optStr(formData, "couponCode"),
      priceListId: optStr(formData, "priceListId"),
      storeCreditAmount: optStr(formData, "storeCreditAmount"),
      extraDiscountPct: optStr(formData, "extraDiscountPct")
        ? Number(optStr(formData, "extraDiscountPct"))
        : undefined,
      overrideCode: optStr(formData, "overrideCode"),
      items: [
        {
          description: str(formData, "description"),
          quantity: str(formData, "quantity") || "1",
          unitPrice: str(formData, "unitPrice") || "0",
          taxAmount: optStr(formData, "taxAmount"),
          itemId: optStr(formData, "itemId"),
          bundleId: optStr(formData, "bundleId"),
        },
      ],
    },
    pagePath: page(companyId, "invoices"),
    okMessage: t("flash.invoiceCreated"),
  });
}

export async function recordPayment(companyId: string, formData: FormData) {
  const t = await getTranslations("sales");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/payments`,
    body: {
      salesInvoiceId: str(formData, "salesInvoiceId"),
      amount: str(formData, "amount"),
      method: str(formData, "method"),
      bankAccountId: optStr(formData, "bankAccountId"),
      externalReference: optStr(formData, "externalReference"),
    },
    pagePath: page(companyId, "invoices"),
    okMessage: t("flash.paymentRecorded"),
  });
}

export async function createCreditNote(companyId: string, formData: FormData) {
  const t = await getTranslations("sales");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/credit-notes`,
    body: {
      salesInvoiceId: str(formData, "salesInvoiceId"),
      reason: optStr(formData, "reason"),
      issuedOn: optStr(formData, "issuedOn"),
      toStoreCredit: optStr(formData, "toStoreCredit") !== "false",
      items: [
        {
          description: str(formData, "description"),
          quantity: str(formData, "quantity") || "1",
          amount: str(formData, "amount") || "0",
        },
      ],
    },
    pagePath: page(companyId, "credit-notes"),
    okMessage: t("flash.creditNoteCreated"),
  });
}

export async function createCustomerPo(companyId: string, formData: FormData) {
  const t = await getTranslations("sales");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/customer-pos`,
    body: {
      contactId: str(formData, "contactId"),
      poNumber: str(formData, "poNumber"),
      items: [
        {
          description: str(formData, "description"),
          quantity: str(formData, "quantity") || "1",
          unitPrice: str(formData, "unitPrice") || "0",
        },
      ],
    },
    pagePath: page(companyId, "customer-pos"),
    okMessage: t("flash.customerPoCreated"),
  });
}

export async function convertCustomerPo(companyId: string, poId: string) {
  const t = await getTranslations("sales");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/customer-pos/${poId}/convert`,
    body: {},
    pagePath: page(companyId, "customer-pos"),
    okMessage: t("flash.customerPoConverted"),
  });
}

export async function ingestChannelOrder(companyId: string, formData: FormData) {
  const t = await getTranslations("sales");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/channel-orders`,
    body: {
      provider: str(formData, "provider"),
      externalOrderId: str(formData, "externalOrderId"),
      saleChannel: str(formData, "saleChannel") || "ECOMMERCE",
      contactPhone: optStr(formData, "contactPhone"),
      contactName: optStr(formData, "contactName"),
      commissionAmount: optStr(formData, "commissionAmount")
        ? Number(optStr(formData, "commissionAmount"))
        : 0,
      items: [
        {
          description: str(formData, "description"),
          quantity: str(formData, "quantity") || "1",
          unitPrice: str(formData, "unitPrice") || "0",
          itemId: optStr(formData, "itemId"),
        },
      ],
    },
    pagePath: page(companyId, "channels"),
    okMessage: t("flash.channelOrderIngested"),
  });
}
