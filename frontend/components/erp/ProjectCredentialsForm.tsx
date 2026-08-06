"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  credentialPresetForCategory,
  type CredentialPreset,
} from "@/lib/integration-credentials";

export function ProjectCredentialsForm({
  action,
  categoryCode,
  providerCode,
  currentAuthType,
}: {
  action: (formData: FormData) => void | Promise<void>;
  categoryCode?: string | null;
  providerCode?: string | null;
  currentAuthType?: string | null;
}) {
  const t = useTranslations("integrations.credentialsForm");
  const preset: CredentialPreset = credentialPresetForCategory(
    categoryCode,
    providerCode,
  );

  return (
    <form action={action} className="grid gap-3">
      <Select
        name="authType"
        label={t("authType")}
        required
        defaultValue={currentAuthType ?? preset.authTypeDefault}
        options={[
          { value: "API_KEY", label: "API Key" },
          { value: "OAUTH2", label: "OAuth2" },
          { value: "BASIC", label: "Basic" },
          { value: "CUSTOM", label: t("authCustom") },
        ]}
      />
      {preset.fields.map((field) =>
        field.type === "textarea" ? (
          <label key={field.name} className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--foreground)]">
              {field.label}
            </span>
            <textarea
              name={field.name}
              rows={4}
              className="rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] shadow-sm outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20"
              placeholder={field.hint}
            />
            {field.hint ? (
              <span className="text-xs text-[var(--muted-foreground)]">
                {field.hint}
              </span>
            ) : null}
          </label>
        ) : (
          <div key={field.name}>
            <Input
              name={field.name}
              label={field.label}
              type={field.type === "password" ? "password" : "text"}
              placeholder={field.hint}
            />
            {field.hint ? (
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {field.hint}
              </p>
            ) : null}
          </div>
        ),
      )}
      <Input name="expiresAt" label={t("expiresAt")} />
      <Button type="submit">{t("save")}</Button>
    </form>
  );
}
