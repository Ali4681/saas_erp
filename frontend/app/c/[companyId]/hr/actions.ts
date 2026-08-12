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

export async function createEmployee(companyId: string, formData: FormData) {
  const pagePath = page(companyId, "employees");
  const file = formData.get("cv");
  const hasCv = file instanceof File && file.size > 0;

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
        `${pagePath}?error=${encodeURIComponent(
          "صيغة الـ CV غير مدعومة (PDF / Word / صورة)",
        )}`,
      );
    }
  }

  try {
    const employee = await apiServer<{ id: string }>(
      `/companies/${companyId}/hr/employees`,
      {
        method: "POST",
        companyId,
        body: JSON.stringify({
          employeeNumber: str(formData, "employeeNumber"),
          fullName: str(formData, "fullName"),
          email: optStr(formData, "email"),
          phone: optStr(formData, "phone"),
          jobTitle: optStr(formData, "jobTitle"),
          hireDate: optStr(formData, "hireDate"),
          basicSalary: optStr(formData, "basicSalary"),
          salesTargetAmount: optStr(formData, "salesTargetAmount"),
          salesTargetMode: "AMOUNT",
          absenceDiscountPerDay: optStr(formData, "absenceDiscountPerDay"),
          identityType: optStr(formData, "identityType"),
          identityNumber: optStr(formData, "identityNumber"),
          identityExpiresOn: optStr(formData, "identityExpiresOn"),
          iban: optStr(formData, "iban"),
          advanceAllowancePercent: optStr(formData, "advanceAllowancePercent"),
          qiwaContractUrl: optStr(formData, "qiwaContractUrl"),
          // APPROVED = registered on Qiwa; never REJECTED
          approvalStatus: (() => {
            const qiwa = optStr(formData, "qiwaContractUrl");
            const selected = optStr(formData, "approvalStatus");
            if (qiwa || selected === "APPROVED") return "APPROVED";
            return "PENDING";
          })(),
          currency: "SAR",
        }),
      },
    );

    async function uploadNamed(
      field: string,
      entityType: string,
      fallbackName: string,
    ) {
      const file = formData.get(field);
      if (!(file instanceof File) || file.size <= 0) return;
      const buf = Buffer.from(await file.arrayBuffer());
      await apiServer(`/companies/${companyId}/attachments`, {
        method: "POST",
        companyId,
        body: JSON.stringify({
          entityType,
          entityId: employee.id,
          fileName: file.name || fallbackName,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: String(file.size),
          contentBase64: buf.toString("base64"),
        }),
      });
    }

    if (hasCv && file instanceof File) {
      await uploadNamed("cv", "employee", "cv.pdf");
    }
    await uploadNamed("insurance", "employee_insurance", "insurance.pdf");

    revalidatePath(pagePath);
    redirect(
      `${pagePath}?ok=${encodeURIComponent(
        hasCv ? "تم إنشاء الموظف ورفع الـ CV" : "تم إنشاء الموظف",
      )}`,
    );
  } catch (error) {
    if (error instanceof ApiError) {
      const message =
        error.status === 403
          ? `غير مصرح (403): ${error.message}`
          : error.message;
      redirect(`${pagePath}?error=${encodeURIComponent(message)}`);
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
      reason: optStr(formData, "reason"),
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
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/employees/${employeeId}`,
    method: "PATCH",
    body: {
      basicSalary: optStr(formData, "basicSalary"),
      salesTargetAmount: optStr(formData, "salesTargetAmount"),
      salesTargetMode: "AMOUNT",
      absenceDiscountPerDay: optStr(formData, "absenceDiscountPerDay"),
      identityType: optStr(formData, "identityType"),
      identityNumber: optStr(formData, "identityNumber"),
      identityExpiresOn: optStr(formData, "identityExpiresOn"),
      iban: optStr(formData, "iban"),
      advanceAllowancePercent: optStr(formData, "advanceAllowancePercent"),
      approvalStatus:
        optStr(formData, "approvalStatus") === "APPROVED"
          ? "APPROVED"
          : "PENDING",
      qiwaContractUrl: optStr(formData, "qiwaContractUrl"),
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

export async function setEmployeeApproval(
  companyId: string,
  employeeId: string,
  approvalStatus: string,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/employees/${employeeId}`,
    method: "PATCH",
    body: { approvalStatus },
    pagePath: `/c/${companyId}/hr/employees/${employeeId}`,
    okMessage:
      approvalStatus === "APPROVED"
        ? "Marked as registered on Qiwa"
        : "Marked as not registered on Qiwa",
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
    redirect(
      `${pagePath}?error=${encodeURIComponent("Insurance file required")}`,
    );
  }
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    await apiServer(`/companies/${companyId}/attachments`, {
      method: "POST",
      companyId,
      body: JSON.stringify({
        entityType: "employee_insurance",
        entityId: employeeId,
        fileName: file.name || "insurance.pdf",
        mimeType: file.type || "application/octet-stream",
        sizeBytes: String(file.size),
        contentBase64: buf.toString("base64"),
      }),
    });
    // Best-effort link on employee when backend supports it
    await apiServer(`/companies/${companyId}/hr/employees/${employeeId}`, {
      method: "PATCH",
      companyId,
      body: JSON.stringify({ insuranceUploaded: true }),
    }).catch(() => undefined);
    revalidatePath(pagePath);
    redirect(`${pagePath}&ok=${encodeURIComponent("Insurance uploaded")}`);
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(`${pagePath}&error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}

export async function updateEmployeeQiwa(
  companyId: string,
  employeeId: string,
  formData: FormData,
) {
  const qiwaContractUrl = optStr(formData, "qiwaContractUrl");
  const qiwaContractRef = optStr(formData, "qiwaContractRef");
  const registeredOnQiwa = Boolean(qiwaContractUrl || qiwaContractRef);
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/employees/${employeeId}`,
    method: "PATCH",
    body: {
      qiwaContractUrl,
      qiwaContractRef,
      // Approved = registered on Qiwa platform
      approvalStatus: registeredOnQiwa ? "APPROVED" : "PENDING",
    },
    pagePath: `/c/${companyId}/hr/employees/${employeeId}?tab=personal`,
    okMessage: "Qiwa link saved",
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
        `${pagePath}?error=${encodeURIComponent(
          "Unsupported contract file format (PDF / Word / image)",
        )}`,
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
          startsOn: optStr(formData, "startsOn"),
          endsOn: optStr(formData, "endsOn"),
          baseSalary: optStr(formData, "baseSalary"),
          targetPercent: optStr(formData, "targetPercent"),
          notes: optStr(formData, "notes"),
          submitNow:
            formData.get("submitNow") === "on" ||
            formData.get("submitNow") === "true",
        }),
      },
    );

    if (hasFile && file instanceof File) {
      const buf = Buffer.from(await file.arrayBuffer());
      await apiServer(`/companies/${companyId}/attachments`, {
        method: "POST",
        companyId,
        body: JSON.stringify({
          entityType: "employee_contract",
          entityId: contract.id,
          fileName: file.name || "contract.pdf",
          mimeType: file.type || "application/octet-stream",
          sizeBytes: String(file.size),
          contentBase64: buf.toString("base64"),
        }),
      });
    }

    revalidatePath(pagePath);
    redirect(
      `${pagePath}?ok=${encodeURIComponent(
        hasFile ? "Contract created with file" : "Contract created",
      )}`,
    );
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(`${pagePath}?error=${encodeURIComponent(error.message)}`);
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
      title: str(formData, "title"),
      contractNumber: optStr(formData, "contractNumber"),
      startsOn: optStr(formData, "startsOn"),
      endsOn: optStr(formData, "endsOn"),
      baseSalary: optStr(formData, "baseSalary"),
      targetPercent: optStr(formData, "targetPercent"),
      notes: optStr(formData, "notes"),
    },
    pagePath: page(companyId, "contracts"),
    okMessage: "Contract updated",
  });
}

export async function uploadContractFile(
  companyId: string,
  contractId: string,
  formData: FormData,
) {
  const pagePath = page(companyId, "contracts");
  const file = formData.get("contractFile");
  if (!(file instanceof File) || file.size <= 0) {
    redirect(`${pagePath}?error=${encodeURIComponent("Contract file required")}`);
  }
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    await apiServer(`/companies/${companyId}/attachments`, {
      method: "POST",
      companyId,
      body: JSON.stringify({
        entityType: "employee_contract",
        entityId: contractId,
        fileName: file.name || "contract.pdf",
        mimeType: file.type || "application/octet-stream",
        sizeBytes: String(file.size),
        contentBase64: buf.toString("base64"),
      }),
    });
    revalidatePath(pagePath);
    redirect(`${pagePath}?ok=${encodeURIComponent("Contract file uploaded")}`);
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(`${pagePath}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}

export async function submitContract(companyId: string, contractId: string) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/contracts/${contractId}/submit`,
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
    okMessage: "Advance request created",
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
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/hr/me`,
    method: "PATCH",
    body: {
      phone: optStr(formData, "phone"),
      email: optStr(formData, "email"),
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
      reason: optStr(formData, "reason"),
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
      reason: optStr(formData, "reason"),
    },
    pagePath: page(companyId, "me"),
    okMessage: "Leave requested",
  });
}
