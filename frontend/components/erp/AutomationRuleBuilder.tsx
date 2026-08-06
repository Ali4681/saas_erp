"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

type TriggerOpt = { event: string; label: string };
type ActionOpt = { type: string; label: string };
type UserOpt = { value: string; label: string };
type ModuleOpt = { value: string; label: string };

type ActionDraft = {
  id: string;
  type: string;
  title: string;
  body: string;
  userId: string;
  roleCode: string;
  daysFromNow: string;
  status: string;
};

type ConditionDraft = {
  id: string;
  field: string;
  op: string;
  value: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyAction(defaultType: string): ActionDraft {
  return {
    id: uid(),
    type: defaultType,
    title: "",
    body: "",
    userId: "",
    roleCode: "",
    daysFromNow: "1",
    status: "ACTIVE",
  };
}

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  modules: ModuleOpt[];
  triggers: TriggerOpt[];
  actions: ActionOpt[];
  users: UserOpt[];
};

const MODULE_KEYS = [
  "crm",
  "sales",
  "inventory",
  "hr",
  "work",
  "general",
] as const;

export function AutomationRuleBuilder({
  action,
  modules,
  triggers,
  actions,
  users,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("automation.builder");
  const defaultActionType = actions[0]?.type ?? "notify";
  const [triggerEvent, setTriggerEvent] = useState(
    triggers[0]?.event ?? "manual",
  );
  const [actionRows, setActionRows] = useState<ActionDraft[]>([
    emptyAction(defaultActionType),
  ]);
  const [conditions, setConditions] = useState<ConditionDraft[]>([]);

  const roleOptions = useMemo(
    () => [
      { value: "COMPANY_OWNER", label: t("roles.owner") },
      { value: "COMPANY_ADMIN", label: t("roles.admin") },
      { value: "OPERATIONS_MANAGER", label: t("roles.operations") },
      { value: "ACCOUNTANT", label: t("roles.accountant") },
    ],
    [t],
  );

  const opOptions = useMemo(
    () => [
      { value: "eq", label: t("ops.eq") },
      { value: "neq", label: t("ops.neq") },
      { value: "gt", label: t("ops.gt") },
      { value: "gte", label: t("ops.gte") },
      { value: "lt", label: t("ops.lt") },
      { value: "lte", label: t("ops.lte") },
      { value: "contains", label: t("ops.contains") },
    ],
    [t],
  );

  const localizedModules = useMemo(
    () =>
      modules.map((m) => {
        const key = m.value as (typeof MODULE_KEYS)[number];
        const label = MODULE_KEYS.includes(key)
          ? t(`modules.${key}`)
          : m.label;
        return { value: m.value, label };
      }),
    [modules, t],
  );

  const actionsJson = useMemo(
    () =>
      JSON.stringify(
        actionRows.map((row) => {
          const base: Record<string, unknown> = { type: row.type };
          if (row.title.trim()) base.title = row.title.trim();
          if (row.body.trim()) base.body = row.body.trim();
          if (row.userId) {
            base.userId = row.userId;
            base.assigneeUserId = row.userId;
          }
          if (row.roleCode) base.roleCode = row.roleCode;
          if (
            row.type === "create_task" ||
            row.type === "create_crm_activity"
          ) {
            base.daysFromNow = Number(row.daysFromNow) || 1;
          }
          if (row.type === "update_contact_status") {
            base.status = row.status || "ACTIVE";
          }
          return base;
        }),
      ),
    [actionRows],
  );

  const conditionsJson = useMemo(
    () =>
      JSON.stringify(
        conditions
          .filter((c) => c.field.trim())
          .map((c) => {
            let value: unknown = c.value;
            if (value === "true") value = true;
            else if (value === "false") value = false;
            else if (value !== "" && !Number.isNaN(Number(value))) {
              value = Number(value);
            }
            return {
              field: c.field.trim(),
              op: c.op || "eq",
              value,
            };
          }),
      ),
    [conditions],
  );

  return (
    <form action={action} className="grid gap-4" key={locale}>
      <input type="hidden" name="actionsJson" value={actionsJson} />
      <input type="hidden" name="conditionsJson" value={conditionsJson} />

      <div className="grid gap-3 md:grid-cols-2">
        <Input name="name" label={t("name")} required />
        <Select
          name="module"
          label={t("module")}
          required
          defaultValue={localizedModules[0]?.value ?? "crm"}
          options={localizedModules}
        />
        <Select
          name="triggerEvent"
          label={t("trigger")}
          required
          value={triggerEvent}
          onChange={(e) => setTriggerEvent(e.target.value)}
          options={triggers.map((tr) => ({
            value: tr.event,
            label: tr.label,
          }))}
        />
        {triggerEvent === "schedule.cron" ? (
          <Input
            name="scheduleCron"
            label={t("cron")}
            placeholder="0 6 * * *"
            required
          />
        ) : (
          <div className="hidden md:block" />
        )}
      </div>

      <section className="space-y-2 rounded-xl border border-[var(--border)] p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("conditionsTitle")}</h3>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              setConditions((prev) => [
                ...prev,
                { id: uid(), field: "", op: "eq", value: "" },
              ])
            }
          >
            <Plus className="ms-1 h-3.5 w-3.5" />
            {t("addCondition")}
          </Button>
        </div>
        {conditions.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("noConditions")}
          </p>
        ) : (
          <div className="space-y-2">
            {conditions.map((c) => (
              <div
                key={c.id}
                className="grid gap-2 rounded-lg bg-[var(--muted)]/30 p-2 md:grid-cols-[1fr_140px_1fr_auto]"
              >
                <Input
                  label={t("field")}
                  value={c.field}
                  placeholder="interested"
                  onChange={(e) =>
                    setConditions((prev) =>
                      prev.map((x) =>
                        x.id === c.id ? { ...x, field: e.target.value } : x,
                      ),
                    )
                  }
                />
                <Select
                  label={t("operator")}
                  value={c.op}
                  options={opOptions}
                  onChange={(e) =>
                    setConditions((prev) =>
                      prev.map((x) =>
                        x.id === c.id ? { ...x, op: e.target.value } : x,
                      ),
                    )
                  }
                />
                <Input
                  label={t("value")}
                  value={c.value}
                  placeholder="true"
                  onChange={(e) =>
                    setConditions((prev) =>
                      prev.map((x) =>
                        x.id === c.id ? { ...x, value: e.target.value } : x,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="self-end"
                  onClick={() =>
                    setConditions((prev) => prev.filter((x) => x.id !== c.id))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-[var(--border)] p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("actionsTitle")}</h3>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              setActionRows((prev) => [...prev, emptyAction(defaultActionType)])
            }
          >
            <Plus className="ms-1 h-3.5 w-3.5" />
            {t("addAction")}
          </Button>
        </div>

        <div className="space-y-3">
          {actionRows.map((row, index) => (
            <div
              key={row.id}
              className="space-y-2 rounded-lg border border-[var(--border)]/70 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-[var(--muted-foreground)]">
                  {t("actionN", { n: index + 1 })}
                </p>
                {actionRows.length > 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setActionRows((prev) =>
                        prev.filter((x) => x.id !== row.id),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Select
                  label={t("actionType")}
                  value={row.type}
                  options={actions.map((a) => ({
                    value: a.type,
                    label: a.label,
                  }))}
                  onChange={(e) =>
                    setActionRows((prev) =>
                      prev.map((x) =>
                        x.id === row.id ? { ...x, type: e.target.value } : x,
                      ),
                    )
                  }
                />
                {(row.type === "notify" ||
                  row.type === "assign_user" ||
                  row.type === "create_task" ||
                  row.type === "create_crm_activity") && (
                  <Select
                    label={t("userAssignee")}
                    value={row.userId}
                    placeholder={t("pickUser")}
                    options={users}
                    onChange={(e) =>
                      setActionRows((prev) =>
                        prev.map((x) =>
                          x.id === row.id
                            ? { ...x, userId: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                )}
                {row.type === "notify_role" ? (
                  <Select
                    label={t("role")}
                    value={row.roleCode}
                    placeholder={t("pickRole")}
                    options={roleOptions}
                    onChange={(e) =>
                      setActionRows((prev) =>
                        prev.map((x) =>
                          x.id === row.id
                            ? { ...x, roleCode: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                ) : null}
                {row.type === "update_contact_status" ? (
                  <Select
                    label={t("contactStatus")}
                    value={row.status}
                    options={[
                      { value: "ACTIVE", label: t("statusActive") },
                      { value: "INACTIVE", label: t("statusInactive") },
                    ]}
                    onChange={(e) =>
                      setActionRows((prev) =>
                        prev.map((x) =>
                          x.id === row.id
                            ? { ...x, status: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                ) : null}
                {(row.type === "create_task" ||
                  row.type === "create_crm_activity" ||
                  row.type === "notify" ||
                  row.type === "notify_role") && (
                  <Input
                    label={t("titleField")}
                    value={row.title}
                    onChange={(e) =>
                      setActionRows((prev) =>
                        prev.map((x) =>
                          x.id === row.id
                            ? { ...x, title: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                )}
                {(row.type === "create_task" ||
                  row.type === "create_crm_activity") && (
                  <Input
                    label={t("daysFromNow")}
                    value={row.daysFromNow}
                    onChange={(e) =>
                      setActionRows((prev) =>
                        prev.map((x) =>
                          x.id === row.id
                            ? { ...x, daysFromNow: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                )}
                {(row.type === "notify" ||
                  row.type === "notify_role" ||
                  row.type === "create_task" ||
                  row.type === "create_crm_activity") && (
                  <div className="md:col-span-2">
                    <Textarea
                      label={t("bodyNotes")}
                      value={row.body}
                      onChange={(e) =>
                        setActionRows((prev) =>
                          prev.map((x) =>
                            x.id === row.id
                              ? { ...x, body: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Button type="submit">{t("createDraft")}</Button>
    </form>
  );
}
