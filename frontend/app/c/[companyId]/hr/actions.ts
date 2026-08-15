"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { apiServer } from "@/lib/api/server";
import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function page(companyId: string, segment: string) {
  return `/c/${companyId}/hr/${segment}`;
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

export async function createEmployee(companyId: string, formData: FormData) {
  const pagePath = page(companyId, "employees");
  const file = formData.get("cv");
  const hasCv = file instanceof File && file.size > 0;
  const insurance = formData.get("insurance");
  const hasInsurance = insurance instanceof File && insurance.size > 0;

  if (hasCv) {
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
        flashPath(
          pagePath,
          "error",
          "صيغة الـ CV غير مدعومة (PDF / Word / صورة)",
        ),
      );
    }
  }

  const qiwaUrl = optStr(formData, "qiwaContractUrl");
  const qiwaRef = optStr(formData, "qiwaContractRef");

  const advanceMonth =
    optStr(formData, "advanceAllowanceMonth") ?? currentMonth();
  const advanceAmount = optStr(formData, "advanceAllowanceMonthly");
  const advancePercent = optStr(formData, "advanceAllowancePercent");

  try {
    const salesTargetMode =
      optStr(formData, "salesTargetMode") ?? "AMOUNT";
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
        phone: optStr(formData, "phone"),
        jobTitle: optStr(formData, "jobTitle"),
        hireDate: optStr(formData, "hireDate"),
        basicSalary: optStr(formData, "basicSalary"),
        salesTargetMode,
        salesTargetAmount: optStr(formData, "salesTargetAmount"),
        targetPercent: optStr(formData, "targetPercent"),
        lateDiscountAmount: optStr(formData, "lateDiscountAmount"),
        absenceDiscountPerDay: optStr(formData, "absenceDiscountPerDay"),
        iban: normalizeSaudiIban(optStr(formData, "iban")),
        advanceAllowancePercent: advancePercent,
        advanceAllowanceMonthly: advanceAmount,
        advanceAllowanceMonth: advanceAmount ? advanceMonth : undefined,
        attendanceBadgeId: optStr(formData, "attendanceBadgeId"),
        approvalStatus,
        createAppLogin,
        currency: "SAR",
      }),
    });

    if (hasCv && file instanceof File) {
      await uploadAttachmentFile(
        companyId,
        employee.id,
        file,
        "employee",
        "cv.pdf",
      );
    }
    if (hasInsurance && insurance instanceof File) {
      await uploadInsuranceViaHr(companyId, employee.id, insurance);
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
        ok: "تم إنشاء الموظف وحساب الدخول — انسخ بيانات الدخول أدناه",
      });
      redirect(`${detailPath}?${q.toString()}`);
    }
    redirect(
      flashPath(
        pagePath,
        "ok",
        hasCv ? "تم إنشاء الموظف ورفع الـ CV" : "تم إنشاء الموظف",
      ),
    );
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
          ? `غير مصرح (403): ${detailText}`
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
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/employees/${employeeId}/status`,
    method: "PATCH",
    body: { employmentStatus },
    pagePath: page(companyId, "employees"),
    okMessage: `تم تحديث الحالة إلى ${employmentStatus}`,
  });
}

export async function createAttendance(companyId: string, formData: FormData) {
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
    okMessage: "تم تسجيل الحضور",
  });
}

export async function createLeave(companyId: string, formData: FormData) {
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
    okMessage: "تم تقديم طلب الإجازة",
  });
}

export async function decideLeave(
  companyId: string,
  leaveId: string,
  status: string,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/leaves/${leaveId}/decision`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, "leaves"),
    okMessage: `تم ${status === "APPROVED" ? "اعتماد" : "رفض"} الطلب`,
  });
}

export async function createPayrollRun(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/payroll-runs`,
    body: {
      periodStart: str(formData, "periodStart"),
      periodEnd: str(formData, "periodEnd"),
    },
    pagePath: page(companyId, "payroll"),
    okMessage: "تم إنشاء مسير الرواتب",
  });
}

export async function setPayrollStatus(
  companyId: string,
  payrollRunId: string,
  status: string,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/payroll-runs/${payrollRunId}/status`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, "payroll"),
    okMessage: `تم تحديث المسير إلى ${status}`,
  });
}

export async function updateEmployeeCompensation(
  companyId: string,
  employeeId: string,
  formData: FormData,
) {
  const isPurchaseRaw = formData.get("isPurchaseOperator");
  const advanceAmount = optStr(formData, "advanceAllowanceMonthly");
  const advanceMonth =
    optStr(formData, "advanceAllowanceMonth") ?? currentMonth();
  const advancePercent = optStr(formData, "advanceAllowancePercent");

  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/employees/${employeeId}`,
    method: "PATCH",
    body: {
      basicSalary: optStr(formData, "basicSalary"),
      salesTargetMode: optStr(formData, "salesTargetMode") ?? "AMOUNT",
      salesTargetAmount: optStr(formData, "salesTargetAmount"),
      targetPercent: optStr(formData, "targetPercent"),
      lateDiscountAmount: optStr(formData, "lateDiscountAmount"),
      absenceDiscountPerDay: optStr(formData, "absenceDiscountPerDay"),
      identityType: optStr(formData, "identityType"),
      identityNumber: optStr(formData, "identityNumber"),
      identityExpiresOn: optStr(formData, "identityExpiresOn"),
      iban: optStr(formData, "iban"),
      attendanceBadgeId: optStr(formData, "attendanceBadgeId"),
      ...(optStr(formData, "approvalStatus")
        ? { approvalStatus: optStr(formData, "approvalStatus") }
        : {}),
      ...(advancePercent
        ? { advanceAllowancePercent: advancePercent }
        : {}),
      ...(advanceAmount
        ? {
            advanceAllowanceMonthly: advanceAmount,
            advanceAllowanceMonth: advanceMonth,
          }
        : {}),
      phone: optStr(formData, "phone"),
      email: optStr(formData, "email"),
      jobTitle: optStr(formData, "jobTitle"),
      currency: "SAR",
      ...(isPurchaseRaw != null
        ? {
            isPurchaseOperator:
              isPurchaseRaw === "true" || isPurchaseRaw === "on",
          }
        : {}),
    },
    pagePath: page(companyId, "employees"),
    okMessage: "Employee updated",
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
    redirect(flashPath(pagePath, "error", "Insurance file required"));
  }
  try {
    await uploadInsuranceViaHr(companyId, employeeId, file);
    revalidatePath(pagePath);
    redirect(flashPath(pagePath, "ok", "Insurance uploaded"));
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
    redirect(flashPath(pagePath, "ok", "Qiwa link saved"));
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
    okMessage: "Advance allowance updated",
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
    okMessage: "Financial settings updated",
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
    okMessage: "Shift created",
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
    okMessage: "Shift assigned",
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
    okMessage: status === "APPROVED" ? "Sale approved" : "Sale rejected",
  });
}

export async function submitMySale(companyId: string, formData: FormData) {
  const pagePath = page(companyId, "me");
  const receipt = formData.get("receipt");
  const hasReceipt = receipt instanceof File && receipt.size > 0;

  try {
    let receiptAttachmentId: string | undefined;
    if (hasReceipt && receipt instanceof File) {
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
        saleDate: str(formData, "saleDate"),
        amount: str(formData, "amount"),
        paymentMethod: str(formData, "paymentMethod"),
        salesInvoiceId: str(formData, "salesInvoiceId"),
        notes: optStr(formData, "notes"),
        receiptAttachmentId,
      }),
    });

    revalidatePath(pagePath);
    redirect(flashPath(pagePath, "ok", "Sale submitted"));
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(flashPath(pagePath, "error", error.message));
    }
    throw error;
  }
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
    pagePath: page(companyId, "me"),
    okMessage: "Target refreshed from approved sales",
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
        flashPath(pagePath, "error", "Unsupported contract file type"),
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
    redirect(flashPath(pagePath, "ok", "Contract created"));
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
    okMessage: "Contract updated",
  });
}

export async function submitContract(companyId: string, contractId: string) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/contracts/${contractId}/submit`,
    method: "POST",
    body: {},
    pagePath: page(companyId, "contracts"),
    okMessage: "Contract submitted",
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
    okMessage: "Advance created",
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
    okMessage: `Advance marked ${status}`,
  });
}

export async function upsertEwallet(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/ewallets`,
    body: {
      employeeId: str(formData, "employeeId"),
      walletCode: optStr(formData, "walletCode"),
      balance: optStr(formData, "balance"),
      currency: optStr(formData, "currency"),
    },
    pagePath: page(companyId, "employees"),
    okMessage: "E-wallet saved",
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
    okMessage: "Device created",
  });
}

export async function updateMyProfile(companyId: string, formData: FormData) {
  const iban = optStr(formData, "iban");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/me`,
    method: "PATCH",
    body: {
      phone: optStr(formData, "phone"),
      email: optStr(formData, "email"),
      ...(iban ? { iban } : {}),
    },
    pagePath: page(companyId, "me"),
    okMessage: "Profile updated",
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
    pagePath: page(companyId, "me"),
    okMessage: "Advance requested",
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
    pagePath: page(companyId, "me"),
    okMessage: "Leave requested",
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

