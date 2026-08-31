"use client";

import { ActionForm } from "@/components/erp/ActionForm";
import { EmployeeStatusListFilter } from "@/components/erp/EmployeeStatusListFilter";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { decideLeave } from "../actions";

export type LeaveListRow = {
  id: string;
  employeeName: string;
  leaveType: string;
  periodLabel: string;
  requestedDays: string;
  status: string;
};

export function LeavesTable({
  companyId,
  rows,
  canWrite,
  labels,
}: {
  companyId: string;
  rows: LeaveListRow[];
  canWrite: boolean;
  labels: {
    employee: string;
    type: string;
    period: string;
    daysCol: string;
    status: string;
    action: string;
    approve: string;
    reject: string;
    search: string;
    searchPlaceholder: string;
    allStatuses: string;
    emptyAll: string;
    emptyFiltered: string;
    statusPending: string;
    statusApproved: string;
    statusRejected: string;
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
                <th className="px-2 py-2 font-medium">{labels.type}</th>
                <th className="px-2 py-2 font-medium">{labels.period}</th>
                <th className="px-2 py-2 font-medium">{labels.daysCol}</th>
                <th className="px-2 py-2 font-medium">{labels.status}</th>
                <th className="px-2 py-2 font-medium">{labels.action}</th>
              </tr>
            </thead>
            <tbody>
              {filteredIds.map((id) => {
                const l = byId.get(id);
                if (!l) return null;
                return (
                  <tr
                    key={l.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-2 py-2">{l.employeeName || "—"}</td>
                    <td className="px-2 py-2">{l.leaveType}</td>
                    <td className="px-2 py-2">{l.periodLabel}</td>
                    <td className="px-2 py-2">{l.requestedDays}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="px-2 py-2">
                      {canWrite && l.status === "PENDING" ? (
                        <div className="flex flex-wrap gap-1">
                          <ActionForm
                            label={labels.approve}
                            variant="primary"
                            action={decideLeave.bind(
                              null,
                              companyId,
                              l.id,
                              "APPROVED",
                            )}
                          />
                          <ActionForm
                            label={labels.reject}
                            variant="danger"
                            action={decideLeave.bind(
                              null,
                              companyId,
                              l.id,
                              "REJECTED",
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
