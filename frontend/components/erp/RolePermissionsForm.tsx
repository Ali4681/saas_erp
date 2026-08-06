"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/lib/toast";

export type PermOption = {
  id: string;
  code: string;
  module: string;
  action: string;
  description?: string | null;
};

const HIDDEN_MODULES = new Set(["branches"]);

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  permissions: PermOption[];
  companyId?: string;
  initialSelected?: string[];
  initialName?: string;
  initialCode?: string;
  lockCode?: boolean;
  submitLabel?: string;
};

export function RolePermissionsForm({
  action,
  permissions: initialPermissions,
  companyId,
  initialSelected = [],
  initialName = "",
  initialCode = "",
  lockCode = false,
  submitLabel,
}: Props) {
  const t = useTranslations("rolesPage");
  const tCommon = useTranslations("common");
  const resolvedSubmit = submitLabel ?? tCommon("save");
  const [permissions, setPermissions] = useState<PermOption[]>(initialPermissions);
  const [loading, setLoading] = useState(false);
  const loadErrorShown = useRef(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected),
  );

  useEffect(() => {
    if (initialPermissions.length > 0) {
      setPermissions(initialPermissions);
    }
  }, [initialPermissions]);

  useEffect(() => {
    if (permissions.length > 0 || !companyId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/companies/${companyId}/permissions`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            typeof data?.message === "string"
              ? data.message
              : t("loadFailed", { status: res.status }),
          );
        }
        if (!Array.isArray(data)) {
          throw new Error(t("invalidPerms"));
        }
        if (!cancelled) setPermissions(data as PermOption[]);
      })
      .catch((err: unknown) => {
        if (!cancelled && !loadErrorShown.current) {
          loadErrorShown.current = true;
          toast.error(
            err instanceof Error ? err.message : t("loadError"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, permissions.length, t]);

  const visiblePermissions = useMemo(
    () => permissions.filter((p) => !HIDDEN_MODULES.has(p.module)),
    [permissions],
  );

  const byModule = useMemo(() => {
    const map = new Map<string, PermOption[]>();
    for (const p of visiblePermissions) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return [...map.entries()];
  }, [visiblePermissions]);

  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleModule = (module: string, codes: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of codes) {
        if (on) next.add(c);
        else next.delete(c);
      }
      return next;
    });
  };

  const allCodes = visiblePermissions.map((p) => p.code);
  const allSelected =
    allCodes.length > 0 && allCodes.every((c) => selected.has(c));

  function moduleLabel(module: string) {
    const key = `modules.${module}` as Parameters<typeof t>[0];
    return t.has(key) ? t(key) : module;
  }

  function actionLabel(action: string) {
    if (action === "read") return t("actionRead");
    if (action === "write") return t("actionWrite");
    if (action === "run") return t("actionRun");
    return action;
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          name="name"
          label={t("formName")}
          required
          defaultValue={initialName}
          placeholder={t("formNamePh")}
        />
        <Input
          name="code"
          label={t("formCode")}
          required={!lockCode}
          defaultValue={initialCode}
          readOnly={lockCode}
          placeholder="SALES_REP"
          pattern="[A-Za-z][A-Za-z0-9_]{1,39}"
          title="UPPER_SNAKE_CASE"
        />
      </div>

      {[...selected].map((code) => (
        <input key={code} type="hidden" name="permissionCodes" value={code} />
      ))}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("permsHeading")}</h3>
          <div className="flex items-center gap-3">
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("selectedCount", {
                selected: selected.size,
                total: visiblePermissions.length,
              })}
            </p>
            {visiblePermissions.length > 0 ? (
              <button
                type="button"
                className="text-xs font-medium text-[var(--primary)]"
                onClick={() =>
                  setSelected(allSelected ? new Set() : new Set(allCodes))
                }
              >
                {allSelected ? t("clearAll") : t("selectAll")}
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">
            {t("loadingPerms")}
          </p>
        ) : visiblePermissions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">
            {t("noPerms")}
          </p>
        ) : (
          <div className="max-h-[min(52vh,480px)] space-y-3 overflow-y-auto rounded-xl border border-[var(--border)] p-3">
            {byModule.map(([module, perms]) => {
              const codes = perms.map((p) => p.code);
              const allOn = codes.every((c) => selected.has(c));
              return (
                <div
                  key={module}
                  className="rounded-lg border border-[var(--border)]/70 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{moduleLabel(module)}</p>
                    <button
                      type="button"
                      className="text-xs text-[var(--primary)]"
                      onClick={() => toggleModule(module, codes, !allOn)}
                    >
                      {allOn ? t("clearModule") : t("selectModule")}
                    </button>
                  </div>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {perms.map((p) => (
                      <li key={p.code}>
                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={selected.has(p.code)}
                            onChange={() => toggle(p.code)}
                          />
                          <span>
                            <span className="font-medium">
                              {actionLabel(p.action)}
                            </span>
                            <span className="mt-0.5 block font-mono text-[11px] text-[var(--muted-foreground)]">
                              {p.code}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Button type="submit" disabled={loading || visiblePermissions.length === 0}>
        {resolvedSubmit}
      </Button>
    </form>
  );
}
