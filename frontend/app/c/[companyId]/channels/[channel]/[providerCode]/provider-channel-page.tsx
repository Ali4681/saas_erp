import { getLocale, getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/config";
import { FlashFromSearch } from "@/components/erp/Flash";
import { ActionForm } from "@/components/erp/ActionForm";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { ProviderSyncPanel } from "@/components/erp/ProviderSyncPanel";
import { HungerStationHub } from "@/components/erp/HungerStationHub";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/Textarea";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";
import {
  channelBySlug,
  extensionChannelForProvider,
  type IntegrationProviderDetail,
} from "@/lib/integrations";
import { providerOpsConfig } from "@/lib/provider-ops";
import type { CredentialFieldDef } from "@/lib/integration-credentials";
import { notFound } from "next/navigation";
import {
  connectProviderProject,
  connectProviderWithCredentials,
  saveExtensionSession,
  saveProviderCredentials,
  setProviderProjectStatus,
  testProviderAuth,
} from "../../actions";

type ConnectedProject = {
  id: string;
  name: string;
  status: string;
  environment: string;
  lastSuccessfulSyncAt: string | null;
  provider: { code: string; name: string };
  category: { code: string };
  credentials: {
    authType: string;
    status: string;
    updatedAt: string;
  } | null;
};

type ExtensionStatus = {
  channel: string;
  connected: boolean;
  lastSeenAt: number | null;
  pending: number;
};

type AdapterStatus = {
  extensionBridge: ExtensionStatus | null;
  hasCredentials: boolean;
  credentialsStatus: string | null;
  adapterMode: string;
  hasDedicatedAdapter: boolean;
};

function CredentialFields({ fields }: { fields: CredentialFieldDef[] }) {
  return (
    <>
      {fields.map((field) =>
        field.type === "textarea" ? (
          <Textarea
            key={field.name}
            name={field.name}
            label={field.label}
          />
        ) : (
          <Input
            key={field.name}
            name={field.name}
            label={field.label}
            type={field.type === "password" ? "password" : "text"}
          />
        ),
      )}
      {fields.some((f) => f.hint) ? (
        <ul className="space-y-1 text-xs text-[var(--muted-foreground)]">
          {fields
            .filter((f) => f.hint)
            .map((f) => (
              <li key={`${f.name}-hint`}>
                {f.label}: {f.hint}
              </li>
            ))}
        </ul>
      ) : null}
    </>
  );
}

export const HS_HUB_SECTIONS = [
  "orders",
  "reports",
  "catalog",
  "store",
] as const;

export type HsHubSection = (typeof HS_HUB_SECTIONS)[number];

export function isHsHubSection(value: string): value is HsHubSection {
  return (HS_HUB_SECTIONS as readonly string[]).includes(value);
}

export async function ProviderChannelPage({
  companyId,
  channelSlug,
  rawCode,
  hubSection,
  flash,
}: {
  companyId: string;
  channelSlug: string;
  rawCode: string;
  hubSection?: string;
  flash: { ok?: string; error?: string };
}) {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("channels");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const channel = channelBySlug(channelSlug);
  if (!channel) notFound();

  const providerCode = rawCode.toUpperCase();
  const known = channel.providers.find((p) => p.code === providerCode);
  if (!known) notFound();

  const ops = providerOpsConfig(providerCode, locale);
  const extensionChannel = extensionChannelForProvider(providerCode);
  const needsExtension = Boolean(extensionChannel);
  const showExtensionCard = needsExtension && ops.ready;

  const labelKey = channel.slug as "delivery" | "installments" | "stores";
  const channelLabel = t(labelKey);

  const [provider, projects, extensionStatus] = await Promise.all([
    apiServer<IntegrationProviderDetail>(
      `/integrations/providers/${providerCode}`,
      { companyId },
    ).catch(() => null),
    apiServer<ConnectedProject[]>(`/companies/${companyId}/projects`, {
      companyId,
    }).catch(() => []),
    extensionChannel
      ? apiServer<ExtensionStatus>(
          `/integrations/extension/${extensionChannel}/status`,
          { companyId },
        ).catch(() => null)
      : Promise.resolve(null),
  ]);

  if (provider && provider.category.code !== channel.code) {
    notFound();
  }

  const title = provider?.name ?? known.name;
  const project =
    projects.find((p) => p.provider.code.toUpperCase() === providerCode) ??
    null;

  const [adapterStatus, jobs, orders, syncStates, installments, products] =
    project && ops.ready
      ? await Promise.all([
          apiServer<AdapterStatus>(
            `/companies/${companyId}/projects/${project.id}/adapter-status`,
            { companyId },
          ).catch(() => null),
          apiServer<
            Array<{
              id: string;
              entityType: string | null;
              jobType: string;
              status: string;
              scheduledAt: string;
              finishedAt: string | null;
            }>
          >(`/companies/${companyId}/projects/${project.id}/jobs`, {
            companyId,
          }).catch(() => []),
          apiServer<
            Array<{
              id: string;
              externalId: string;
              status: string;
              totalAmount: string | number | null;
              currency: string | null;
              placedAt: string | null;
              customer?: { displayName: string | null } | null;
            }>
          >(
            `/companies/${companyId}/projects/${project.id}/mirrors/orders?take=15`,
            { companyId },
          ).catch(() => []),
          apiServer<
            Array<{
              entityType: string;
              lastSyncedAt: string | null;
              lastStatus: string;
            }>
          >(
            `/companies/${companyId}/projects/${project.id}/sync-states`,
            { companyId },
          ).catch(() => []),
          apiServer<
            Array<{
              id: string;
              externalId: string;
              status: string;
              amount: string | number;
              currency: string;
              merchantOrderReference: string;
              lastSyncedAt: string;
            }>
          >(
            `/companies/${companyId}/projects/${project.id}/mirrors/installments?take=15`,
            { companyId },
          ).catch(() => []),
          apiServer<
            Array<{
              id: string;
              externalId: string;
              name: string;
              status: string;
              price: string | number | null;
              currency: string | null;
            }>
          >(
            `/companies/${companyId}/projects/${project.id}/mirrors/products?take=15`,
            { companyId },
          ).catch(() => []),
        ])
      : [null, [], [], [], [], []];

  const bridge = adapterStatus?.extensionBridge ?? extensionStatus;

  const connectExt = connectProviderProject.bind(
    null,
    companyId,
    channel.slug,
    channel.code,
    providerCode,
  );
  const connectCreds = connectProviderWithCredentials.bind(
    null,
    companyId,
    channel.slug,
    channel.code,
    providerCode,
  );

  const isHungerStation = providerCode === "HUNGERSTATION";
  const isHsSubPage = isHungerStation && Boolean(hubSection);
  const showConnectionPanel = !isHsSubPage;

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={`${channelLabel} · ${providerCode}`}
        actions={
          <Button
            href={`/c/${companyId}/channels/${channel.slug}`}
            variant="secondary"
          >
            {t("backTo", { label: channelLabel })}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {showConnectionPanel && !ops.ready ? (
        <Card title={t("comingSoon")}>
          <EmptyState message={ops.setupHint || t("providerNotReady")} />
        </Card>
      ) : null}

      {showConnectionPanel && ops.ready ? (
        <Card title={t("setupRequirements")}>
          <p className="text-sm text-[var(--muted-foreground)]">
            {ops.setupHint}
          </p>
        </Card>
      ) : null}

      {showConnectionPanel && showExtensionCard ? (
        <Card title={t("extensionStatus")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={bridge?.connected ? "success" : "warning"}>
                  {bridge?.connected ? t("connected") : t("disconnected")}
                </Badge>
                <span className="font-mono text-xs text-[var(--muted-foreground)]">
                  ws://…/ws/{extensionChannel}
                </span>
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                {bridge?.connected
                  ? t("extensionConnectedHint")
                  : t("extensionDisconnectedHint")}
              </p>
            </div>
            {project && extensionChannel ? (
              <ActionForm
                action={saveExtensionSession.bind(
                  null,
                  companyId,
                  channel.slug,
                  providerCode,
                  extensionChannel,
                )}
                label={t("saveSession")}
                variant="primary"
              />
            ) : null}
          </div>
        </Card>
      ) : null}

      {showConnectionPanel && ops.ready ? (
        <Card title={t("linkAccount")}>
          {!project ? (
            <div className="space-y-4">
              <EmptyState message={t("noLinkYet")} />
              <div className="flex flex-wrap gap-2">
                {ops.connectViaExtension ? (
                  <CreateFormDialog
                    title={t("connectTitle", { title })}
                    description={t("connectExtDesc")}
                    triggerLabel={t("createLink")}
                  >
                    <form action={connectExt} className="grid gap-3">
                      <Input
                        name="name"
                        label={t("linkName")}
                        defaultValue={t("linkNameDefault", { title })}
                        required
                      />
                      <Select
                        name="environment"
                        label={t("environment")}
                        defaultValue="PRODUCTION"
                        options={[
                          { value: "PRODUCTION", label: t("production") },
                          { value: "SANDBOX", label: t("sandbox") },
                        ]}
                      />
                      <Button type="submit">{t("create")}</Button>
                    </form>
                  </CreateFormDialog>
                ) : null}

                {ops.showCredentials && ops.credentialFields.length > 0 ? (
                  <CreateFormDialog
                    title={t("connectTitle", { title })}
                    description={t("connectCredsDesc")}
                    triggerLabel={
                      ops.connectViaExtension
                        ? t("createWithCredentials")
                        : t("createLink")
                    }
                  >
                    <form action={connectCreds} className="grid gap-3">
                      <Input
                        name="name"
                        label={t("linkName")}
                        defaultValue={t("linkNameDefault", { title })}
                        required
                      />
                      <input
                        type="hidden"
                        name="authType"
                        value={ops.authTypeDefault}
                      />
                      <Select
                        name="environment"
                        label={t("environment")}
                        defaultValue="PRODUCTION"
                        options={[
                          { value: "PRODUCTION", label: t("production") },
                          { value: "SANDBOX", label: t("sandbox") },
                        ]}
                      />
                      <CredentialFields fields={ops.credentialFields} />
                      <Button type="submit">{t("createAndLink")}</Button>
                    </form>
                  </CreateFormDialog>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-[var(--muted-foreground)]">{t("name")}</dt>
                  <dd className="mt-1 font-medium">{project.name}</dd>
                </div>
                <div>
                  <dt className="text-[var(--muted-foreground)]">
                    {t("status")}
                  </dt>
                  <dd className="mt-1">
                    <StatusBadge status={project.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted-foreground)]">
                    {t("credentials")}
                  </dt>
                  <dd className="mt-1">
                    {project.credentials ? (
                      <Badge variant="success">
                        {project.credentials.status} ·{" "}
                        {project.credentials.authType}
                      </Badge>
                    ) : (
                      <Badge variant="warning">{t("credentialsNotSaved")}</Badge>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted-foreground)]">
                    {t("lastSuccessfulSync")}
                  </dt>
                  <dd className="mt-1">
                    {formatDate(project.lastSuccessfulSyncAt)}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2">
                {project.status !== "ACTIVE" ? (
                  <ActionForm
                    action={setProviderProjectStatus.bind(
                      null,
                      companyId,
                      channel.slug,
                      providerCode,
                      project.id,
                      "ACTIVE",
                    )}
                    label={t("activateAndSync")}
                    variant="primary"
                  />
                ) : (
                  <ActionForm
                    action={setProviderProjectStatus.bind(
                      null,
                      companyId,
                      channel.slug,
                      providerCode,
                      project.id,
                      "DISABLED",
                    )}
                    label={t("pause")}
                    variant="secondary"
                    confirm={t("confirmPause")}
                  />
                )}
                <ActionForm
                  action={testProviderAuth.bind(
                    null,
                    companyId,
                    channel.slug,
                    providerCode,
                    project.id,
                  )}
                  label={t("testConnection")}
                  variant="secondary"
                />

                {ops.showCredentials && ops.credentialFields.length > 0 ? (
                  <CreateFormDialog
                    title={t("credentialsTitle")}
                    description={t("credentialsDesc")}
                    triggerLabel={t("credentialsTitle")}
                  >
                    <form
                      action={saveProviderCredentials.bind(
                        null,
                        companyId,
                        channel.slug,
                        providerCode,
                        project.id,
                      )}
                      className="grid gap-3"
                    >
                      <input
                        type="hidden"
                        name="authType"
                        value={
                          project.credentials?.authType ?? ops.authTypeDefault
                        }
                      />
                      <CredentialFields fields={ops.credentialFields} />
                      <Button type="submit">{t("save")}</Button>
                    </form>
                  </CreateFormDialog>
                ) : null}
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {project && ops.ready && isHungerStation && hubSection ? (
          <HungerStationHub
            companyId={companyId}
            projectId={project.id}
            categoryCode={channel.code}
            projectStatus={project.status}
            providerCode={providerCode}
            activeTab={
              isHsHubSection(hubSection) ? hubSection : "orders"
            }
            initialSyncStates={syncStates}
            initialOrders={orders}
            initialInstallments={installments}
            initialProducts={products}
            initialJobs={jobs}
          />
      ) : null}

      {project && ops.ready && !isHungerStation ? (
          <ProviderSyncPanel
            companyId={companyId}
            projectId={project.id}
            categoryCode={channel.code}
            projectStatus={project.status}
            providerCode={providerCode}
            initialSyncStates={syncStates}
            initialOrders={orders}
            initialInstallments={installments}
            initialProducts={products}
            initialJobs={jobs}
          />
      ) : null}

      {isHsSubPage && !project ? (
        <Card>
          <EmptyState message={t("noLinkYet")} />
        </Card>
      ) : null}

      {showConnectionPanel && !provider && ops.ready ? (
        <Card>
          <EmptyState message={t("catalogLoadError")} />
        </Card>
      ) : null}
    </div>
  );
}
