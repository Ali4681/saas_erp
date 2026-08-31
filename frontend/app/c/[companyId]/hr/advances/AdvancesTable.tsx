"use client";

import { ActionForm } from "@/components/erp/ActionForm";
import { EmployeeStatusListFilter } from "@/components/erp/EmployeeStatusListFilter";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { decideAdvance } from "../actions";

export type AdvanceListRow = {
  id: string;
  employeeName: string;
  employeeUserId: string | null;
  amountLabel: string;
  dateLabel: string;
  reason: string;
  status: string;
};

export function AdvancesTable({
  companyId,
  rows,
  canWrite,
  currentUserId,
  labels,
}: {
  companyId: string;
  rows: AdvanceListRow[];
  canWrite: boolean;
  currentUserId?: string;
  labels: {
    employee: string;
    amount: string;
    date: string;
    reason: string;
    status: string;
    action: string;
    approve: string;
    reject: string;
    markPaid: string;
    cancelAdvance: string;
    advanceCannotSelfApprove: string;
    search: string;
    searchPlaceholder: string;
    allStatuses: string;
    emptyAll: string;
    emptyFiltered: string;
    statusPending: string;
    statusApproved: string;
    statusRejected: string;
    statusPaid: string;
    statusCancelled: string;
  };
}) {
  const byId = new Map(rows.map((r) => [r.id, r]));

  return (
    <EmployeeStatusListFilter
      rows={rows}
      emptyAllMessage={labels.emptyAll}
      statusOptions={[
        { value: "PENDING", label: labels.statusPending },
        { value: "APPROVED", label: labels.statusApproved },
        { value: "REJECTED", label: labels.statusRejected },
        { value: "PAID", label: labels.statusPaid },
        { value: "CANCELLED", label: labels.statusCancelled },
      ]}
      labels={{
        search: labels.search,
        searchPlaceholder: labels.searchPlaceholder,
        status: labels.status,
        allStatuses: labels.allStatuses,
        emptyFiltered: labels.emptyFiltered,
      }}
    >
      {(filteredIds) => (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                <th className="px-2 py-2 font-medium">{labels.employee}</th>
                <th className="px-2 py-2 font-medium">{labels.amount}</th>
                <th className="px-2 py-2 font-medium">{labels.date}</th>
                <th className="px-2 py-2 font-medium">{labels.reason}</th>
                <th className="px-2 py-2 font-medium">{labels.status}</th>
                <th className="px-2 py-2 font-medium">{labels.action}</th>
              </tr>
            </thead>
            <tbody>
              {filteredIds.map((id) => {
                const a = byId.get(id);
                if (!a) return null;
                const isOwnAdvance =
                  !!currentUserId &&
                  !!a.employeeUserId &&
                  a.employeeUserId === currentUserId;
                const canDecide = canWrite && !isOwnAdvance;
                return (
                  <tr
                    key={a.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-2 py-2">{a.employeeName || "—"}</td>
                    <td className="px-2 py-2">{a.amountLabel}</td>
                    <td className="px-2 py-2">{a.dateLabel}</td>
                    <td className="px-2 py-2">{a.reason}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-2 py-2">
                      {isOwnAdvance &&
                      (a.status === "PENDING" || a.status === "APPROVED") ? (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {labels.advanceCannotSelfApprove}
                        </span>
                      ) : canDecide && a.status === "PENDING" ? (
                        <div className="flex flex-wrap gap-1">
                          <ActionForm
                            label={labels.approve}
                            variant="primary"
                            action={decideAdvance.bind(
                              null,
                              companyId,
                              a.id,
                              "APPROVED",
                            )}
                          />
                          <ActionForm
                            label={labels.reject}
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
                            label={labels.markPaid}
                            variant="primary"
                            action={decideAdvance.bind(
                              null,
                              companyId,
                              a.id,
                              "PAID",
                            )}
                          />
                          <ActionForm
                            label={labels.cancelAdvance}
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
    </EmployeeStatusListFilter>
  );
}
