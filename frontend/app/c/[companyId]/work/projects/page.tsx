import { getTranslations } from "next-intl/server";
import Link from "next/link";
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
import { getFormatters } from "@/lib/format-server";
import { createProject } from "../actions";

type Contact = { id: string; name: string };
type Project = {
  id: string;
  code: string;
  name: string;
  status: string;
  budget: string | null;
  currency: string;
  progressPercent: string | number;
  _count?: { tasks: number };
  phases?: unknown[];
};

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("work");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "work.write");

  const [projects, contacts] = await Promise.all([
    apiServer<Project[]>(`/companies/${companyId}/work/projects`, {
      companyId,
    }).catch(() => []),
    apiServer<Contact[]>(`/companies/${companyId}/crm/contacts`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createProject.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("projectsTitle")}
        actions={
          <Button href={`/c/${companyId}/work`} variant="secondary">
            {t("projects")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("newProject")}
          triggerLabel={t("addProject")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Input name="code" label={t("code")} required />
            <Input name="name" label={t("name")} required />
            <Select
              name="crmContactId"
              label={t("crmContact")}
              placeholder={t("optional")}
              options={contacts.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Input name="budget" label={t("budget")} />
            <Input name="startsOn" label={t("startsOn")} type="date" />
            <Input name="endsOn" label={t("endsOn")} type="date" />
            <div className="md:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {projects.length === 0 ? (
          <EmptyState message={t("emptyProjects")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-right text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("code")}</th>
                  <th className="px-2 py-2 font-medium">{t("name")}</th>
                  <th className="px-2 py-2 font-medium">{t("progress")}</th>
                  <th className="px-2 py-2 font-medium">{t("tasks")}</th>
                  <th className="px-2 py-2 font-medium">{t("budget")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-mono text-xs">{p.code}</td>
                    <td className="px-2 py-2">
                      <Link
                        href={`/c/${companyId}/work/projects/${p.id}`}
                        className="font-medium text-[var(--color-accent)] underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2">{p.progressPercent}%</td>
                    <td className="px-2 py-2">{p._count?.tasks ?? 0}</td>
                    <td className="px-2 py-2">
                      {formatMoney(p.budget, p.currency)}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={p.status} />
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
