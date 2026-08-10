import Link from "next/link";
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
import { Textarea } from "@/components/ui/Textarea";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { cn } from "@/lib/utils";
import { createActivity, setActivityStatus } from "../actions";

type Contact = { id: string; name: string };
type Activity = {
  id: string;
  activityType: string;
  subject: string;
  status: string;
  scheduledAt: string | null;
  contact?: { name: string } | null;
};

const STATUS_FILTERS = [
  "ALL",
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "MISSED",
] as const;

export default async function ActivitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string; status?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const statusFilter =
    flash.status && flash.status !== "ALL" ? flash.status : undefined;
  const t = await getTranslations("crm");
  const { formatDate } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "crm.write");

  const activitiesQuery = statusFilter
    ? `?status=${encodeURIComponent(statusFilter)}`
    : "";

  const [activities, contacts] = await Promise.all([
    apiServer<Activity[]>(
      `/companies/${companyId}/crm/activities${activitiesQuery}`,
      { companyId },
    ).catch(() => []),
    apiServer<Contact[]>(`/companies/${companyId}/crm/contacts`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createActivity.bind(null, companyId);
  const base = `/c/${companyId}/crm/activities`;

  const statusLabel = (status: string) => {
    switch (status) {
      case "PLANNED":
        return t("activities.planned");
      case "IN_PROGRESS":
        return t("activities.inProgress");
      case "COMPLETED":
        return t("activities.completed");
      case "CANCELLED":
        return t("activities.cancelled");
      case "MISSED":
        return t("activities.missed");
      default:
        return t("activities.filterAll");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("activities.title")}
        actions={
          <Button href={`/c/${companyId}/crm`} variant="secondary">
            CRM
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--muted-foreground)]">
          {t("activities.filterStatus")}:
        </span>
        {STATUS_FILTERS.map((status) => {
          const href =
            status === "ALL" ? base : `${base}?status=${status}`;
          const active =
            (status === "ALL" && !statusFilter) || statusFilter === status;
          return (
            <Link
              key={status}
              href={href}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium",
                active
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)]",
              )}
            >
              {statusLabel(status)}
            </Link>
          );
        })}
      </div>

      {canWrite ? (
        <CreateFormDialog
          title={t("activities.newTitle")}
          triggerLabel={t("activities.add")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Select
              name="activityType"
              label={t("type")}
              required
              options={[
                { value: "CALL", label: t("activities.call") },
                { value: "MEETING", label: t("activities.meeting") },
                { value: "FOLLOW_UP", label: t("activities.followUp") },
                { value: "TASK", label: t("activities.task") },
                { value: "EMAIL", label: t("activities.emailType") },
                { value: "NOTE", label: t("activities.noteType") },
              ]}
            />
            <Input name="subject" label={t("subject")} required />
            <Select
              name="contactId"
              label={t("contact")}
              placeholder={t("optional")}
              options={contacts.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Input
              name="scheduledAt"
              label={t("schedule")}
              type="datetime-local"
            />
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
        {activities.length === 0 ? (
          <EmptyState message={t("activities.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("subject")}</th>
                  <th className="px-2 py-2 font-medium">{t("type")}</th>
                  <th className="px-2 py-2 font-medium">{t("customer")}</th>
                  <th className="px-2 py-2 font-medium">{t("schedule")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-medium">{row.subject}</td>
                    <td className="px-2 py-2">{row.activityType}</td>
                    <td className="px-2 py-2">{row.contact?.name ?? "—"}</td>
                    <td className="px-2 py-2">{formatDate(row.scheduledAt)}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-2 py-2">
                      {canWrite &&
                      row.status !== "COMPLETED" &&
                      row.status !== "CANCELLED" ? (
                        <ActionForm
                          label={t("activities.complete")}
                          action={setActivityStatus.bind(
                            null,
                            companyId,
                            row.id,
                            "COMPLETED",
                          )}
                        />
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
