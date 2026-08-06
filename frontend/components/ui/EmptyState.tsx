export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/40 px-4 py-10 text-center">
      <p className="text-sm text-[var(--muted-foreground)]">{message}</p>
    </div>
  );
}
