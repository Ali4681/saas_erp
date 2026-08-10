import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { createMessagingChannel, sendMessage } from "../actions";

type Channel = {
  id: string;
  name: string;
  provider: string;
  status?: string;
};

type Delivery = {
  id: string;
  recipient: string;
  status: string;
  createdAt: string;
  subject?: string | null;
};

export default async function MessagingPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("integrations");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "messaging.write");
  const canRead = can(session?.user, "messaging.read");

  if (!canRead && !session?.user?.isPlatformAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("messagingTitle")} />
        <Card>
          <EmptyState message={t("noMessagingAccess")} />
        </Card>
      </div>
    );
  }

  const [channels, deliveries] = await Promise.all([
    apiServer<Channel[]>(`/companies/${companyId}/messaging/channels`, {
      companyId,
    }).catch(() => []),
    apiServer<Delivery[]>(`/companies/${companyId}/messaging/deliveries`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createMessagingChannel.bind(null, companyId);
  const send = sendMessage.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("messagingTitle")}
        description={t("messagingDesc")}
        actions={
          <Button href={`/c/${companyId}/integrations`} variant="secondary">
            {t("backToIntegrations")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <CreateFormDialog title={t("newChannel")} triggerLabel={t("addChannel")}>
            <form action={create} className="grid gap-3">
              <Select
                name="provider"
                label={t("provider")}
                required
                options={[
                  { value: "SMTP", label: "SMTP / Email" },
                  { value: "SMS", label: "SMS" },
                  { value: "WHATSAPP", label: "WhatsApp" },
                ]}
              />
              <Input name="name" label={t("name")} required />
              <Button type="submit">{t("create")}</Button>
            </form>
          </CreateFormDialog>

          <CreateFormDialog
            title={t("sendMessage")}
            triggerLabel={t("sendMessage")}
            triggerVariant="secondary"
            showPlus={false}
          >
            {channels.length === 0 ? (
              <EmptyState message={t("createChannelFirst")} />
            ) : (
              <form action={send} className="grid gap-3">
                <Select
                  name="messagingChannelId"
                  label={t("channel")}
                  required
                  options={channels.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.provider})`,
                  }))}
                />
                <Input
                  name="recipient"
                  label={t("recipient")}
                  required
                  placeholder={t("recipientPlaceholder")}
                />
                <Input name="subject" label={t("subject")} />
                <Textarea name="body" label={t("body")} required />
                <Button type="submit">{t("send")}</Button>
              </form>
            )}
          </CreateFormDialog>
        </div>
      ) : null}

      <Card title={t("channels")}>
        {channels.length === 0 ? (
          <EmptyState message={t("noChannels")} />
        ) : (
          <ul className="space-y-2 text-sm">
            {channels.map((c) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span>
                  {c.name}{" "}
                  <span className="text-[var(--color-muted)]">
                    ({c.provider})
                  </span>
                </span>
                {c.status ? <StatusBadge status={c.status} /> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t("deliveries")}>
        {deliveries.length === 0 ? (
          <EmptyState message={t("noDeliveries")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("colRecipient")}</th>
                  <th className="px-2 py-2 font-medium">{t("colSubject")}</th>
                  <th className="px-2 py-2 font-medium">{t("colStatus")}</th>
                  <th className="px-2 py-2 font-medium">{t("colDate")}</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2">{d.recipient}</td>
                    <td className="px-2 py-2">{d.subject ?? "—"}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-2 py-2">{formatDate(d.createdAt)}</td>
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
