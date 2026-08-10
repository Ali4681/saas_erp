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
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createCategory } from "../actions";

type Category = {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  status: string;
};

export default async function CategoriesPage({
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

  const categories = await apiServer<Category[]>(
    `/companies/${companyId}/inventory/categories`,
    { companyId },
  ).catch(() => []);

  const byId = new Map(categories.map((c) => [c.id, c]));
  const create = createCategory.bind(null, companyId);

  const sorted = [...categories].sort((a, b) => {
    const aParent = a.parentId ? byId.get(a.parentId)?.name ?? "" : "";
    const bParent = b.parentId ? byId.get(b.parentId)?.name ?? "" : "";
    return `${aParent}/${a.name}`.localeCompare(`${bParent}/${b.name}`);
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Item categories"
        description="Nested categories via parent"
        actions={
          <Button href={`/c/${companyId}/inventory`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog title="New category" triggerLabel="Add category">
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Input name="name" label={t("name")} required />
            <Input name="code" label={t("code")} />
            <Select
              name="parentId"
              label="Parent category"
              placeholder={t("optional")}
              options={categories.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
            />
            <div className="md:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {sorted.length === 0 ? (
          <EmptyState message="No categories" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("name")}</th>
                  <th className="px-2 py-2 font-medium">{t("code")}</th>
                  <th className="px-2 py-2 font-medium">Parent</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => {
                  const parent = c.parentId ? byId.get(c.parentId) : null;
                  const indent = c.parentId ? "ps-4" : "";
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className={`px-2 py-2 font-medium ${indent}`}>
                        {c.parentId ? "↳ " : ""}
                        {c.name}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">
                        {c.code ?? "—"}
                      </td>
                      <td className="px-2 py-2">{parent?.name ?? "—"}</td>
                      <td className="px-2 py-2">
                        <StatusBadge status={c.status} />
                      </td>
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
