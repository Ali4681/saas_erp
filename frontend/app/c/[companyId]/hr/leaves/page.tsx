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
import { createLeave } from "../actions";
import { LeavesTable } from "./LeavesTable";

type Employee = { id: string; fullName: string; employeeNumber: string };
type Leave = {
  id: string;
  leaveType: string;
  status: string;
  startsOn: string;
  endsOn: string;
  requestedDays: string | number;
  reason: string | null;
  employee?: { fullName: string } | null;
};

export default async function LeavesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("hr");
  const { formatDate } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "hr.write");

  const [leaves, employees] = await Promise.all([
    apiServer<Leave[]>(`/companies/${companyId}/hr/leaves`, {
      companyId,
    }).catch(() => []),
    apiServer<Employee[]>(`/companies/${companyId}/hr/employees`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createLeave.bind(null, companyId);
  const rows = leaves.map((l) => ({
    id: l.id,
    employeeName: l.employee?.fullName ?? "",
    leaveType: l.leaveType,
    periodLabel: `${formatDate(l.startsOn)} → ${formatDate(l.endsOn)}`,
    requestedDays: String(l.requestedDays),
    status: l.status,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("leavesTitle")}
        actions={
          <Button href={`/c/${companyId}/hr`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("leaveRequest")}
          triggerLabel={t("leaveRequest")}
        >
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
            <Select
              name="leaveType"
              label={t("type")}
              required
              options={[
                { value: "ANNUAL", label: t("leaveAnnual") },
                { value: "SICK", label: t("leaveSick") },
                { value: "UNPAID", label: t("leaveUnpaid") },
                { value: "EMERGENCY", label: t("leaveEmergency") },
                { value: "OTHER", label: t("leaveOther") },
              ]}
            />
            <Input name="startsOn" label={t("from")} type="date" required />
            <Input name="endsOn" label={t("to")} type="date" required />
            <Input
              name="requestedDays"
              label={t("days")}
              required
              defaultValue="1"
            />
            <div className="md:col-span-2">
              <Textarea name="reason" label={t("reason")} required />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{t("submit")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        <LeavesTable
          companyId={companyId}
          rows={rows}
          canWrite={canWrite}
          labels={{
            employee: t("employee"),
            type: t("type"),
            period: t("period"),
            daysCol: t("daysCol"),
            status: t("status"),
            action: t("action"),
            approve: t("approve"),
            reject: t("reject"),
            search: t("searchEmployee"),
            searchPlaceholder: t("searchEmployeePlaceholder"),
            allStatuses: t("allStatuses"),
            emptyAll: t("emptyLeaves"),
            emptyFiltered: t("emptyFiltered"),
            statusPending: t("statusPending"),
            statusApproved: t("statusApproved"),
            statusRejected: t("statusRejected"),
            statusCancelled: t("statusCancelled"),
          }}
        />
      </Card>
    </div>
  );
}
