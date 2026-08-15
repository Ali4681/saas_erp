"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

/** Known-valid checksum examples for form placeholders (not real people). */
const EXAMPLES = {
  RESIDENT: "2000000006",
  CITIZEN: "1000000008",
} as const;

type IdentityKind = keyof typeof EXAMPLES;

export function EmployeeIdentityFields({
  defaultType = "RESIDENT",
  defaultNumber,
  defaultExpiresOn,
}: {
  defaultType?: IdentityKind;
  defaultNumber?: string;
  defaultExpiresOn?: string;
}) {
  const t = useTranslations("hr");
  const [kind, setKind] = useState<IdentityKind>(defaultType);

  return (
    <>
      <Select
        name="identityType"
        label={t("identityType")}
        required
        defaultValue={kind}
        showPlaceholderOption={false}
        onChange={(e) => {
          const next = e.target.value === "CITIZEN" ? "CITIZEN" : "RESIDENT";
          setKind(next);
        }}
        options={[
          { value: "RESIDENT", label: t("identityResident") },
          { value: "CITIZEN", label: t("identityCitizen") },
        ]}
      />
      <div>
        <Input
          name="identityNumber"
          label={t("identityNumber")}
          required
          inputMode="numeric"
          pattern={kind === "CITIZEN" ? "1[0-9]{9}" : "2[0-9]{9}"}
          maxLength={10}
          defaultValue={defaultNumber}
          placeholder={EXAMPLES[kind]}
          title={
            kind === "CITIZEN"
              ? t("identityNumberCitizenTitle")
              : t("identityNumberResidentTitle")
          }
        />
        <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
          {kind === "CITIZEN"
            ? t("identityNumberCitizenHint", { example: EXAMPLES.CITIZEN })
            : t("identityNumberResidentHint", { example: EXAMPLES.RESIDENT })}
        </p>
      </div>
      <Input
        name="identityExpiresOn"
        label={t("identityExpiresOn")}
        type="date"
        required
        defaultValue={defaultExpiresOn}
      />
    </>
  );
}
