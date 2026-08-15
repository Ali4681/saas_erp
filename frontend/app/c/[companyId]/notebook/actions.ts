"use server";

import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function page(companyId: string, segment: string) {
  return `/c/${companyId}/notebook/${segment}`;
}

export async function createCategory(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/notebook/categories`,
    body: {
      name: str(formData, "name"),
      code: optStr(formData, "code"),
    },
    pagePath: page(companyId, "categories"),
    okMessage: "تم إنشاء التصنيف",
  });
}

export async function createNote(
  companyId: string,
  categoryCode: string,
  pagePath: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/notebook/notes`,
    body: {
      title: str(formData, "title"),
      body: str(formData, "body"),
      categoryId: optStr(formData, "categoryId"),
      categoryCode: optStr(formData, "categoryCode") ?? categoryCode,
      priority: optStr(formData, "priority") ?? "MEDIUM",
      status: optStr(formData, "status") ?? "OPEN",
      employeeId: optStr(formData, "employeeId"),
      crmContactId: optStr(formData, "crmContactId"),
      workProjectId: optStr(formData, "workProjectId"),
    },
    pagePath,
    okMessage: "تم إنشاء الملاحظة",
  });
}

export async function updateNote(
  companyId: string,
  noteId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/notebook/notes/${noteId}`,
    method: "PATCH",
    body: {
      title: optStr(formData, "title"),
      body: optStr(formData, "body"),
      status: optStr(formData, "status"),
      priority: optStr(formData, "priority"),
      categoryId: optStr(formData, "categoryId"),
    },
    pagePath: page(companyId, `notes/${noteId}`),
    okMessage: "تم تحديث الملاحظة",
  });
}

export async function addNoteComment(
  companyId: string,
  noteId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/notebook/notes/${noteId}/comments`,
    body: { body: str(formData, "body") },
    pagePath: page(companyId, `notes/${noteId}`),
    okMessage: "تم إضافة التعليق",
  });
}
