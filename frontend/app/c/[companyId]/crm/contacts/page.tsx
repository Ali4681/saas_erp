import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/Textarea";
import { can } from "@/lib/permissions";
import { getSession } from "@/lib/auth/session";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";
import { createContact } from "../actions";

type Contact = {
  id: string;
  name: string;
  contactType: string;
  status: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
};

export default async function ContactsPage({
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
  const session = await getSession();
  const canWrite = can(session?.user, "crm.write");

  const contacts = await apiServer<Contact[]>(
    `/companies/${companyId}/crm/contacts`,
    { companyId },
  ).catch(() => []);

  const create = createContact.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("contacts.title")}
        description={t("contacts.description")}
        actions={
          <Button href={`/c/${companyId}/crm`} variant="secondary">
            CRM
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("contacts.newTitle")}
          triggerLabel={t("contacts.add")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Select
              name="contactType"
              label={t("type")}
              required
              options={[
                { value: "CUSTOMER", label: t("contacts.customerType") },
                { value: "LEAD", label: t("contacts.leadType") },
              ]}
            />
            <Input name="name" label={t("name")} required />
            <Input name="companyName" label={t("contacts.companyName")} />
            <Input name="email" label={t("email")} type="email" />
            <Input name="phone" label={t("phone")} />
            <Input name="source" label={t("contacts.source")} />
            <div className="md:col-span-2">
              <Textarea name="notes" label={t("notes")} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {contacts.length === 0 ? (
          <EmptyState message={t("contacts.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-right text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("name")}</th>
                  <th className="px-2 py-2 font-medium">{t("type")}</th>
                  <th className="px-2 py-2 font-medium">{t("communication")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("createdAt")}</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {c.companyName ?? "—"}
                      </p>
                    </td>
                    <td className="px-2 py-2">{c.contactType}</td>
                    <td className="px-2 py-2">
                      <p>{c.email ?? "—"}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {c.phone ?? ""}
                      </p>
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-2 py-2">{formatDate(c.createdAt)}</td>
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
