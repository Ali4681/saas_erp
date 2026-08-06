"use server";

import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function page(companyId: string, segment: string) {
  return `/c/${companyId}/marketing/${segment}`;
}

export async function createPost(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/marketing/posts`,
    body: {
      content: str(formData, "content"),
      channel: str(formData, "channel"),
      title: optStr(formData, "title"),
      status: optStr(formData, "status") ?? "DRAFT",
      scheduledAt: optStr(formData, "scheduledAt"),
    },
    pagePath: page(companyId, "posts"),
    okMessage: "تم إنشاء المنشور",
  });
}

export async function schedulePost(
  companyId: string,
  postId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/marketing/posts/${postId}/schedule`,
    body: { scheduledAt: str(formData, "scheduledAt") },
    pagePath: page(companyId, "posts"),
    okMessage: "تم جدولة المنشور",
  });
}

export async function publishPost(companyId: string, postId: string) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/marketing/posts/${postId}/publish`,
    pagePath: page(companyId, "posts"),
    okMessage: "تم نشر المنشور",
  });
}

export async function archivePost(companyId: string, postId: string) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/marketing/posts/${postId}/archive`,
    pagePath: page(companyId, "posts"),
    okMessage: "تم أرشفة المنشور",
  });
}

export async function createConnection(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/marketing/connections`,
    body: {
      channel: str(formData, "channel"),
      displayName: str(formData, "displayName"),
      externalAccountId: optStr(formData, "externalAccountId"),
      status: optStr(formData, "status") ?? "CONNECTED",
    },
    pagePath: page(companyId, "connections"),
    okMessage: "تم إضافة الاتصال",
  });
}

export async function setConnectionStatus(
  companyId: string,
  connectionId: string,
  status: string,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/marketing/connections/${connectionId}/status`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, "connections"),
    okMessage: `تم تحديث الاتصال إلى ${status}`,
  });
}
