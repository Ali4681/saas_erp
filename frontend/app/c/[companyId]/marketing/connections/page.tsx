import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { ActionForm } from "@/components/erp/ActionForm";
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
import { createConnection, setConnectionStatus } from "../actions";

type Connection = {
  id: string;
  channel: string;
  displayName: string;
  status: string;
  hasCredentials?: boolean;
  externalAccountId?: string | null;
};

export default async function ConnectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("marketing");
  const session = await getSession();
  const canWrite = can(session?.user, "marketing.write");

  const connections = await apiServer<Connection[]>(
    `/companies/${companyId}/marketing/connections`,
    { companyId },
  ).catch(() => []);

  const create = createConnection.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("connectionsTitle")}
        actions={
          <Button href={`/c/${companyId}/marketing`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("newConnection")}
          triggerLabel={t("addConnection")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Select
              name="channel"
              label={t("channel")}
              required
              options={[
                { value: "FACEBOOK", label: "Facebook" },
                { value: "INSTAGRAM", label: "Instagram" },
                { value: "X", label: "X" },
                { value: "LINKEDIN", label: "LinkedIn" },
                { value: "TIKTOK", label: "TikTok" },
                { value: "GOOGLE_BUSINESS_PROFILE", label: "Google Business" },
              ]}
            />
            <Input name="displayName" label={t("displayName")} required />
            <Input name="externalAccountId" label={t("externalAccountId")} />
            <div className="md:col-span-2">
              <Button type="submit">{t("connect")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {connections.length === 0 ? (
          <EmptyState message={t("noConnections")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("colName")}</th>
                  <th className="px-2 py-2 font-medium">{t("colChannel")}</th>
                  <th className="px-2 py-2 font-medium">{t("colStatus")}</th>
                  <th className="px-2 py-2 font-medium">{t("colAction")}</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-medium">{c.displayName}</td>
                    <td className="px-2 py-2">{c.channel}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-2 py-2">
                      {canWrite && c.status === "CONNECTED" ? (
                        <ActionForm
                          label={t("disconnect")}
                          variant="danger"
                          action={setConnectionStatus.bind(
                            null,
                            companyId,
                            c.id,
                            "DISCONNECTED",
                          )}
                        />
                      ) : canWrite && c.status === "DISCONNECTED" ? (
                        <ActionForm
                          label={t("reconnect")}
                          action={setConnectionStatus.bind(
                            null,
                            companyId,
                            c.id,
                            "CONNECTED",
                          )}
                        />
                      ) : null}
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
