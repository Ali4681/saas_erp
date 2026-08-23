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
import { createTicket, setTicketStatus } from "../actions";

type Contact = { id: string; name: string };
type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  contact: { id: string; name: string } | null;
  _count: { comments: number };
  createdAt: string;
  slaDeadline: string | null;
};

export default async function TicketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string; status?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("crm");
  const tCommon = await getTranslations("common");
  const session = await getSession();
  const canWrite = can(session?.user, "crm.write");

  const [tickets, contacts] = await Promise.all([
    apiServer<Ticket[]>(
      `/companies/${companyId}/crm/tickets${flash.status ? `?status=${flash.status}` : ""}`,
      { companyId },
    ).catch(() => []),
    apiServer<Contact[]>(`/companies/${companyId}/crm/contacts`, { companyId }).catch(() => []),
  ]);

  const create = createTicket.bind(null, companyId);

  const priorityColor: Record<string, string> = {
    LOW: "var(--color-muted)",
    NORMAL: "inherit",
    HIGH: "var(--color-warning)",
    URGENT: "var(--color-danger)",
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("tickets.title")}
        actions={
          <Button href={`/c/${companyId}/crm`} variant="secondary">
            CRM
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite && (
        <CreateFormDialog title={t("tickets.newTitle")} triggerLabel={t("tickets.add")}>
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Select
              name="contactId"
              label={t("contact")}
              required
              placeholder={tCommon("select")}
              options={contacts.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Input name="subject" label={t("subject")} required />
            <Select
              name="priority"
              label={t("tickets.priority")}
              defaultValue="NORMAL"
              options={[
                { value: "LOW", label: t("tickets.low") },
                { value: "NORMAL", label: t("tickets.normal") },
                { value: "HIGH", label: t("tickets.high") },
                { value: "URGENT", label: t("tickets.urgent") },
              ]}
            />
            <Input name="slaDeadline" label={t("tickets.slaDeadline")} type="datetime-local" />
            <Select
              name="ticketKind"
              label={t("tickets.kind")}
              defaultValue="SUPPORT"
              options={[
                { value: "SUPPORT", label: t("tickets.support") },
                { value: "WARRANTY", label: t("tickets.warranty") },
                { value: "MAINTENANCE", label: t("tickets.maintenance") },
              ]}
            />
            <Input name="itemId" label={t("tickets.itemId")} />
            <Input
              name="warrantyExpiresOn"
              label={t("tickets.warrantyExpiresOn")}
              type="date"
            />
            <div className="md:col-span-2">
              <Textarea name="description" label={t("notes")} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      )}

      <Card>
        {tickets.length === 0 ? (
          <EmptyState message={t("tickets.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium text-start">{t("tickets.number")}</th>
                  <th className="px-2 py-2 font-medium text-start">{t("subject")}</th>
                  <th className="px-2 py-2 font-medium text-start">{t("customer")}</th>
                  <th className="px-2 py-2 font-medium text-start">{t("tickets.priority")}</th>
                  <th className="px-2 py-2 font-medium text-start">{t("status")}</th>
                  <th className="px-2 py-2 font-medium text-start">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-2 py-2 font-mono text-xs">{row.ticketNumber}</td>
                    <td className="px-2 py-2 font-medium">{row.subject}</td>
                    <td className="px-2 py-2">{row.contact?.name ?? "—"}</td>
                    <td className="px-2 py-2" style={{ color: priorityColor[row.priority] }}>
                      {row.priority}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-2 py-2 flex gap-1">
                      {canWrite && row.status === "OPEN" && (
                        <ActionForm
                          label={t("tickets.startProgress")}
                          action={setTicketStatus.bind(null, companyId, row.id, "IN_PROGRESS")}
                        />
                      )}
                      {canWrite && row.status === "IN_PROGRESS" && (
                        <ActionForm
                          label={t("tickets.resolve")}
                          action={setTicketStatus.bind(null, companyId, row.id, "RESOLVED")}
                        />
                      )}
                      {canWrite && row.status === "RESOLVED" && (
                        <ActionForm
                          label={t("tickets.close")}
                          action={setTicketStatus.bind(null, companyId, row.id, "CLOSED")}
                        />
                      )}
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
