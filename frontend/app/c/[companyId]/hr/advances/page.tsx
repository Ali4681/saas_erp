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
import { createAdvance, decideAdvance } from "../actions";

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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Salary advances"
        description="On approve, the amount is credited to the employee wallet. Mark paid is optional bookkeeping."
        actions={
          <Button href={`/c/${companyId}/hr`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog title="Request advance" triggerLabel="Add advance">
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
            <Input name="amount" label="Amount" required />
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
        {advances.length === 0 ? (
          <EmptyState message="No advances" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("employee")}</th>
                  <th className="px-2 py-2 font-medium">Amount</th>
                  <th className="px-2 py-2 font-medium">{t("date")}</th>
                  <th className="px-2 py-2 font-medium">{t("reason")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {advances.map((a) => {
                  const isOwnAdvance =
                    !!currentUserId &&
                    !!a.employee?.userId &&
                    a.employee.userId === currentUserId;
                  const canDecide = canWrite && !isOwnAdvance;
                  return (
                  <tr
                    key={a.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-2 py-2">
                      {a.employee?.fullName ?? "—"}
                    </td>
                    <td className="px-2 py-2">
                      {formatMoney(a.amount, a.currency)}
                    </td>
                    <td className="px-2 py-2">{formatDate(a.requestedAt)}</td>
                    <td className="px-2 py-2">{a.reason ?? "—"}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-2 py-2">
                      {isOwnAdvance &&
                      (a.status === "PENDING" || a.status === "APPROVED") ? (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {t("advanceCannotSelfApprove")}
                        </span>
                      ) : canDecide && a.status === "PENDING" ? (
                        <div className="flex flex-wrap gap-1">
                          <ActionForm
                            label={t("approve")}
                            variant="primary"
                            action={decideAdvance.bind(
                              null,
                              companyId,
                              a.id,
                              "APPROVED",
                            )}
                          />
                          <ActionForm
                            label={t("reject")}
                            variant="danger"
                            action={decideAdvance.bind(
                              null,
                              companyId,
                              a.id,
                              "REJECTED",
                            )}
                          />
                        </div>
                      ) : canDecide && a.status === "APPROVED" ? (
                        <div className="flex flex-wrap gap-1">
                          <ActionForm
                            label="Mark paid"
                            variant="primary"
                            action={decideAdvance.bind(
                              null,
                              companyId,
                              a.id,
                              "PAID",
                            )}
                          />
                          <ActionForm
                            label="Cancel"
                            variant="danger"
                            action={decideAdvance.bind(
                              null,
                              companyId,
                              a.id,
                              "CANCELLED",
                            )}
                          />
                        </div>
                      ) : null}
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
