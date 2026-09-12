import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      {/* Animation only on title — transform on this wrapper would break
          position:fixed modals rendered inside `actions` (CreateFormDialog). */}
      <div className="animate-fade-up space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-[var(--muted-foreground)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="relative z-[1] flex flex-wrap gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
