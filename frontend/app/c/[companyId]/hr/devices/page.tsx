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
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { createDevice } from "../actions";

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

type DeviceEvent = {
  id: string;
  eventType: string;
  occurredAt: string;
  employeeId: string | null;
  externalRef: string | null;
  device?: { id: string; name: string; deviceType: string } | null;
};

export default async function DevicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("hr");
  const { formatDate } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "hr.write");

  const [devices, events] = await Promise.all([
    apiServer<Device[]>(`/companies/${companyId}/hr/devices`, {
      companyId,
    }).catch(() => []),
    apiServer<DeviceEvent[]>(`/companies/${companyId}/hr/device-events`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createDevice.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance devices"
        description="Cameras and biometric devices"
        actions={
          <Button href={`/c/${companyId}/hr`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog title="New device" triggerLabel="Add device">
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Input name="name" label={t("name")} required />
            <Select
              name="deviceType"
              label={t("type")}
              required
              options={[
                { value: "CAMERA", label: "Camera" },
                { value: "BIOMETRIC", label: "Biometric" },
                { value: "BOTH", label: "Both" },
              ]}
            />
            <Input name="deviceKey" label="Device key" required />
            <Input name="location" label="Location" />
            <Input
              name="streamUrl"
              label="Stream URL"
              className="md:col-span-2"
            />
            <div className="md:col-span-2">
              <Button type="submit">{t("save")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Devices</h2>
        {devices.length === 0 ? (
          <EmptyState message="No devices" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("name")}</th>
                  <th className="px-2 py-2 font-medium">{t("type")}</th>
                  <th className="px-2 py-2 font-medium">Location</th>
                  <th className="px-2 py-2 font-medium">Last seen</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
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
                    <td className="px-2 py-2">
                      {d.lastSeenAt ? formatDate(d.lastSeenAt) : "—"}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={d.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Recent events</h2>
        {events.length === 0 ? (
          <EmptyState message="No device events" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">Device</th>
                  <th className="px-2 py-2 font-medium">Event</th>
                  <th className="px-2 py-2 font-medium">Employee</th>
                  <th className="px-2 py-2 font-medium">{t("date")}</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 50).map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-2 py-2">{e.device?.name ?? "—"}</td>
                    <td className="px-2 py-2">{e.eventType}</td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {e.employeeId ?? e.externalRef ?? "—"}
                    </td>
                    <td className="px-2 py-2">{formatDate(e.occurredAt)}</td>
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
