"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ApiError } from "@/lib/api/client";
import { apiServer } from "@/lib/api/server";
import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";
import { parsePhoneFromForm } from "@/lib/phone";

function page(companyId: string, segment: string) {
  return `/c/${companyId}/hr/${segment}`;
}

function employeePortalPage(companyId: string, segment?: string) {
  const base = `/c/${companyId}/me`;
  return segment ? `${base}/${segment}` : base;
}

async function hrT() {
  return getTranslations("hr");
}

async function commonT() {
  return getTranslations("common");
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeSaudiId(raw: string): string {
  return raw
    .replace(/[\s-]+/g, "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function normalizeSaudiIban(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const n = raw.replace(/[\s-]+/g, "").toUpperCase();
  return n || undefined;
}

function flashPath(pagePath: string, key: "ok" | "error", message: string) {
  const sep = pagePath.includes("?") ? "&" : "?";
  return `${pagePath}${sep}${key}=${encodeURIComponent(message)}`;
}

async function uploadAttachmentFile(
  companyId: string,
  employeeId: string,
  file: File,
  entityType: string,
  fallbackName: string,
) {
  const buf = Buffer.from(await file.arrayBuffer());
  await apiServer(`/companies/${companyId}/attachments`, {
    method: "POST",
    companyId,
    body: JSON.stringify({
      entityType,
      entityId: employeeId,
      fileName: file.name || fallbackName,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: String(file.size),
      contentBase64: buf.toString("base64"),
    }),
  });
}

async function uploadInsuranceViaHr(
  companyId: string,
  employeeId: string,
  file: File,
) {
  const buf = Buffer.from(await file.arrayBuffer());
  await apiServer(
    `/companies/${companyId}/hr/employees/${employeeId}/insurance`,
    {
      method: "POST",
      companyId,
      body: JSON.stringify({
        fileName: file.name || "insurance.pdf",
        mimeType: file.type || "application/octet-stream",
        sizeBytes: String(file.size),
        contentBase64: buf.toString("base64"),
      }),
    },
  );
}

async function uploadIdentityPhotoViaHr(
  companyId: string,
  employeeId: string,
  file: File,
) {
  const buf = Buffer.from(await file.arrayBuffer());
  const attachment = await apiServer<{ id: string }>(
    `/companies/${companyId}/attachments`,
    {
      method: "POST",
      companyId,
      body: JSON.stringify({
        entityType: "employee_identity",
        entityId: employeeId,
        fileName: file.name || "identity.jpg",
        mimeType: file.type || "image/jpeg",
        sizeBytes: String(file.size),
        contentBase64: buf.toString("base64"),
      }),
    },
  );
  await apiServer(
    `/companies/${companyId}/hr/employees/${employeeId}/identity-attachment`,
    {
      method: "PATCH",
      companyId,
      body: JSON.stringify({ attachmentId: attachment.id }),
    },
  );
}

async function uploadWorkContractViaHr(
  companyId: string,
  employeeId: string,
  file: File,
) {
  const buf = Buffer.from(await file.arrayBuffer());
  const attachment = await apiServer<{ id: string }>(
    `/companies/${companyId}/attachments`,
    {
      method: "POST",
      companyId,
      body: JSON.stringify({
        entityType: "employee_work_contract",
        entityId: employeeId,
        fileName: file.name || "work-contract.pdf",
        mimeType: file.type || "application/pdf",
        sizeBytes: String(file.size),
        contentBase64: buf.toString("base64"),
      }),
    },
  );
  await apiServer(
    `/companies/${companyId}/hr/employees/${employeeId}/work-contract-attachment`,
    {
      method: "PATCH",
      companyId,
      body: JSON.stringify({ attachmentId: attachment.id }),
    },
  );
}

export async function createEmployee(companyId: string, formData: FormData) {
  const t = await hrT();
  const tc = await commonT();
  const pagePath = page(companyId, "employees");
  const insurance = formData.get("insurance");
  const hasInsurance = insurance instanceof File && insurance.size > 0;
  const qiwaFile = formData.get("qiwaContractFile");
  const hasQiwaFile = qiwaFile instanceof File && qiwaFile.size > 0;
  const identityPhoto = formData.get("identityPhoto");
  const hasIdentityPhoto =
    identityPhoto instanceof File && identityPhoto.size > 0;
  const workContractFile = formData.get("workContractFile");
  const hasWorkContract =
    workContractFile instanceof File && workContractFile.size > 0;
  const employmentCategory = str(formData, "employmentCategory");
  const phoneResult = parsePhoneFromForm(formData);
  if (!phoneResult.ok) {
    redirect(
      flashPath(
        pagePath,
        "error",
        phoneResult.error === "invalidLength"
          ? tc("phoneInvalidLength")
          : tc("phoneInvalidFormat"),
      ),
    );
  }

  const qiwaUrl = optStr(formData, "qiwaContractUrl");
  const qiwaRef = optStr(formData, "qiwaContractRef");
  const advanceMonth =
    optStr(formData, "advanceAllowanceMonth") ?? currentMonth();
  const advanceAmount = optStr(formData, "advanceAllowanceMonthly");
  const advancePercent = optStr(formData, "advanceAllowancePercent");

  const allowanceCount = Number(optStr(formData, "allowanceCount") ?? "0");
  const allowances: Array<{ allowanceTypeId: string; amount: string }> = [];
  for (let i = 0; i < allowanceCount; i++) {
    const typeId = optStr(formData, `allowanceTypeId_${i}`);
    const amount = optStr(formData, `allowanceAmount_${i}`);
    if (typeId && amount) {
      allowances.push({ allowanceTypeId: typeId, amount });
    }
  }

  const shiftWindowCount = Number(optStr(formData, "shiftWindowCount") ?? "0");
  const shiftWindows: Array<{ start: string; end: string }> = [];
  for (let i = 0; i < shiftWindowCount; i++) {
    const start = optStr(formData, `shiftWindowStart_${i}`);
    const end = optStr(formData, `shiftWindowEnd_${i}`);
    if (start && end) shiftWindows.push({ start, end });
  }

  try {
    const loginRoleCode = optStr(formData, "loginRoleCode");
    const jobTitle = optStr(formData, "jobTitle");
    // Commission UI submits empty salesTargetMode when hidden (cashier / marketer
    // without invoice-create). Only persist when the form actually sent a plan.
    const omitCommission = !optStr(formData, "salesTargetMode");
    const approvalStatus =
      optStr(formData, "approvalStatus") === "APPROVED"
        ? "APPROVED"
        : "PENDING";
    const identityType = str(formData, "identityType").toUpperCase();
    const identityNumber = normalizeSaudiId(str(formData, "identityNumber"));
    const createAppLogin = formData.get("createAppLogin") === "on";
    const employee = await apiServer<{
      id: string;
      appLogin?: {
        email: string;
        temporaryPassword: string;
        roleCode: string;
      };
    }>(`/companies/${companyId}/hr/employees`, {
      method: "POST",
      companyId,
      body: JSON.stringify({
        employeeNumber: str(formData, "employeeNumber"),
        fullName: str(formData, "fullName"),
        identityType,
        identityNumber,
        identityExpiresOn: optStr(formData, "identityExpiresOn"),
        email: optStr(formData, "email"),
        phone: phoneResult.phone,
        jobTitle,
        hireDate: optStr(formData, "hireDate"),
        employmentCategory: str(formData, "employmentCategory"),
        trialStartsOn: optStr(formData, "trialStartsOn"),
        trialEndsOn: optStr(formData, "trialEndsOn"),
        workShiftId: optStr(formData, "workShiftId"),
        shiftPatternMode: optStr(formData, "shiftPatternMode"),
        shiftWindows,
        allowances,
        basicSalary: optStr(formData, "basicSalary"),
        ...(omitCommission
          ? {}
          : {
              salesTargetMode:
                optStr(formData, "salesTargetMode") ?? "TARGET_FIXED",
              salesTargetAmount: optStr(formData, "salesTargetAmount"),
              salesRewardAmount: optStr(formData, "salesRewardAmount"),
              targetPercent: optStr(formData, "targetPercent"),
            }),
        lateDiscountAmount: optStr(formData, "lateDiscountAmount"),
        absenceDiscountPerDay: optStr(formData, "absenceDiscountPerDay"),
        iban: normalizeSaudiIban(optStr(formData, "iban")),
        advanceAllowancePercent: advancePercent,
        advanceAllowanceMonthly: advanceAmount,
        advanceAllowanceMonth: advanceAmount ? advanceMonth : undefined,
        attendanceBadgeId: optStr(formData, "attendanceBadgeId"),
        approvalStatus,
        createAppLogin,
        loginRoleCode: createAppLogin
          ? (optStr(formData, "loginRoleCode") ?? "COMPANY_EMPLOYEE")
          : undefined,
        currency: "SAR",
      }),
    });

    if (hasInsurance && insurance instanceof File) {
      await uploadInsuranceViaHr(companyId, employee.id, insurance);
    }
    if (hasQiwaFile && qiwaFile instanceof File) {
      await uploadAttachmentFile(
        companyId,
        employee.id,
        qiwaFile,
        "employee_qiwa_proof",
        "qiwa-proof.pdf",
      );
    }
    if (hasIdentityPhoto && identityPhoto instanceof File) {
      await uploadIdentityPhotoViaHr(companyId, employee.id, identityPhoto);
    }
    if (
      hasWorkContract &&
      workContractFile instanceof File &&
      (employmentCategory === "EMPLOYMENT_CONTRACT" ||
        employmentCategory === "WAGE_WORKER")
    ) {
      await uploadWorkContractViaHr(companyId, employee.id, workContractFile);
    }
    // Legacy optional link/ref only — does not mark Qiwa as documented.
    if (qiwaUrl || qiwaRef) {
      await apiServer(
        `/companies/${companyId}/hr/employees/${employee.id}/qiwa`,
        {
          method: "POST",
          companyId,
          body: JSON.stringify({ url: qiwaUrl, ref: qiwaRef }),
        },
      );
    }

    revalidatePath(pagePath);
    const detailPath = `/c/${companyId}/hr/employees/${employee.id}`;
    if (employee.appLogin) {
      const q = new URLSearchParams({
        loginEmail: employee.appLogin.email,
        loginPassword: employee.appLogin.temporaryPassword,
        ok: t("flash.employeeCreatedWithLogin"),
      });
      redirect(`${detailPath}?${q.toString()}`);
    }
    redirect(flashPath(pagePath, "ok", t("flash.employeeCreated")));
  } catch (error) {
    if (error instanceof ApiError) {
      const details =
        error.payload &&
        typeof error.payload === "object" &&
        Array.isArray((error.payload as { details?: unknown }).details)
          ? (error.payload as { details: unknown[] }).details.map(String)
          : [];
      const detailText =
        details.length > 0 ? details.join("; ") : error.message;
      const message =
        error.status === 403
          ? tc("forbiddenWithDetail", { detail: detailText })
          : detailText;
      redirect(flashPath(pagePath, "error", message));
    }
    throw error;
  }
}

export async function setEmployeeStatus(
  companyId: string,
  employeeId: string,
  employmentStatus: string,
) {
  const t = await hrT();
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/employees/${employeeId}/status`,
    method: "PATCH",
    body: { employmentStatus },
    pagePath: page(companyId, "employees"),
    okMessage: t("flash.statusUpdated", { status: employmentStatus }),
  });
}

export async function createAttendance(companyId: string, formData: FormData) {
  const t = await hrT();
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/attendance`,
    body: {
      employeeId: str(formData, "employeeId"),
      attendanceDate: str(formData, "attendanceDate"),
      status: str(formData, "status"),
      checkInAt: optStr(formData, "checkInAt"),
      checkOutAt: optStr(formData, "checkOutAt"),
      notes: optStr(formData, "notes"),
    },
    pagePath: page(companyId, "attendance"),
    okMessage: t("flash.attendanceRecorded"),
  });
}

export async function createLeave(companyId: string, formData: FormData) {
  const t = await hrT();
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/leaves`,
    body: {
      employeeId: str(formData, "employeeId"),
      leaveType: str(formData, "leaveType"),
      startsOn: str(formData, "startsOn"),
      endsOn: str(formData, "endsOn"),
      requestedDays: str(formData, "requestedDays"),
      reason: str(formData, "reason"),
    },
    pagePath: page(companyId, "leaves"),
    okMessage: t("flash.leaveRequested"),
  });
}

export async function decideLeave(
  companyId: string,
  leaveId: string,
  status: string,
) {
  const t = await hrT();
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/leaves/${leaveId}/decision`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, "leaves"),
    okMessage: t("flash.leaveDecided", {
      action:
        status === "APPROVED"
          ? t("flash.leaveApproved")
          : t("flash.leaveRejected"),
    }),
  });
}

export async function createPayrollRun(companyId: string, formData: FormData) {
  const t = await hrT();
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/payroll-runs`,
    body: {
      periodStart: str(formData, "periodStart"),
      periodEnd: str(formData, "periodEnd"),
    },
    pagePath: page(companyId, "payroll"),
    okMessage: t("flash.payrollCreated"),
  });
}

export async function setPayrollStatus(
  companyId: string,
  payrollRunId: string,
  status: string,
) {
  const t = await hrT();
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/payroll-runs/${payrollRunId}/status`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, "payroll"),
    okMessage: t("flash.payrollUpdated", { status }),
  });
}

export async function updateEmployeeCompensation(
  companyId: string,
  employeeId: string,
  formData: FormData,
) {
  const pagePath = page(companyId, "employees");
  const t = await hrT();
  const isPurchaseRaw = formData.get("isPurchaseOperator");
  const advanceAmount = optStr(formData, "advanceAllowanceMonthly");
  const advanceMonth =
    optStr(formData, "advanceAllowanceMonth") ?? currentMonth();
  const advancePercent = optStr(formData, "advanceAllowancePercent");
  const approvalStatus = optStr(formData, "approvalStatus");
  const previousApprovalStatus = optStr(formData, "previousApprovalStatus");
  const qiwaFile = formData.get("qiwaContractFile");
  const hasQiwaFile = qiwaFile instanceof File && qiwaFile.size > 0;
  const identityPhoto = formData.get("identityPhoto");
  const hasIdentityPhoto =
    identityPhoto instanceof File && identityPhoto.size > 0;
  const workContractFile = formData.get("workContractFile");
  const hasWorkContract =
    workContractFile instanceof File && workContractFile.size > 0;
  const employmentCategory = optStr(formData, "employmentCategory");
  const insurance = formData.get("insurance");
  const hasInsurance = insurance instanceof File && insurance.size > 0;

  const becomingApproved =
    approvalStatus === "APPROVED" && previousApprovalStatus !== "APPROVED";
  if (becomingApproved && !hasQiwaFile) {
    redirect(flashPath(pagePath, "error", t("flash.qiwaProofRequired")));
  }

  const allowanceCount = Number(optStr(formData, "allowanceCount") ?? "0");
  const allowances: Array<{ allowanceTypeId: string; amount: string }> = [];
  for (let i = 0; i < allowanceCount; i++) {
    const typeId = optStr(formData, `allowanceTypeId_${i}`);
    const amount = optStr(formData, `allowanceAmount_${i}`);
    if (typeId && amount) {
      allowances.push({ allowanceTypeId: typeId, amount });
    }
  }

  const shiftWindowCount = Number(optStr(formData, "shiftWindowCount") ?? "0");
  const shiftWindows: Array<{ start: string; end: string }> = [];
  for (let i = 0; i < shiftWindowCount; i++) {
    const start = optStr(formData, `shiftWindowStart_${i}`);
    const end = optStr(formData, `shiftWindowEnd_${i}`);
    if (start && end) shiftWindows.push({ start, end });
  }

  const identityNumberRaw = optStr(formData, "identityNumber");
  const phoneResult = parsePhoneFromForm(formData);
  if (!phoneResult.ok) {
    const tc = await commonT();
    redirect(
      flashPath(
        pagePath,
        "error",
        phoneResult.error === "invalidLength"
          ? tc("phoneInvalidLength")
          : tc("phoneInvalidFormat"),
      ),
    );
  }

  try {
    await apiServer(`/companies/${companyId}/hr/employees/${employeeId}`, {
      method: "PATCH",
      companyId,
      body: JSON.stringify({
        fullName: optStr(formData, "fullName"),
        phone: phoneResult.phone,
        email: optStr(formData, "email"),
        jobTitle: optStr(formData, "jobTitle"),
        hireDate: optStr(formData, "hireDate"),
        ...(employmentCategory ? { employmentCategory } : {}),
        trialStartsOn:
          employmentCategory === "TRIAL_PERIOD"
            ? optStr(formData, "trialStartsOn")
            : employmentCategory
              ? null
              : undefined,
        trialEndsOn:
          employmentCategory === "TRIAL_PERIOD"
            ? optStr(formData, "trialEndsOn")
            : employmentCategory
              ? null
              : undefined,
        identityType: optStr(formData, "identityType"),
        identityNumber: identityNumberRaw
          ? normalizeSaudiId(identityNumberRaw)
          : identityNumberRaw,
        identityExpiresOn: optStr(formData, "identityExpiresOn"),
        basicSalary: optStr(formData, "basicSalary"),
        ...(!optStr(formData, "salesTargetMode")
          ? {
              salesTargetMode: null,
              salesTargetAmount: null,
              salesRewardAmount: null,
              targetPercent: null,
            }
          : {
              salesTargetMode: optStr(formData, "salesTargetMode"),
              salesTargetAmount: optStr(formData, "salesTargetAmount"),
              salesRewardAmount: optStr(formData, "salesRewardAmount"),
              targetPercent: optStr(formData, "targetPercent"),
            }),
        lateDiscountAmount: optStr(formData, "lateDiscountAmount"),
        absenceDiscountPerDay: optStr(formData, "absenceDiscountPerDay"),
        iban: normalizeSaudiIban(optStr(formData, "iban")),
        attendanceBadgeId: optStr(formData, "attendanceBadgeId"),
        shiftPatternMode: optStr(formData, "shiftPatternMode"),
        ...(shiftWindowCount > 0 ? { shiftWindows } : {}),
        allowances,
        ...(approvalStatus ? { approvalStatus } : {}),
        ...(advancePercent
          ? { advanceAllowancePercent: advancePercent }
          : {}),
        ...(advanceAmount
          ? {
              advanceAllowanceMonthly: advanceAmount,
              advanceAllowanceMonth: advanceMonth,
            }
          : {}),
        currency: "SAR",
        ...(isPurchaseRaw != null
          ? {
              isPurchaseOperator:
                isPurchaseRaw === "true" || isPurchaseRaw === "on",
            }
          : {}),
      }),
    });

    if (hasQiwaFile && qiwaFile instanceof File) {
      await uploadAttachmentFile(
        companyId,
        employeeId,
        qiwaFile,
        "employee_qiwa_proof",
        "qiwa-proof.pdf",
      );
    }
    if (hasIdentityPhoto && identityPhoto instanceof File) {
      await uploadIdentityPhotoViaHr(companyId, employeeId, identityPhoto);
    }
    if (
      hasWorkContract &&
      workContractFile instanceof File &&
      (employmentCategory === "EMPLOYMENT_CONTRACT" ||
        employmentCategory === "WAGE_WORKER")
    ) {
      await uploadWorkContractViaHr(companyId, employeeId, workContractFile);
    }
    if (hasInsurance && insurance instanceof File) {
      await uploadInsuranceViaHr(companyId, employeeId, insurance);
    }

    revalidatePath(pagePath);
    redirect(flashPath(pagePath, "ok", t("flash.employeeUpdated")));
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(flashPath(pagePath, "error", error.message));
    }
    throw error;
  }
}

export async function updateEmployeeEmploymentCategory(
  companyId: string,
  employeeId: string,
  formData: FormData,
) {
  const pagePath = `/c/${companyId}/hr/employees/${employeeId}?tab=personal`;
  const employmentCategory = str(formData, "employmentCategory");
  const body: Record<string, unknown> = { employmentCategory };
  // Leaving trial for employment/Ajeer after Qiwa → clear trial dates & mark trusted
  if (
    employmentCategory === "EMPLOYMENT_CONTRACT" ||
    employmentCategory === "WAGE_WORKER"
  ) {
    body.trialStartsOn = null;
    body.trialEndsOn = null;
    body.approvalStatus = "APPROVED";
  }
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/employees/${employeeId}`,
    method: "PATCH",
    body,
    pagePath,
    okMessage: (await hrT())("flash.employeeUpdated"),
  });
}

export async function uploadEmployeeInsurance(
  companyId: string,
  employeeId: string,
  formData: FormData,
) {
  const pagePath = `/c/${companyId}/hr/employees/${employeeId}?tab=personal`;
  const file = formData.get("insurance");
  if (!(file instanceof File) || file.size <= 0) {
    redirect(flashPath(pagePath, "error", (await hrT())("flash.insuranceRequired")));
  }
  try {
    await uploadInsuranceViaHr(companyId, employeeId, file);
    revalidatePath(pagePath);
    redirect(flashPath(pagePath, "ok", (await hrT())("flash.insuranceUploaded")));
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(flashPath(pagePath, "error", error.message));
    }
    throw error;
  }
}

export async function uploadEmployeeIdentityPhoto(
  companyId: string,
  employeeId: string,
  formData: FormData,
) {
  const pagePath = `/c/${companyId}/hr/employees/${employeeId}?tab=personal`;
  const file = formData.get("identityPhoto");
  if (!(file instanceof File) || file.size <= 0) {
    redirect(
      flashPath(pagePath, "error", (await hrT())("flash.identityPhotoRequired")),
    );
  }
  try {
    await uploadIdentityPhotoViaHr(companyId, employeeId, file);
    revalidatePath(pagePath);
    redirect(
      flashPath(pagePath, "ok", (await hrT())("flash.identityPhotoUploaded")),
    );
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(flashPath(pagePath, "error", error.message));
    }
    throw error;
  }
}

export async function uploadEmployeeWorkContract(
  companyId: string,
  employeeId: string,
  formData: FormData,
) {
  const pagePath = `/c/${companyId}/hr/employees/${employeeId}?tab=personal`;
  const file = formData.get("workContractFile");
  if (!(file instanceof File) || file.size <= 0) {
    redirect(
      flashPath(pagePath, "error", (await hrT())("flash.workContractRequired")),
    );
  }
  try {
    await uploadWorkContractViaHr(companyId, employeeId, file);
    revalidatePath(pagePath);
    redirect(
      flashPath(pagePath, "ok", (await hrT())("flash.workContractUploaded")),
    );
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(flashPath(pagePath, "error", error.message));
    }
    throw error;
  }
}

export async function updateEmployeeQiwa(
  companyId: string,
  employeeId: string,
  formData: FormData,
) {
  const pagePath = `/c/${companyId}/hr/employees/${employeeId}?tab=personal`;
  const url = optStr(formData, "qiwaContractUrl") ?? "";
  const ref = optStr(formData, "qiwaContractRef") ?? "";

  try {
    await apiServer(
      `/companies/${companyId}/hr/employees/${employeeId}/qiwa`,
      {
        method: "POST",
        companyId,
        body: JSON.stringify({ url, ref }),
      },
    );
    revalidatePath(pagePath);
    redirect(flashPath(pagePath, "ok", (await hrT())("flash.qiwaLinkSaved")));
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(flashPath(pagePath, "error", error.message));
    }
    throw error;
  }
}

export async function setEmployeeAdvanceAllowance(
  companyId: string,
  employeeId: string,
  formData: FormData,
) {
  const percent = optStr(formData, "percent");
  const amount = optStr(formData, "amount");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/employees/${employeeId}/advance-allowance`,
    method: "PATCH",
    body: {
      percent,
      amount,
      month: optStr(formData, "month"),
    },
    pagePath: `/c/${companyId}/hr/employees/${employeeId}?tab=financial`,
    okMessage: (await hrT())("flash.advanceAllowanceUpdated"),
  });
}

export async function setEmployeeFinancialSettings(
  companyId: string,
  employeeId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/employees/${employeeId}`,
    method: "PATCH",
    body: {
      lateDiscountAmount: optStr(formData, "lateDiscountAmount"),
      absenceDiscountPerDay: optStr(formData, "absenceDiscountPerDay"),
      salesTargetMode: optStr(formData, "salesTargetMode"),
      salesTargetAmount: optStr(formData, "salesTargetAmount"),
      targetPercent: optStr(formData, "targetPercent"),
      basicSalary: optStr(formData, "basicSalary"),
    },
    pagePath: `/c/${companyId}/hr/employees/${employeeId}?tab=financial`,
    okMessage: (await hrT())("flash.financialUpdated"),
  });
}

export async function createShift(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/shifts`,
    body: {
      name: str(formData, "name"),
      startTime: str(formData, "startTime"),
      endTime: str(formData, "endTime"),
      breakMinutes: Number(optStr(formData, "breakMinutes") ?? "0"),
    },
    pagePath: page(companyId, "employees"),
    okMessage: (await hrT())("flash.shiftCreated"),
  });
}

export async function assignEmployeeShift(
  companyId: string,
  employeeId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/employees/${employeeId}/shifts`,
    body: {
      shiftId: str(formData, "shiftId"),
      effectiveFrom: str(formData, "effectiveFrom"),
      effectiveTo: optStr(formData, "effectiveTo"),
    },
    pagePath: `/c/${companyId}/hr/employees/${employeeId}?tab=shifts`,
    okMessage: (await hrT())("flash.shiftAssigned"),
  });
}

export async function decideSalesSubmission(
  companyId: string,
  saleId: string,
  status: "APPROVED" | "REJECTED",
  returnPath?: string,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/sales-submissions/${saleId}/decision`,
    method: "PATCH",
    body: { status },
    pagePath: returnPath ?? page(companyId, "sales-submissions"),
    okMessage: status === "APPROVED" ? (await hrT())("flash.saleApproved") : (await hrT())("flash.saleRejected"),
  });
}

export async function submitMySale(companyId: string, formData: FormData) {
  const pagePath = employeePortalPage(companyId, "sales");
  const method = str(formData, "paymentMethod");
  const saleDate = str(formData, "saleDate");
  const notes = optStr(formData, "notes");

  try {
    if (method === "CASH") {
      const amount = str(formData, "amount");
      if (!amount || !(Number(amount) > 0)) {
        redirect(
          flashPath(pagePath, "error", (await hrT())("flash.saleAmountRequired")),
        );
      }
      const receipt = formData.get("receipt");
      let receiptAttachmentId: string | undefined;
      if (receipt instanceof File && receipt.size > 0) {
        const buf = Buffer.from(await receipt.arrayBuffer());
        const attachment = await apiServer<{ id: string }>(
          `/companies/${companyId}/attachments`,
          {
            method: "POST",
            companyId,
            body: JSON.stringify({
              entityType: "employee_sales_receipt",
              entityId: companyId,
              fileName: receipt.name || "receipt.pdf",
              mimeType: receipt.type || "application/octet-stream",
              sizeBytes: String(receipt.size),
              contentBase64: buf.toString("base64"),
            }),
          },
        );
        receiptAttachmentId = attachment.id;
      }
      await apiServer(`/companies/${companyId}/hr/me/sales`, {
        method: "POST",
        companyId,
        body: JSON.stringify({
          saleDate,
          amount,
          paymentMethod: method,
          notes,
          receiptAttachmentId,
        }),
      });
    } else {
      const salesCount = Math.min(
        20,
        Math.max(1, Number(optStr(formData, "salesCount") ?? "1")),
      );
      for (let i = 0; i < salesCount; i++) {
        const amount = str(formData, `saleAmount_${i}`);
        if (!amount || !(Number(amount) > 0)) {
          redirect(
            flashPath(
              pagePath,
              "error",
              (await hrT())("flash.saleAmountRequired"),
            ),
          );
        }
        const receipt = formData.get(`receipt_${i}`);
        if (!(receipt instanceof File) || receipt.size <= 0) {
          redirect(
            flashPath(
              pagePath,
              "error",
              (await hrT())("flash.saleReceiptRequired"),
            ),
          );
        }
        const buf = Buffer.from(await receipt.arrayBuffer());
        const attachment = await apiServer<{ id: string }>(
          `/companies/${companyId}/attachments`,
          {
            method: "POST",
            companyId,
            body: JSON.stringify({
              entityType: "employee_sales_receipt",
              entityId: companyId,
              fileName: receipt.name || `receipt-${i + 1}.pdf`,
              mimeType: receipt.type || "application/octet-stream",
              sizeBytes: String(receipt.size),
              contentBase64: buf.toString("base64"),
            }),
          },
        );
        await apiServer(`/companies/${companyId}/hr/me/sales`, {
          method: "POST",
          companyId,
          body: JSON.stringify({
            saleDate,
            amount,
            paymentMethod: method,
            notes,
            receiptAttachmentId: attachment.id,
          }),
        });
      }
    }
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      redirect(flashPath(pagePath, "error", error.message));
    }
    throw error;
  }

  revalidatePath(pagePath);
  redirect(flashPath(pagePath, "ok", (await hrT())("flash.saleSubmitted")));
}

export async function createAllowanceType(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/allowance-types`,
    body: {
      code: str(formData, "code"),
      nameAr: str(formData, "nameAr"),
      nameEn: optStr(formData, "nameEn") ?? str(formData, "nameAr"),
    },
    pagePath: page(companyId, "employees"),
    okMessage: (await hrT())("flash.allowanceTypeCreated"),
  });
}

export async function deleteAllowanceType(
  companyId: string,
  allowanceTypeId: string,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/allowance-types/${allowanceTypeId}`,
    method: "DELETE",
    pagePath: page(companyId, "employees"),
    okMessage: (await hrT())("flash.allowanceTypeDeleted"),
  });
}

export async function updateMyTargetCompleted(
  companyId: string,
  _formData?: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/me/target-completed`,
    method: "PATCH",
    body: {},
    pagePath: employeePortalPage(companyId, "sales"),
    okMessage: (await hrT())("flash.targetRefreshed"),
  });
}

export async function createContract(companyId: string, formData: FormData) {
  const pagePath = page(companyId, "contracts");
  const file = formData.get("contractFile");
  const hasFile = file instanceof File && file.size > 0;

  if (hasFile) {
    const mimeType = file.type || "application/octet-stream";
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
    ];
    if (
      !allowed.includes(mimeType) &&
      !/\.(pdf|doc|docx|jpg|jpeg|png)$/i.test(file.name)
    ) {
      redirect(
        flashPath(pagePath, "error", (await hrT())("flash.contractFileUnsupported")),
      );
    }
  }

  try {
    const contract = await apiServer<{ id: string }>(
      `/companies/${companyId}/hr/contracts`,
      {
        method: "POST",
        companyId,
        body: JSON.stringify({
          employeeId: str(formData, "employeeId"),
          title: str(formData, "title"),
          contractNumber: optStr(formData, "contractNumber"),
          contractKind: optStr(formData, "contractKind") ?? "EMPLOYMENT",
          startsOn: optStr(formData, "startsOn"),
          endsOn: optStr(formData, "endsOn"),
          baseSalary: optStr(formData, "baseSalary"),
          notes: optStr(formData, "notes"),
        }),
      },
    );

    if (hasFile && file instanceof File) {
      await uploadAttachmentFile(
        companyId,
        contract.id,
        file,
        "employee_contract",
        "contract.pdf",
      );
    }

    revalidatePath(pagePath);
    redirect(flashPath(pagePath, "ok", (await hrT())("flash.contractCreated")));
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(flashPath(pagePath, "error", error.message));
    }
    throw error;
  }
}

export async function updateContract(
  companyId: string,
  contractId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/contracts/${contractId}`,
    method: "PATCH",
    body: {
      title: optStr(formData, "title"),
      contractNumber: optStr(formData, "contractNumber"),
      startsOn: optStr(formData, "startsOn"),
      endsOn: optStr(formData, "endsOn"),
      baseSalary: optStr(formData, "baseSalary"),
      notes: optStr(formData, "notes"),
    },
    pagePath: page(companyId, "contracts"),
    okMessage: (await hrT())("flash.contractUpdated"),
  });
}

export async function submitContract(companyId: string, contractId: string) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/contracts/${contractId}/submit`,
    method: "POST",
    body: {},
    pagePath: page(companyId, "contracts"),
    okMessage: (await hrT())("flash.contractSubmitted"),
  });
}

export async function createAdvance(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/advances`,
    body: {
      employeeId: str(formData, "employeeId"),
      amount: str(formData, "amount"),
      reason: optStr(formData, "reason"),
    },
    pagePath: page(companyId, "advances"),
    okMessage: (await hrT())("flash.advanceCreated"),
  });
}

export async function decideAdvance(
  companyId: string,
  advanceId: string,
  status: string,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/advances/${advanceId}/decision`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, "advances"),
    okMessage: (await hrT())("flash.advanceMarked", { status }),
  });
}

export async function upsertEwallet(
  companyId: string,
  employeeId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/ewallets`,
    body: {
      employeeId,
      walletCode: optStr(formData, "walletCode"),
      balance: optStr(formData, "balance"),
      currency: optStr(formData, "currency") || "SAR",
      memo: optStr(formData, "memo"),
    },
    pagePath: `/c/${companyId}/hr/employees/${employeeId}`,
    okMessage: (await hrT())("flash.ewalletSaved"),
  });
}

export async function createDevice(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/devices`,
    body: {
      name: str(formData, "name"),
      deviceType: str(formData, "deviceType"),
      deviceKey: str(formData, "deviceKey"),
      location: optStr(formData, "location"),
      streamUrl: optStr(formData, "streamUrl"),
    },
    pagePath: page(companyId, "devices"),
    okMessage: (await hrT())("flash.deviceCreated"),
  });
}

export async function updateMyProfile(companyId: string, formData: FormData) {
  const pagePath = employeePortalPage(companyId, "profile");
  const phoneResult = parsePhoneFromForm(formData);
  if (!phoneResult.ok) {
    const tc = await commonT();
    redirect(
      flashPath(
        pagePath,
        "error",
        phoneResult.error === "invalidLength"
          ? tc("phoneInvalidLength")
          : tc("phoneInvalidFormat"),
      ),
    );
  }
  const iban = optStr(formData, "iban");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/me`,
    method: "PATCH",
    body: {
      phone: phoneResult.phone,
      email: optStr(formData, "email"),
      ...(iban ? { iban } : {}),
    },
    pagePath,
    okMessage: (await hrT())("flash.profileUpdated"),
  });
}

export async function requestMyAdvance(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/me/advances`,
    body: {
      amount: str(formData, "amount"),
      reason: str(formData, "reason"),
    },
    pagePath: employeePortalPage(companyId, "advances"),
    okMessage: (await hrT())("flash.advanceRequested"),
  });
}

export async function requestMyWalletWithdrawal(
  companyId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/me/wallet-withdrawals`,
    body: {
      amount: str(formData, "amount"),
      reason: optStr(formData, "reason"),
    },
    pagePath: employeePortalPage(companyId, "wallet"),
    okMessage: (await hrT())("flash.walletWithdrawRequested"),
  });
}

export async function decideWalletWithdrawal(
  companyId: string,
  withdrawalId: string,
  status: string,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/wallet-withdrawals/${withdrawalId}/decision`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, "advances"),
    okMessage: (await hrT())("flash.walletWithdrawMarked", { status }),
  });
}

export async function requestMyLeave(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/me/leaves`,
    body: {
      leaveType: str(formData, "leaveType"),
      startsOn: str(formData, "startsOn"),
      endsOn: str(formData, "endsOn"),
      requestedDays: str(formData, "requestedDays"),
      reason: str(formData, "reason"),
    },
    pagePath: employeePortalPage(companyId, "leaves"),
    okMessage: (await hrT())("flash.leaveRequested"),
  });
}

type QiwaActionResult = { ok: true } | { ok: false; error: string };

function qiwaPage(companyId: string, employeeId: string) {
  return `/c/${companyId}/hr/employees/${employeeId}?tab=personal`;
}

async function qiwaMutate(
  companyId: string,
  employeeId: string,
  pathSuffix: string,
  body?: unknown,
): Promise<QiwaActionResult> {
  try {
    await apiServer(
      `/companies/${companyId}/hr/employees/${employeeId}/qiwa-contract${pathSuffix}`,
      {
        method: "POST",
        companyId,
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
    revalidatePath(qiwaPage(companyId, employeeId));
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 409) {
        return {
          ok: false,
          error:
            "The Qiwa contract status has changed. Please refresh the employee information.",
        };
      }
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Unexpected error" };
  }
}

export async function startEmployeeQiwaDocumentation(
  companyId: string,
  employeeId: string,
): Promise<QiwaActionResult> {
  return qiwaMutate(companyId, employeeId, "/start");
}

export async function markEmployeeQiwaSent(
  companyId: string,
  employeeId: string,
): Promise<QiwaActionResult> {
  return qiwaMutate(companyId, employeeId, "/mark-sent");
}

export async function markEmployeeQiwaRejected(
  companyId: string,
  employeeId: string,
  notes: string,
): Promise<QiwaActionResult> {
  return qiwaMutate(companyId, employeeId, "/mark-rejected", { notes });
}

export async function retryEmployeeQiwaDocumentation(
  companyId: string,
  employeeId: string,
): Promise<QiwaActionResult> {
  return qiwaMutate(companyId, employeeId, "/retry");
}

export async function confirmEmployeeQiwaDocumentation(
  companyId: string,
  employeeId: string,
  input: {
    qiwaContractReference: string;
    documentedAt: string;
    notes?: string;
    fileName: string;
    mimeType: string;
    sizeBytes: string;
    contentBase64: string;
  },
): Promise<QiwaActionResult> {
  return qiwaMutate(companyId, employeeId, "/confirm", input);
}

export async function approveEmployeeQiwaDocumentation(
  companyId: string,
  employeeId: string,
): Promise<QiwaActionResult> {
  return qiwaMutate(companyId, employeeId, "/approve");
}

export async function rejectEmployeeQiwaApproval(
  companyId: string,
  employeeId: string,
  notes: string,
): Promise<QiwaActionResult> {
  return qiwaMutate(companyId, employeeId, "/reject-approval", { notes });
}

