import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { createAdvance } from "../actions";
import { AdvancesTable } from "./AdvancesTable";

type Employee = { id: string; fullName: string; employeeNumber: string };
type Advance = {
  id: string;
  amount: string;
  currency: string;
  status: string;
  reason: string | null;
  requestedAt: string;
  employee?: {
    id?: string;
    userId?: string | null;
    fullName: string;
    employeeNumber: string;
  } | null;
};

export default async function AdvancesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("hr");
  const { formatDate, formatMoney } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "hr.write");
  const currentUserId = session?.user?.id;

  const [advances, employees] = await Promise.all([
    apiServer<Advance[]>(`/companies/${companyId}/hr/advances`, {
      companyId,
    }).catch(() => []),
    apiServer<Employee[]>(`/companies/${companyId}/hr/employees`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createAdvance.bind(null, companyId);
  const rows = advances.map((a) => ({
    id: a.id,
    employeeName: a.employee?.fullName ?? "",
    employeeUserId: a.employee?.userId ?? null,
    amountLabel: formatMoney(a.amount, a.currency),
    dateLabel: formatDate(a.requestedAt),
    reason: a.reason ?? "—",
    status: a.status,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("advancesTitle")}
        description={t("advancesDesc")}
        actions={
          <Button href={`/c/${companyId}/hr`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog title={t("newAdvance")} triggerLabel={t("addAdvance")}>
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Select
              name="employeeId"
              label={t("employee")}
              required
              placeholder={t("selectPlaceholder")}
              options={employees.map((e) => ({
                value: e.id,
                label: `${e.employeeNumber} — ${e.fullName}`,
              }))}
            />
            <Input name="amount" label={t("amount")} required />
            <div className="md:col-span-2">
              <Textarea name="reason" label={t("reason")} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{t("submit")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        <AdvancesTable
          companyId={companyId}
          rows={rows}
          canWrite={canWrite}
          currentUserId={currentUserId}
          labels={{
            employee: t("employee"),
            amount: t("amount"),
            date: t("date"),
            reason: t("reason"),
            status: t("status"),
            action: t("action"),
            approve: t("approve"),
            reject: t("reject"),
            markPaid: t("markPaid"),
            cancelAdvance: t("cancelAdvance"),
            advanceCannotSelfApprove: t("advanceCannotSelfApprove"),
            search: t("searchEmployee"),
            searchPlaceholder: t("searchEmployeePlaceholder"),
            allStatuses: t("allStatuses"),
            emptyAll: t("emptyAdvances"),
            emptyFiltered: t("emptyFiltered"),
            statusPending: t("statusPending"),
            statusApproved: t("statusApproved"),
            statusRejected: t("statusRejected"),
            statusPaid: t("statusPaid"),
            statusCancelled: t("statusCancelled"),
          }}
        />
      </Card>
    </div>
  );
}
