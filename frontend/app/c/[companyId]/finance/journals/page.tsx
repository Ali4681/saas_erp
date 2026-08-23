import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";

type Journal = {
  id: string;
  entryType: string;
  entryDate: string;
  memo: string | null;
  status: string;
};

export default async function JournalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("finance");
  const { formatDate } = await getFormatters();

  const journals = await apiServer<Journal[]>(
    `/companies/${companyId}/finance/journals`,
    { companyId },
  ).catch(() => []);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("journals")}
        actions={
          <Button href={`/c/${companyId}/finance`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />
      <p className="text-sm text-[var(--color-muted)]">{t("journalsHint")}</p>

      <Card>
        {journals.length === 0 ? (
          <EmptyState message={t("journalsEmpty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("type")}</th>
                  <th className="px-2 py-2 font-medium">{t("date")}</th>
                  <th className="px-2 py-2 font-medium">{t("memo")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {journals.map((j) => (
                  <tr
                    key={j.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2">{j.entryType}</td>
                    <td className="px-2 py-2">{formatDate(j.entryDate)}</td>
                    <td className="px-2 py-2">{j.memo ?? "—"}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={j.status} />
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
