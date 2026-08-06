import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { ActionForm } from "@/components/erp/ActionForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import {
  createApiKey,
  createWebhook,
  deliverWebhook,
  setApiKeyStatus,
} from "../actions";

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  status: string;
  rateLimitPerMin: number;
};

type Webhook = {
  id: string;
  name: string;
  targetUrl: string;
  status: string;
  events: string[];
};

type Delivery = {
  id: string;
  eventType: string;
  status: string;
  createdAt: string;
  companyWebhookId?: string;
};

export default async function IntegrationCenterPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("integrations");
  const session = await getSession();
  const canWrite = can(session?.user, "integration_center.write");
  const canRead = can(session?.user, "integration_center.read");

  if (!canRead && !session?.user?.isPlatformAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("centerTitle")} />
        <Card>
          <EmptyState message={t("noCenterAccess")} />
        </Card>
      </div>
    );
  }

  const [keys, webhooks, deliveries] = await Promise.all([
    apiServer<ApiKey[]>(
      `/companies/${companyId}/integration-center/api-keys`,
      { companyId },
    ).catch(() => []),
    apiServer<Webhook[]>(
      `/companies/${companyId}/integration-center/webhooks`,
      { companyId },
    ).catch(() => []),
    apiServer<Delivery[]>(
      `/companies/${companyId}/integration-center/webhook-deliveries`,
      { companyId },
    ).catch(() => []),
  ]);

  const createKey = createApiKey.bind(null, companyId);
  const createHook = createWebhook.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("centerTitle")}
        description={t("centerDesc")}
        actions={
          <Button href={`/c/${companyId}/integrations`} variant="secondary">
            {t("backToIntegrations")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <div className="flex flex-wrap gap-2">
        {canWrite ? (
          <CreateFormDialog
            title={t("newApiKey")}
            triggerLabel={t("addApiKey")}
          >
            <form action={createKey} className="grid gap-3">
              <Input name="name" label={t("name")} required />
              <Input name="scopes" label={t("scopes")} defaultValue="*" />
              <Input
                name="rateLimitPerMin"
                label={t("rateLimit")}
                defaultValue="60"
              />
              <Button type="submit">{t("create")}</Button>
            </form>
          </CreateFormDialog>
        ) : null}

        {canWrite ? (
          <CreateFormDialog
            title={t("newWebhook")}
            triggerLabel={t("addWebhook")}
          >
            <form action={createHook} className="grid gap-3">
              <Input name="name" label={t("name")} required />
              <Input
                name="targetUrl"
                label={t("targetUrl")}
                required
                placeholder="https://example.com/hook"
              />
              <Input
                name="events"
                label={t("events")}
                defaultValue="order.created,order.updated"
              />
              <Button type="submit">{t("create")}</Button>
            </form>
          </CreateFormDialog>
        ) : null}
      </div>

      <Card title={t("apiKeys")}>
        {keys.length === 0 ? (
          <EmptyState message={t("noKeys")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-right text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("name")}</th>
                  <th className="px-2 py-2 font-medium">{t("colPrefix")}</th>
                  <th className="px-2 py-2 font-medium">{t("colLimit")}</th>
                  <th className="px-2 py-2 font-medium">{t("colStatus")}</th>
                  <th className="px-2 py-2 font-medium">{t("colAction")}</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr
                    key={k.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-medium">{k.name}</td>
                    <td className="px-2 py-2 font-mono text-xs">{k.keyPrefix}</td>
                    <td className="px-2 py-2">
                      {t("perMin", { n: k.rateLimitPerMin })}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={k.status} />
                    </td>
                    <td className="px-2 py-2">
                      {canWrite && k.status === "ACTIVE" ? (
                        <ActionForm
                          label={t("disable")}
                          variant="danger"
                          action={setApiKeyStatus.bind(
                            null,
                            companyId,
                            k.id,
                            "DISABLED",
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

      <Card title={t("webhooksTitle")}>
        {webhooks.length === 0 ? (
          <EmptyState message={t("noWebhooks")} />
        ) : (
          <div className="space-y-3">
            {webhooks.map((w) => (
              <div
                key={w.id}
                className="rounded border border-[var(--color-border)] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{w.name}</p>
                    <p className="font-mono text-xs text-[var(--color-muted)]">
                      {w.targetUrl}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {(w.events ?? []).join(", ")}
                    </p>
                  </div>
                  <StatusBadge status={w.status} />
                </div>
                {canWrite ? (
                  <div className="mt-3">
                    <CreateFormDialog
                      title={t("testDeliveryTitle", { name: w.name })}
                      triggerLabel={t("testDelivery")}
                      triggerVariant="secondary"
                      showPlus={false}
                    >
                      <form
                        action={deliverWebhook.bind(null, companyId, w.id)}
                        className="grid gap-3"
                      >
                        <Input
                          name="eventType"
                          label={t("eventType")}
                          defaultValue="order.created"
                        />
                        <Input
                          name="message"
                          label={t("message")}
                          placeholder={t("messagePlaceholder")}
                        />
                        <Button type="submit">{t("testDelivery")}</Button>
                      </form>
                    </CreateFormDialog>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={t("webhookDeliveries")}>
        {deliveries.length === 0 ? (
          <EmptyState message={t("noDeliveries")} />
        ) : (
          <ul className="space-y-2 text-sm">
            {deliveries.slice(0, 20).map((d) => (
              <li key={d.id} className="flex justify-between gap-2">
                <span>{d.eventType}</span>
                <StatusBadge status={d.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
