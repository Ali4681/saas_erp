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
          currency: optStr(formData, "currency") ?? "SAR",
        }),
      },
    );

    if (hasCv && file instanceof File) {
      const buf = Buffer.from(await file.arrayBuffer());
      await apiServer(`/companies/${companyId}/attachments`, {
        method: "POST",
        companyId,
        body: JSON.stringify({
          entityType: "employee",
          entityId: employee.id,
          fileName: file.name || "cv.pdf",
          mimeType: file.type || "application/octet-stream",
          sizeBytes: String(file.size),
          contentBase64: buf.toString("base64"),
        }),
      });
    }

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
