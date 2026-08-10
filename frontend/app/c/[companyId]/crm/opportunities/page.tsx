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
import { getFormatters } from "@/lib/format-server";
import { createOpportunity, setOpportunityStatus } from "../actions";

type Contact = { id: string; name: string };
type Opportunity = {
  id: string;
  title: string;
  status: string;
  estimatedValue: string | null;
  currency: string;
  contact?: { name: string } | null;
};

export default async function OpportunitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("crm");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const tCommon = await getTranslations("common");
  const session = await getSession();
  const canWrite = can(session?.user, "crm.write");

  const [opportunities, contacts] = await Promise.all([
    apiServer<Opportunity[]>(`/companies/${companyId}/crm/opportunities`, {
      companyId,
    }).catch(() => []),
    apiServer<Contact[]>(`/companies/${companyId}/crm/contacts`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createOpportunity.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("opportunities.title")}
        actions={
          <Button href={`/c/${companyId}/crm`} variant="secondary">
            CRM
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("opportunities.newTitle")}
          triggerLabel={t("opportunities.add")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Select
              name="contactId"
              label={t("contact")}
              required
              placeholder={tCommon("select")}
              options={contacts.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Input name="title" label={t("titleField")} required />
            <Input
              name="estimatedValue"
              label={t("opportunities.estimatedValue")}
            />
            <Input name="currency" label={t("currency")} defaultValue="SAR" />
            <Input
              name="expectedCloseDate"
              label={t("opportunities.expectedCloseDate")}
              type="date"
            />
            <div className="md:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {opportunities.length === 0 ? (
          <EmptyState message={t("opportunities.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("titleField")}</th>
                  <th className="px-2 py-2 font-medium">{t("customer")}</th>
                  <th className="px-2 py-2 font-medium">{t("value")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-medium">{row.title}</td>
                    <td className="px-2 py-2">{row.contact?.name ?? "—"}</td>
                    <td className="px-2 py-2">
                      {formatMoney(row.estimatedValue, row.currency)}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-2 py-2">
                      {canWrite && row.status === "OPEN" ? (
                        <div className="flex flex-wrap gap-1">
                          <ActionForm
                            label={t("opportunities.won")}
                            variant="primary"
                            action={setOpportunityStatus.bind(
                              null,
                              companyId,
                              row.id,
                              "WON",
                            )}
                          />
                          <ActionForm
                            label={t("opportunities.lost")}
                            variant="danger"
                            action={setOpportunityStatus.bind(
                              null,
                              companyId,
                              row.id,
                              "LOST",
                            )}
                          />
                        </div>
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
