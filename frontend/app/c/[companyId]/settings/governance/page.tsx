import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { ActionForm } from "@/components/erp/ActionForm";
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
import {
  lockFinancialPeriod,
  openBreakGlass,
  revokeBreakGlass,
  saveApprovalThreshold,
} from "../actions";

type SodRule = {
  id: string;
  permissionCodeA: string;
  permissionCodeB: string;
  label: string | null;
};
type Threshold = {
  id: string;
  actionType: string;
  maxAmount: string;
  currency: string;
  requiredPermission: string;
};
type PeriodLock = {
  id: string;
  periodStart: string;
  periodEnd: string;
  backdateUntil: string | null;
};
type BreakGlass = {
  id: string;
  reason: string;
  status: string;
  startsAt: string;
  endsAt: string;
};

export default async function GovernancePage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("settings");
  const session = await getSession();
  const canFinance = can(session?.user, "finance.write");
  const canUsers = can(session?.user, "users.write");

  const [sod, thresholds, locks, glasses] = await Promise.all([
    apiServer<SodRule[]>(`/companies/${companyId}/governance/sod-rules`, {
      companyId,
    }).catch(() => []),
    apiServer<Threshold[]>(`/companies/${companyId}/governance/thresholds`, {
      companyId,
    }).catch(() => []),
    apiServer<PeriodLock[]>(
      `/companies/${companyId}/governance/period-locks`,
      { companyId },
    ).catch(() => []),
    apiServer<BreakGlass[]>(
      `/companies/${companyId}/governance/break-glass`,
      { companyId },
    ).catch(() => []),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("governanceTitle")}
        description={t("governanceDesc")}
        actions={
          <Button href={`/c/${companyId}/settings`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">{t("sodTitle")}</h3>
        {sod.length === 0 ? (
          <EmptyState message={t("sodEmpty")} />
        ) : (
          <ul className="space-y-1 text-sm">
            {sod.map((r) => (
              <li key={r.id} className="font-mono text-xs">
                {r.permissionCodeA} × {r.permissionCodeB}
                {r.label ? ` — ${r.label}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">{t("thresholdTitle")}</h3>
        {canFinance ? (
          <form
            action={saveApprovalThreshold.bind(null, companyId)}
            className="grid gap-3 md:grid-cols-2"
          >
            <Select
              name="actionType"
              label={t("thresholdAction")}
              required
              showPlaceholderOption={false}
              options={[
                { value: "PETTY_CASH", label: "PETTY_CASH" },
                { value: "DISCOUNT", label: "DISCOUNT" },
                { value: "EXPENSE", label: "EXPENSE" },
                { value: "SHIFT_VARIANCE", label: "SHIFT_VARIANCE" },
              ]}
            />
            <Input name="maxAmount" label={t("thresholdMax")} required />
            <Input
              name="requiredPermission"
              label={t("thresholdPerm")}
              defaultValue="finance.write"
              required
            />
            <Input
              name="escalatePermission"
              label={t("thresholdEscalate")}
              defaultValue="finance.approve"
            />
            <div className="md:col-span-2">
              <Button type="submit">{t("thresholdSave")}</Button>
            </div>
          </form>
        ) : null}
        <ul className="space-y-1 text-sm">
          {thresholds.map((th) => (
            <li key={th.id}>
              {th.actionType}: ≤ {th.maxAmount} {th.currency} →{" "}
              {th.requiredPermission}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">{t("periodTitle")}</h3>
        {canFinance ? (
          <form
            action={lockFinancialPeriod.bind(null, companyId)}
            className="grid gap-3 md:grid-cols-2"
          >
            <Input
              name="periodStart"
              label={t("periodStart")}
              type="date"
              required
            />
            <Input
              name="periodEnd"
              label={t("periodEnd")}
              type="date"
              required
            />
            <Input
              name="backdateUntil"
              label={t("periodBackdateUntil")}
              type="datetime-local"
            />
            <Textarea name="notes" label={t("bhNotes")} />
            <div className="md:col-span-2">
              <Button type="submit">{t("periodLock")}</Button>
            </div>
          </form>
        ) : null}
        <ul className="space-y-1 text-sm">
          {locks.map((l) => (
            <li key={l.id}>
              {l.periodStart.slice(0, 10)} → {l.periodEnd.slice(0, 10)}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">{t("breakGlassTitle")}</h3>
        {canUsers ? (
          <form
            action={openBreakGlass.bind(null, companyId)}
            className="grid gap-3"
          >
            <Textarea name="reason" label={t("breakGlassReason")} required />
            <Input
              name="durationMinutes"
              label={t("breakGlassMinutes")}
              type="number"
              defaultValue="60"
            />
            <Button type="submit">{t("breakGlassOpen")}</Button>
          </form>
        ) : null}
        <ul className="space-y-2 text-sm">
          {glasses.map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <span>
                <StatusBadge status={g.status} /> {g.reason.slice(0, 80)}
              </span>
              {g.status === "ACTIVE" && canUsers ? (
                <ActionForm
                  label={t("breakGlassRevoke")}
                  action={revokeBreakGlass.bind(null, companyId, g.id)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
