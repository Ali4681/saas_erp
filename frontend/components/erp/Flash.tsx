"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";

function FlashToastInner({
  ok,
  error,
}: {
  ok?: string;
  error?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (!ok && !error) return;
    fired.current = true;

    if (error) toast.error(error);
    else if (ok) toast.success(ok);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("ok");
    params.delete("error");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [ok, error, pathname, router, searchParams]);

  return null;
}

/** Shows server redirect flash (?ok= / ?error=) as toast and clears query params. */
export function FlashFromSearch({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string };
}) {
  return (
    <Suspense fallback={null}>
      <FlashToastInner ok={searchParams.ok} error={searchParams.error} />
    </Suspense>
  );
}

export function ModuleHub({
  title,
  description,
  links,
}: {
  title: string;
  description?: string;
  links: Array<{ href: string; label: string; hint?: string }>;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-accent)]"
          >
            <p className="font-medium">{link.label}</p>
            {link.hint ? (
              <p className="mt-1 text-xs text-[var(--color-muted)]">{link.hint}</p>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
