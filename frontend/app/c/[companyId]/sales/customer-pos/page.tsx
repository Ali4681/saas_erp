import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { ActionForm } from "@/components/erp/ActionForm";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { convertCustomerPo, createCustomerPo } from "../actions";

type Contact = { id: string; name: string };
type Po = {
  id: string;
  poNumber: string;
  status: string;
  contact?: { name: string } | null;
};

export default async function CustomerPoPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("sales");
  const tCommon = await getTranslations("common");
  const session = await getSession();
  const canWrite = can(session?.user, "sales.write");
  const [rows, contacts] = await Promise.all([
    apiServer<Po[]>(`/companies/${companyId}/sales/customer-pos`, { companyId }).catch(() => []),
    apiServer<Contact[]>(`/companies/${companyId}/crm/contacts`, { companyId }).catch(() => []),
  ]);
  const create = createCustomerPo.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("customerPo.title")}
        actions={<Button href={`/c/${companyId}/sales`} variant="secondary">{t("back")}</Button>}
      />
      <FlashFromSearch searchParams={flash} />
      {canWrite ? (
        <CreateFormDialog title={t("customerPo.newTitle")} triggerLabel={t("customerPo.add")}>
          <form action={create} className="grid gap-3">
            <Select
              name="contactId"
              label={t("customer")}
              required
              placeholder={tCommon("select")}
              options={contacts.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Input name="poNumber" label={t("customerPo.number")} required />
            <Input name="description" label={t("lineDescription")} required />
            <Input name="quantity" label={t("quantity")} defaultValue="1" />
            <Input name="unitPrice" label={t("unitPrice")} required />
            <Button type="submit">{t("create")}</Button>
          </form>
        </CreateFormDialog>
      ) : null}
      <Card>
        {rows.length === 0 ? (
          <EmptyState message={t("customerPo.empty")} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <th className="px-2 py-2 text-start">{t("customerPo.number")}</th>
                <th className="px-2 py-2 text-start">{t("customer")}</th>
                <th className="px-2 py-2 text-start">{t("status")}</th>
                <th className="px-2 py-2 text-start">{t("action")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-2 py-2">{row.poNumber}</td>
                  <td className="px-2 py-2">{row.contact?.name ?? "—"}</td>
                  <td className="px-2 py-2">{row.status}</td>
                  <td className="px-2 py-2">
                    {canWrite && row.status !== "CLOSED" ? (
                      <ActionForm
                        label={t("customerPo.convert")}
                        action={convertCustomerPo.bind(null, companyId, row.id)}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
