import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { ActionForm } from "@/components/erp/ActionForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { ensureTemplates } from "../actions";

type Tpl = { id: string; code: string; name: string; industryKey?: string | null };
type InvTpl = { id: string; code: string; name: string; layoutKind: string };

export default async function LabelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("inventory");
  const session = await getSession();
  const canWrite = can(session?.user, "inventory.write");
  const [labels, invoices] = await Promise.all([
    apiServer<Tpl[]>(`/companies/${companyId}/inventory/label-templates`, { companyId }).catch(
      () => [],
    ),
    apiServer<InvTpl[]>(`/companies/${companyId}/inventory/invoice-templates`, {
      companyId,
    }).catch(() => []),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("labelsTitle")}
        actions={<Button href={`/c/${companyId}/inventory`} variant="secondary">{t("back")}</Button>}
      />
      <FlashFromSearch searchParams={flash} />
      {canWrite ? (
        <ActionForm
          action={ensureTemplates.bind(null, companyId)}
          label={t("ensureTemplates")}
        />
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <p className="font-semibold">{t("labelTemplates")}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {labels.map((l) => (
              <li key={l.id}>
                {l.code} — {l.name} {l.industryKey ? `(${l.industryKey})` : ""}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <p className="font-semibold">{t("invoiceTemplates")}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {invoices.map((l) => (
              <li key={l.id}>
                {l.code} — {l.name} [{l.layoutKind}]
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
