"use server";

import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function page(companyId: string, segment: string) {
  return `/c/${companyId}/finance/${segment}`;
}

export async function createBankAccount(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/finance/bank-accounts`,
    body: {
      name: str(formData, "name"),
      accountType: str(formData, "accountType"),
      bankName: optStr(formData, "bankName"),
      iban: optStr(formData, "iban"),
      currency: optStr(formData, "currency") ?? "SAR",
    },
    pagePath: page(companyId, "accounts"),
    okMessage: "تم إنشاء الحساب",
  });
}

export async function createExpense(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/finance/expenses`,
    body: {
      expenseCategoryId: str(formData, "expenseCategoryId"),
      description: str(formData, "description"),
      amount: str(formData, "amount"),
      expenseDate: str(formData, "expenseDate"),
      currency: optStr(formData, "currency") ?? "SAR",
      bankAccountId: optStr(formData, "bankAccountId"),
      referenceNumber: optStr(formData, "referenceNumber"),
      status: str(formData, "status") || "APPROVED",
    },
    pagePath: page(companyId, "expenses"),
    okMessage: "تم تسجيل المصروف",
  });
}

export async function setExpenseStatus(
  companyId: string,
  expenseId: string,
  status: string,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/finance/expenses/${expenseId}/status`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, "expenses"),
    okMessage: `تم تحديث الحالة إلى ${status}`,
  });
}

export async function createTransaction(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/finance/transactions`,
    body: {
      transactionType: str(formData, "transactionType"),
      direction: str(formData, "direction"),
      amount: str(formData, "amount"),
      currency: optStr(formData, "currency") ?? "SAR",
      description: optStr(formData, "description"),
    },
    pagePath: page(companyId, "transactions"),
    okMessage: "تم تسجيل الحركة المالية",
  });
}

export async function createPaymentMethod(
  companyId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/payment-methods`,
    body: {
      code: optStr(formData, "code"),
      paymentGatewayId: optStr(formData, "paymentGatewayId"),
      name: optStr(formData, "name"),
    },
    pagePath: page(companyId, "payment-methods"),
    okMessage: "تم إضافة طريقة الدفع",
  });
}

export async function chargePaymentMethod(
  companyId: string,
  paymentMethodId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/payment-methods/${paymentMethodId}/charge`,
    body: {
      amount: str(formData, "amount"),
      currency: optStr(formData, "currency") ?? "SAR",
      description: optStr(formData, "description"),
      salesInvoiceId: optStr(formData, "salesInvoiceId"),
    },
    pagePath: page(companyId, "payment-methods"),
    okMessage: "تم تنفيذ طلب التحصيل",
  });
}
