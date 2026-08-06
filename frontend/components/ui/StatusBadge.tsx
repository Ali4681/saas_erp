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
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={tones[status] ?? "secondary"}>{status}</Badge>;
}
