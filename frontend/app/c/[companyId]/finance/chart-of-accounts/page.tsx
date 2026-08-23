import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { ActionForm } from "@/components/erp/ActionForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { ensureChartOfAccounts } from "../actions";

type GlAccount = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  accountType: string;
  level?: number;
  isPostable: boolean;
  isContra: boolean;
};

export default async function ChartOfAccountsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("finance");
  const session = await getSession();
  const canWrite = can(session?.user, "finance.write");

  const accounts = await apiServer<GlAccount[]>(
    `/companies/${companyId}/finance/chart-of-accounts`,
    { companyId },
  ).catch(() => []);

  const ensure = ensureChartOfAccounts.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("chartOfAccounts")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canWrite ? (
              <ActionForm label={t("ensureCoa")} variant="primary" action={ensure} />
            ) : null}
            <Button href={`/c/${companyId}/finance`} variant="secondary">
              {t("title")}
            </Button>
          </div>
        }
      />
      <FlashFromSearch searchParams={flash} />
      <p className="text-sm text-[var(--color-muted)]">{t("chartOfAccountsHint")}</p>

      <Card>
        {accounts.length === 0 ? (
          <EmptyState message={t("coaEmpty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("accountCode")}</th>
                  <th className="px-2 py-2 font-medium">{t("nameAr")}</th>
                  <th className="px-2 py-2 font-medium">{t("nameEn")}</th>
                  <th className="px-2 py-2 font-medium">{t("type")}</th>
                  <th className="px-2 py-2 font-medium">{t("postable")}</th>
                  <th className="px-2 py-2 font-medium">{t("contra")}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const level = Math.max(1, a.level ?? 1);
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-[var(--color-border)] last:border-0"
                    >
                      <td
                        className="px-2 py-2 font-mono text-xs"
                        style={{ paddingInlineStart: `${(level - 1) * 16 + 8}px` }}
                      >
                        {a.code}
                      </td>
                      <td className="px-2 py-2">{a.nameAr}</td>
                      <td className="px-2 py-2">{a.nameEn}</td>
                      <td className="px-2 py-2">{a.accountType}</td>
                      <td className="px-2 py-2">{a.isPostable ? t("yes") : t("no")}</td>
                      <td className="px-2 py-2">{a.isContra ? t("yes") : t("no")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
