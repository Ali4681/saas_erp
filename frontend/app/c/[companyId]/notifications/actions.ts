"use server";

import { erpMutate } from "@/lib/erp/mutate";

function page(companyId: string) {
  return `/c/${companyId}/notifications`;
}

export async function markNotificationRead(
  companyId: string,
  notificationId: string,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/notifications/${notificationId}/read`,
    method: "PATCH",
    pagePath: page(companyId),
    okMessage: "تم تعليم الإشعار كمقروء",
  });
}

export async function markAllNotificationsRead(companyId: string) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/notifications/read-all`,
    method: "PATCH",
    pagePath: page(companyId),
    okMessage: "تم تعليم الكل كمقروء",
  });
}
