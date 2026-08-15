import { Badge } from "@/components/ui/Badge";

const tones: Record<
  string,
  "success" | "warning" | "danger" | "info" | "secondary"
> = {
  ACTIVE: "success",
  TRIALING: "info",
  SUSPENDED: "warning",
  CANCELLED: "secondary",
  CLOSED: "secondary",
  DRAFT: "secondary",
  ENABLED: "success",
  DISABLED: "secondary",
  INVITED: "info",
  ERROR: "danger",
  FAILED: "danger",
  SUCCEEDED: "success",
  ok: "success",
  APPROVED: "success",
  PENDING: "warning",
  NOT_STARTED: "secondary",
  IN_PROGRESS: "info",
  AWAITING_EMPLOYEE: "warning",
  PENDING_APPROVAL: "warning",
  DOCUMENTED: "success",
  REJECTED_OR_MODIFICATION: "danger",
};

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  return <Badge variant={tones[status] ?? "secondary"}>{label ?? status}</Badge>;
}
