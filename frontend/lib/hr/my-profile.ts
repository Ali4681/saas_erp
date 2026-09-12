import { apiServer } from "@/lib/api/server";

export type MyProfile = {
  id: string;
  fullName: string;
  employeeNumber: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  hireDate?: string | null;
  employmentCategory?: string | null;
  trialStartsOn?: string | null;
  trialEndsOn?: string | null;
  identityType?: string | null;
  identityNumber?: string | null;
  identityExpiresOn?: string | null;
  identityAttachmentId?: string | null;
  insuranceAttachmentId?: string | null;
  workContractAttachmentId?: string | null;
  attendanceBadgeId?: string | null;
  approvalStatus?: string | null;
  basicSalary: string | null;
  currency: string;
  employmentStatus: string;
  ibanLast4?: string | null;
  hasIban?: boolean;
  salesTargetAmount?: string | null;
  targetCompletedPercent?: string | null;
  advanceAllowancePercent?: string | null;
  ewallet?: { balance: string; currency: string; walletCode?: string } | null;
  ewalletTransactions?: Array<{
    id: string;
    kind: "CREDIT" | "DEBIT";
    source:
      | "ADVANCE"
      | "MANUAL"
      | "OPENING"
      | "PURCHASE"
      | "DEDUCTION"
      | "ADVANCE_REPAY"
      | "WALLET_WITHDRAW";
    amount: string;
    balanceAfter: string;
    memo: string | null;
    createdAt: string;
  }>;
  advanceEarnings?: {
    month: string;
    daysWorked: number;
    earnedAmount: string;
    advanceAllowancePercent: string | null;
    maxAdvanceAmount: string;
    advancesUsed: string;
    remainingAdvance: string;
  };
  salesProgress?: {
    month: string;
    salesTargetAmount: string | null;
    approvedSalesSum: string;
    targetCompletedPercent: string;
    overTarget: boolean;
  };
  shiftAssignments?: Array<{
    id: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
    shift?: { name: string; startTime?: string | null; endTime?: string | null };
  }>;
  salaryAdvances?: {
    id: string;
    amount: string;
    currency: string;
    status: string;
    requestedAt: string;
  }[];
  walletWithdrawals?: {
    id: string;
    amount: string;
    currency: string;
    status: string;
    reason: string | null;
    requestedAt: string;
  }[];
  leaveRequests?: {
    id: string;
    leaveType: string;
    status: string;
    startsOn: string;
    endsOn: string;
    requestedDays: string | number;
  }[];
};

export type MySale = {
  id: string;
  saleDate: string;
  amount: string;
  paymentMethod: string;
  invoiceNumber?: string | null;
  status: string;
};

export type MyAttendanceRecord = {
  id: string;
  attendanceDate: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workedMinutes: number | null;
  notes: string | null;
};

export type MyPersonalReport = {
  period: { from: string; to: string };
  attendance: MyAttendanceRecord[];
  leaves: Array<{
    id: string;
    leaveType: string;
    status: string;
    startsOn: string;
    endsOn: string;
    requestedDays: string | number;
  }>;
  advances: Array<{
    id: string;
    amount: string;
    currency: string;
    status: string;
    requestedAt: string;
  }>;
  sales: Array<{
    id: string;
    saleDate: string;
    amount: string;
    paymentMethod: string;
    status: string;
  }>;
};

export async function fetchMyProfile(companyId: string) {
  return apiServer<MyProfile>(`/companies/${companyId}/hr/me`, {
    companyId,
  }).catch(() => null);
}

export async function fetchMySales(companyId: string) {
  return apiServer<MySale[]>(`/companies/${companyId}/hr/me/sales`, {
    companyId,
  }).catch(() => []);
}

export async function fetchMyReport(
  companyId: string,
  from: string,
  to: string,
) {
  return apiServer<MyPersonalReport>(
    `/companies/${companyId}/hr/me/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { companyId },
  ).catch(() => null);
}
