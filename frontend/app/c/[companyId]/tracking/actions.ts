"use server";

import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function trackingPage(companyId: string, segment: string) {
  return `/c/${companyId}/tracking/${segment}`;
}

export async function createTrackingDevice(
  companyId: string,
  returnSegment: "cameras" | "biometrics",
  formData: FormData,
) {
  const path =
    returnSegment === "cameras"
      ? `/companies/${companyId}/tracking/cameras`
      : `/companies/${companyId}/tracking/biometrics`;

  await erpMutate({
    companyId,
    path,
    body: {
      name: str(formData, "name"),
      deviceType: str(formData, "deviceType"),
      deviceKey: optStr(formData, "deviceKey"),
      location: optStr(formData, "location"),
      streamUrl: optStr(formData, "streamUrl"),
    },
    pagePath: trackingPage(companyId, returnSegment),
    okMessage: "Device created",
  });
}

export async function updateTrackingDevice(
  companyId: string,
  deviceId: string,
  returnSegment: "cameras" | "biometrics",
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/tracking/devices/${deviceId}`,
    method: "PATCH",
    body: {
      name: optStr(formData, "name"),
      status: optStr(formData, "status"),
      location: optStr(formData, "location"),
      streamUrl: optStr(formData, "streamUrl"),
    },
    pagePath: trackingPage(companyId, returnSegment),
    okMessage: "Device updated",
  });
}
