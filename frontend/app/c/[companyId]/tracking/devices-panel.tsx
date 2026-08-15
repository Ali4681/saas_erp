import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { canAny } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { createTrackingDevice } from "./actions";

type Device = {
  id: string;
  name: string;
  deviceType: string;
  deviceKey: string;
  location: string | null;
  streamUrl: string | null;
  status: string;
  lastSeenAt: string | null;
};

export default async function TrackingDevicesPage({
  params,
  searchParams,
  filter,
  titleKey,
  descKey,
  defaultType,
  segment,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
  filter: "CAMERA" | "BIOMETRIC";
  titleKey: "camerasTitle" | "biometricsTitle";
  descKey: "camerasDesc" | "biometricsDesc";
  defaultType: "CAMERA" | "BIOMETRIC";
  segment: "cameras" | "biometrics";
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("tracking");
  const { formatDate } = await getFormatters();
  const session = await getSession();
  const canWrite = canAny(
    session?.user,
    "tracking.write",
    "hr.write",
  );

  const devices = await apiServer<Device[]>(
    `/companies/${companyId}/tracking/${segment}`,
    { companyId },
  ).catch(() => []);

  const create = createTrackingDevice.bind(null, companyId, segment);
  const punchUrl = `/api/companies/${companyId}/tracking/devices/punch`;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t(titleKey)}
        description={t(descKey)}
        actions={
          <Button href={`/c/${companyId}/tracking`} variant="secondary">
            {t("hubBack")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {filter === "CAMERA" ? (
        <Card className="space-y-2 p-4 text-sm text-[var(--muted-foreground)]">
          <p className="font-medium text-[var(--foreground)]">
            {t("cameraConnectTitle")}
          </p>
          <p>{t("cameraConnectHint")}</p>
        </Card>
      ) : (
        <Card className="space-y-2 p-4 text-sm text-[var(--muted-foreground)]">
          <p className="font-medium text-[var(--foreground)]">
            {t("biometricConnectTitle")}
          </p>
          <p>{t("biometricConnectHint")}</p>
          <p className="font-mono text-xs break-all text-[var(--foreground)]">
            POST {punchUrl}
          </p>
          <p>{t("biometricPunchBody")}</p>
        </Card>
      )}

      {canWrite ? (
        <CreateFormDialog title={t("newDevice")} triggerLabel={t("addDevice")}>
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Input name="name" label={t("name")} required />
            <Select
              name="deviceType"
              label={t("type")}
              required
              defaultValue={defaultType}
              options={
                filter === "CAMERA"
                  ? [
                      { value: "CAMERA", label: "Camera" },
                      { value: "BOTH", label: "Both" },
                    ]
                  : [
                      { value: "BIOMETRIC", label: "Biometric" },
                      { value: "BOTH", label: "Both" },
                    ]
              }
            />
            {filter === "CAMERA" ? (
              <Input
                name="streamUrl"
                label={t("streamUrl")}
                className="md:col-span-2"
                required
                placeholder="https://nvr.example.com/live/cam1"
              />
            ) : (
              <Input
                name="deviceKey"
                label={t("deviceKey")}
                placeholder={t("deviceKeyOptional")}
              />
            )}
            {filter === "CAMERA" ? (
              <Input
                name="deviceKey"
                label={t("deviceKey")}
                placeholder={t("deviceKeyOptional")}
              />
            ) : null}
            <Input name="location" label={t("location")} />
            {filter === "BIOMETRIC" ? (
              <Input
                name="streamUrl"
                label={t("vendorPortalUrl")}
                className="md:col-span-2"
                placeholder="https://…"
              />
            ) : null}
            <div className="md:col-span-2">
              <Button type="submit">{t("save")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {devices.length === 0 ? (
          <EmptyState message={t("emptyDevices")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("name")}</th>
                  <th className="px-2 py-2 font-medium">{t("type")}</th>
                  <th className="px-2 py-2 font-medium">{t("location")}</th>
                  <th className="px-2 py-2 font-medium">
                    {filter === "CAMERA" ? t("streamUrl") : t("deviceKey")}
                  </th>
                  <th className="px-2 py-2 font-medium">{t("lastSeen")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-medium">{d.name}</td>
                    <td className="px-2 py-2">{d.deviceType}</td>
                    <td className="px-2 py-2">{d.location ?? "—"}</td>
                    <td className="px-2 py-2 font-mono text-xs break-all">
                      {filter === "CAMERA"
                        ? (d.streamUrl ?? "—")
                        : d.deviceKey}
                    </td>
                    <td className="px-2 py-2">
                      {d.lastSeenAt ? formatDate(d.lastSeenAt) : "—"}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-2 py-2">
                      {d.streamUrl ? (
                        <a
                          href={d.streamUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--primary)] underline-offset-2 hover:underline"
                        >
                          {t("openStream")}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
