import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/Textarea";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createSupplier } from "../actions";

type Supplier = {
  id: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  taxNumber: string | null;
};

export default async function SuppliersPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("purchasing");
  const session = await getSession();
  const canWrite = can(session?.user, "purchasing.write");

  const suppliers = await apiServer<Supplier[]>(
    `/companies/${companyId}/purchasing/suppliers`,
    { companyId },
  ).catch(() => []);

  const create = createSupplier.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("suppliers.title")}
        actions={
          <Button href={`/c/${companyId}/purchasing`} variant="secondary">
            {t("back")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("suppliers.newTitle")}
          triggerLabel={t("suppliers.add")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Input name="name" label={t("name")} required />
            <Input name="code" label={t("suppliers.code")} />
            <Input name="taxNumber" label={t("suppliers.taxNumber")} />
            <Input name="email" label={t("email")} type="email" />
            <Input name="phone" label={t("phone")} />
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
        {suppliers.length === 0 ? (
          <EmptyState message={t("suppliers.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("name")}</th>
                  <th className="px-2 py-2 font-medium">{t("suppliers.code")}</th>
                  <th className="px-2 py-2 font-medium">{t("communication")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-medium">{s.name}</td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {s.code ?? "—"}
                    </td>
                    <td className="px-2 py-2">
                      <p>{s.email ?? "—"}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {s.phone ?? ""}
                      </p>
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={s.status} />
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
