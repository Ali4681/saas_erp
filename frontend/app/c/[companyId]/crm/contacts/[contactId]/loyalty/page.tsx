import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { canAny } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { earnLoyaltyPoints, redeemLoyaltyPoints, requestLoyaltyOtp } from "../../../actions";

type LoyaltyEvent = {
  id: string;
  direction: string;
  points: string;
  note: string | null;
  createdAt: string;
};

type LoyaltyAccount = {
  id: string;
  pointsBalance: string;
  lifetimePoints: string;
  tierLevel: string;
  events: LoyaltyEvent[];
};

export default async function LoyaltyPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; contactId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId, contactId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("crm");
  const { formatNumber } = await getFormatters();
  const session = await getSession();
  const canWrite = canAny(session?.user, "crm.write", "crm.loyalty");

  const account = await apiServer<LoyaltyAccount>(
    `/companies/${companyId}/crm/contacts/${contactId}/loyalty`,
    { companyId },
  ).catch(() => null);

  const earn = earnLoyaltyPoints.bind(null, companyId, contactId);
  const redeem = redeemLoyaltyPoints.bind(null, companyId, contactId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("loyalty.title")}
        actions={
          <Button href={`/c/${companyId}/crm/contacts`} variant="secondary">
            {t("contacts.title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-[var(--color-muted)]">{t("loyalty.balance")}</p>
          <p className="text-3xl font-bold mt-1">{formatNumber(account?.pointsBalance ?? 0)}</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">{t("loyalty.points")}</p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--color-muted)]">{t("loyalty.lifetime")}</p>
          <p className="text-3xl font-bold mt-1">{formatNumber(account?.lifetimePoints ?? 0)}</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">{t("loyalty.points")}</p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--color-muted)]">{t("loyalty.tier")}</p>
          <p className="text-xl font-semibold mt-1">
            <StatusBadge status={account?.tierLevel ?? "STANDARD"} />
          </p>
        </Card>
      </div>

      {canWrite && (
        <div className="flex gap-3">
          <CreateFormDialog title={t("loyalty.earn")} triggerLabel={t("loyalty.earn")}>
            <form action={earn} className="grid gap-3">
              <Input name="points" label={t("loyalty.points")} type="number" min="1" required />
              <Input name="note" label={t("notes")} />
              <Button type="submit">{t("loyalty.earn")}</Button>
            </form>
          </CreateFormDialog>

          <CreateFormDialog title={t("loyalty.redeem")} triggerLabel={t("loyalty.redeem")}>
            <form action={redeem} className="grid gap-3">
              <Input name="points" label={t("loyalty.points")} type="number" min="1" required />
              <Input name="otpCode" label={t("loyalty.otp")} />
              <Input name="note" label={t("notes")} />
              <Button type="submit" variant="secondary">{t("loyalty.redeem")}</Button>
            </form>
          </CreateFormDialog>
          <form action={requestLoyaltyOtp.bind(null, companyId, contactId)}>
            <Button type="submit" variant="outline">{t("loyalty.sendOtp")}</Button>
          </form>
        </div>
      )}

      <Card>
        <h3 className="text-sm font-semibold mb-3">{t("loyalty.history")}</h3>
        {!account?.events?.length ? (
          <p className="text-sm text-[var(--color-muted)]">{t("loyalty.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium text-start">{t("loyalty.direction")}</th>
                  <th className="px-2 py-2 font-medium text-end">{t("loyalty.points")}</th>
                  <th className="px-2 py-2 font-medium text-start">{t("notes")}</th>
                  <th className="px-2 py-2 font-medium text-start">{t("createdAt")}</th>
                </tr>
              </thead>
              <tbody>
                {account.events.map((ev) => (
                  <tr key={ev.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-2 py-2">
                      <StatusBadge status={ev.direction} />
                    </td>
                    <td className="px-2 py-2 text-end font-mono">{formatNumber(ev.points)}</td>
                    <td className="px-2 py-2 text-[var(--color-muted)]">{ev.note ?? "—"}</td>
                    <td className="px-2 py-2 text-[var(--color-muted)]">
                      {new Date(ev.createdAt).toLocaleDateString()}
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
