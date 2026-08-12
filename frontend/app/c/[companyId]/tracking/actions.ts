"use server";

import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function trackingPage(companyId: string, segment: string) {
  return `/c/${companyId}/tracking/${segment}`;
}

/** Uses HR devices API until Tracking module endpoints ship. */
export async function createTrackingDevice(
  companyId: string,
  returnSegment: "cameras" | "biometrics",
  formData: FormData,
) {
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
    pagePath: trackingPage(companyId, returnSegment),
    okMessage: "Device created",
  });
}
