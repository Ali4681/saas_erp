"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { ApiError } from "@/lib/api/client";
import { apiServer } from "@/lib/api/server";
import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function page(companyId: string, segment: string) {
  return `/c/${companyId}/sales/${segment}`;
}

export async function createContactInline(
  companyId: string,
  formData: FormData,
): Promise<
  | { ok: true; contact: { id: string; name: string } }
  | { ok: false; error: string }
> {
  try {
    const contact = await apiServer<{ id: string; name: string }>(
      `/companies/${companyId}/crm/contacts`,
      {
        method: "POST",
        companyId,
        body: JSON.stringify({
          contactType: str(formData, "contactType") || "CUSTOMER",
          customerTrack: str(formData, "customerTrack") || "B2C",
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
        }),
      },
    );
    revalidatePath(page(companyId, "quotes"));
    revalidatePath(page(companyId, "invoices"));
    revalidatePath(`/c/${companyId}/crm/contacts`);
    return { ok: true, contact: { id: contact.id, name: contact.name } };
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "Failed to create customer";
    return { ok: false, error: message };
  }
}

export async function createQuote(companyId: string, formData: FormData) {
  const t = await getTranslations("sales");
  const issuedOn =
    str(formData, "issuedOn") || new Date().toISOString().slice(0, 10);
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
          taxAmount: optStr(formData, "taxAmount") ?? "0",
        },
      ],
    },
    pagePath: page(companyId, "quotes"),
    okMessage: t("flash.quoteCreated"),
  });
}

export async function updateQuote(
  companyId: string,
  quoteId: string,
  formData: FormData,
) {
  const t = await getTranslations("sales");
  const issuedOn =
    str(formData, "issuedOn") || new Date().toISOString().slice(0, 10);
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/quotes/${quoteId}`,
    method: "PATCH",
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
          taxAmount: optStr(formData, "taxAmount") ?? "0",
        },
      ],
    },
    pagePath: page(companyId, "quotes"),
    okMessage: t("flash.quoteUpdated"),
  });
}

export async function deleteQuote(companyId: string, quoteId: string) {
  const t = await getTranslations("sales");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/quotes/${quoteId}/status`,
    method: "PATCH",
    body: { status: "CANCELLED" },
    pagePath: page(companyId, "quotes"),
    okMessage: t("flash.quoteDeleted"),
  });
}

export async function updateQuoteStatus(
  companyId: string,
  quoteId: string,
  status: "APPROVED" | "SENT" | "ACCEPTED",
) {
  const t = await getTranslations("sales");
  const okMessage =
    status === "APPROVED"
      ? t("flash.quoteApproved")
      : status === "SENT"
        ? t("flash.quoteSent")
        : t("flash.quoteAccepted");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/quotes/${quoteId}/status`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, "quotes"),
    okMessage,
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
  const issuedOn =
    str(formData, "issuedOn") || new Date().toISOString().slice(0, 10);
  const paymentMethod = optStr(formData, "paymentMethod") ?? "CASH";
  const split1Method = optStr(formData, "paymentSplit1Method");
  const split1Amount = optStr(formData, "paymentSplit1Amount");
  const split2Method = optStr(formData, "paymentSplit2Method");
  const split2Amount = optStr(formData, "paymentSplit2Amount");
  const paymentSplits =
    paymentMethod === "MIXED" &&
    split1Method &&
    split1Amount &&
    split2Method &&
    split2Amount
      ? [
          { method: split1Method, amount: split1Amount },
          { method: split2Method, amount: split2Amount },
        ]
      : undefined;

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
      paymentMethod,
      paymentSplits,
      pointOfSaleId: optStr(formData, "pointOfSaleId"),
      posCashierId: optStr(formData, "posCashierId"),
      items: [
        {
          description: str(formData, "description"),
          quantity: str(formData, "quantity") || "1",
          unitPrice: str(formData, "unitPrice") || "0",
          taxAmount: optStr(formData, "taxAmount") ?? "0",
        },
      ],
    },
    pagePath: page(companyId, "invoices"),
    okMessage: t("flash.invoiceCreated"),
  });
}

export async function issueHeldInvoice(companyId: string, invoiceId: string, formData: FormData) {
  const t = await getTranslations("sales");
  const paymentMethod = optStr(formData, "paymentMethod") ?? "CASH";
  const split1Method = optStr(formData, "paymentSplit1Method");
  const split1Amount = optStr(formData, "paymentSplit1Amount");
  const split2Method = optStr(formData, "paymentSplit2Method");
  const split2Amount = optStr(formData, "paymentSplit2Amount");
  const paymentSplits =
    paymentMethod === "MIXED" &&
    split1Method &&
    split1Amount &&
    split2Method &&
    split2Amount
      ? [
          { method: split1Method, amount: split1Amount },
          { method: split2Method, amount: split2Amount },
        ]
      : undefined;

  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/invoices/${invoiceId}/issue`,
    body: {
      paymentMethod,
      paymentSplits,
      dueOn: optStr(formData, "dueOn"),
    },
    pagePath: page(companyId, "invoices"),
    okMessage: t("flash.invoiceIssued"),
  });
}

export async function updateInvoice(
  companyId: string,
  invoiceId: string,
  formData: FormData,
) {
  const t = await getTranslations("sales");
  const issuedOn =
    str(formData, "issuedOn") || new Date().toISOString().slice(0, 10);
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/invoices/${invoiceId}`,
    method: "PATCH",
    body: {
      contactId: str(formData, "contactId"),
      issuedOn,
      dueOn: optStr(formData, "dueOn"),
      currency: optStr(formData, "currency") ?? "SAR",
      saleChannel: optStr(formData, "saleChannel") ?? "POS",
      items: [
        {
          description: str(formData, "description"),
          quantity: str(formData, "quantity") || "1",
          unitPrice: str(formData, "unitPrice") || "0",
          taxAmount: optStr(formData, "taxAmount") ?? "0",
        },
      ],
    },
    pagePath: page(companyId, "invoices"),
    okMessage: t("flash.invoiceUpdated"),
  });
}

export async function deleteInvoice(companyId: string, invoiceId: string) {
  const t = await getTranslations("sales");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/invoices/${invoiceId}/cancel`,
    body: {},
    pagePath: page(companyId, "invoices"),
    okMessage: t("flash.invoiceDeleted"),
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

export async function updateCreditNote(
  companyId: string,
  creditNoteId: string,
  formData: FormData,
) {
  const t = await getTranslations("sales");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/credit-notes/${creditNoteId}`,
    method: "PATCH",
    body: {
      reason: optStr(formData, "reason"),
      issuedOn: optStr(formData, "issuedOn"),
      items: [
        {
          description: str(formData, "description"),
          quantity: str(formData, "quantity") || "1",
          amount: str(formData, "amount") || "0",
        },
      ],
    },
    pagePath: page(companyId, "credit-notes"),
    okMessage: t("flash.creditNoteUpdated"),
  });
}

export async function deleteCreditNote(companyId: string, creditNoteId: string) {
  const t = await getTranslations("sales");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/sales/credit-notes/${creditNoteId}/cancel`,
    body: {},
    pagePath: page(companyId, "credit-notes"),
    okMessage: t("flash.creditNoteDeleted"),
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
