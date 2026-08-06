import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createCategory } from "../actions";

type Category = {
  id: string;
  name: string;
  code: string | null;
  status?: string;
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
  const t = await getTranslations("notebook");
  const session = await getSession();
  const canWrite = can(session?.user, "notebook.write");

  const categories = await apiServer<Category[]>(
    `/companies/${companyId}/notebook/categories`,
    { companyId },
  ).catch(() => []);

  const create = createCategory.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("categoriesTitle")}
        actions={
          <Button href={`/c/${companyId}/notebook`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("newCategory")}
          triggerLabel={t("addCategory")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Input name="name" label={t("name")} required />
            <Input name="code" label={t("code")} />
            <div className="md:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {categories.length === 0 ? (
          <EmptyState message={t("emptyCategories")} />
        ) : (
          <ul className="divide-y divide-[var(--color-border)] text-sm">
            {categories.map((c) => (
              <li key={c.id} className="flex justify-between gap-2 py-2">
                <span className="font-medium">{c.name}</span>
                <span className="font-mono text-xs text-[var(--color-muted)]">
                  {c.code ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
