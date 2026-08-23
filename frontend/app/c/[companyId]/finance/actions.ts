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

export async function openDailyClosing(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/finance/daily-closings`,
    body: {
      closingDate: str(formData, "closingDate"),
      openingCash: optStr(formData, "openingCash"),
      companyBranchId: optStr(formData, "companyBranchId"),
      currency: optStr(formData, "currency") ?? "SAR",
      notes: optStr(formData, "notes"),
    },
    pagePath: page(companyId, "daily-closing"),
    okMessage: "Daily closing opened",
  });
}

export async function closeDailyClosing(
  companyId: string,
  closingId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/finance/daily-closings/${closingId}/close`,
    body: {
      countedCash: str(formData, "countedCash"),
      notes: optStr(formData, "notes"),
    },
    pagePath: page(companyId, "daily-closing"),
    okMessage: "Daily closing closed",
  });
}

export async function openCashierShift(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/finance/cashier-shifts`,
    body: {
      employeeId: str(formData, "employeeId"),
      openingFloat: optStr(formData, "openingFloat") ?? "0",
      workShiftId: optStr(formData, "workShiftId"),
      currency: "SAR",
      notes: optStr(formData, "notes"),
    },
    pagePath: page(companyId, "cashier-shifts"),
    okMessage: "Cashier shift opened",
  });
}

export async function closeCashierShift(
  companyId: string,
  sessionId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/finance/cashier-shifts/${sessionId}/close`,
    body: {
      countedCash: str(formData, "countedCash"),
      cashSales: optStr(formData, "cashSales"),
      cardSales: optStr(formData, "cardSales"),
      transferSales: optStr(formData, "transferSales"),
      pettyExpenses: optStr(formData, "pettyExpenses"),
      notes: optStr(formData, "notes"),
    },
    pagePath: page(companyId, "cashier-shifts"),
    okMessage: "Z-Report posted",
  });
}

export async function approveCashierShift(
  companyId: string,
  sessionId: string,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/finance/cashier-shifts/${sessionId}/approve`,
    method: "POST",
    body: {},
    pagePath: page(companyId, "cashier-shifts"),
    okMessage: "Shift approved",
  });
}

const MAPPING_CODE_FIELDS = [
  "salesRevenueCode",
  "salesVatPayableCode",
  "salesCashPosCode",
  "salesCardBankCode",
  "inventoryGoodsCode",
  "inventoryInTransitCode",
  "inventoryShrinkageCode",
  "apLocalCode",
  "apInternationalCode",
  "importLandingCostCode",
  "cogsCode",
  "corporateWalletCode",
  "employeeAdvanceCode",
  "pettyCashExpenseCode",
  "mainTreasuryCode",
] as const;

export async function ensureChartOfAccounts(companyId: string) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/finance/chart-of-accounts/ensure`,
    method: "POST",
    body: {},
    pagePath: page(companyId, "chart-of-accounts"),
    okMessage: "Chart of accounts installed",
  });
}

export async function saveAccountMapping(companyId: string, formData: FormData) {
  const body: Record<string, string> = {};
  for (const key of MAPPING_CODE_FIELDS) {
    const value = optStr(formData, key);
    if (value) body[key] = value;
  }
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/finance/account-mapping`,
    method: "PUT",
    body,
    pagePath: page(companyId, "account-mapping"),
    okMessage: "Account mapping saved",
  });
}
