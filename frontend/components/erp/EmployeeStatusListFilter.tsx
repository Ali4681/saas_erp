"use client";

import {
  useDeferredValue,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export type StatusFilterOption = { value: string; label: string };

export function EmployeeStatusListFilter({
  rows,
  statusOptions,
  labels,
  emptyAllMessage,
  children,
}: {
  rows: Array<{ id: string; employeeName: string; status: string }>;
  statusOptions: StatusFilterOption[];
  labels: {
    search: string;
    searchPlaceholder: string;
    status: string;
    allStatuses: string;
    emptyFiltered: string;
  };
  emptyAllMessage: string;
  children: (filteredIds: string[]) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filteredIds = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return rows
      .filter((row) => {
        const nameOk = !q || row.employeeName.toLowerCase().includes(q);
        const statusOk = !status || row.status === status;
        return nameOk && statusOk;
      })
      .map((row) => row.id);
  }, [rows, deferredQuery, status]);

  if (rows.length === 0) {
    return <EmptyState message={emptyAllMessage} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label={labels.search}
          placeholder={labels.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        <Select
          label={labels.status}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          showPlaceholderOption={false}
          options={[
            { value: "", label: labels.allStatuses },
            ...statusOptions,
          ]}
        />
      </div>
      {filteredIds.length === 0 ? (
        <EmptyState message={labels.emptyFiltered} />
      ) : (
        children(filteredIds)
      )}
    </div>
  );
}
