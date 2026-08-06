"use server";

import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function page(companyId: string, segment = "") {
  return `/c/${companyId}/work${segment}`;
}

export async function createProject(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/work/projects`,
    body: {
      code: str(formData, "code"),
      name: str(formData, "name"),
      startsOn: optStr(formData, "startsOn"),
      endsOn: optStr(formData, "endsOn"),
      budget: optStr(formData, "budget"),
      currency: optStr(formData, "currency") ?? "SAR",
      crmContactId: optStr(formData, "crmContactId"),
    },
    pagePath: page(companyId, "/projects"),
    okMessage: "تم إنشاء المشروع",
  });
}

export async function setProjectStatus(
  companyId: string,
  projectId: string,
  status: string,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/work/projects/${projectId}/status`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, `/projects/${projectId}`),
    okMessage: `تم تحديث المشروع إلى ${status}`,
  });
}

export async function createPhase(
  companyId: string,
  projectId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/work/projects/${projectId}/phases`,
    body: {
      name: str(formData, "name"),
      position: Number(str(formData, "position") || "1"),
    },
    pagePath: page(companyId, `/projects/${projectId}`),
    okMessage: "تم إضافة المرحلة",
  });
}

export async function createTask(
  companyId: string,
  projectId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/work/projects/${projectId}/tasks`,
    body: {
      title: str(formData, "title"),
      description: optStr(formData, "description"),
      workProjectPhaseId: optStr(formData, "workProjectPhaseId"),
      priority: optStr(formData, "priority") ?? "MEDIUM",
      dueAt: optStr(formData, "dueAt"),
      estimatedHours: optStr(formData, "estimatedHours"),
    },
    pagePath: page(companyId, `/projects/${projectId}`),
    okMessage: "تم إنشاء المهمة",
  });
}

export async function setTaskStatus(
  companyId: string,
  projectId: string,
  taskId: string,
  status: string,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/work/tasks/${taskId}/status`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, `/projects/${projectId}`),
    okMessage: `تم تحديث المهمة إلى ${status}`,
  });
}

export async function addTaskComment(
  companyId: string,
  projectId: string,
  taskId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/work/tasks/${taskId}/comments`,
    body: { body: str(formData, "body") },
    pagePath: page(companyId, `/projects/${projectId}`),
    okMessage: "تم إضافة التعليق",
  });
}
