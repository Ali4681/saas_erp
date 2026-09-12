"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PhoneWithDialCodeField } from "@/components/erp/PhoneWithDialCodeField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

export type ContactFormDefaults = {
  contactType?: string;
  customerTrack?: string;
  status?: string;
  name?: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  taxNumber?: string | null;
  companyRegNumber?: string | null;
  creditLimit?: string | number | null;
  creditTermsDays?: string | number | null;
  dateOfBirth?: string | null;
  notes?: string | null;
};

/**
 * Shared contact fields. B2C hides company/VAT/CR/credit;
 * B2B hides date of birth.
 */
export function ContactCreateFields({
  defaults,
  showStatus = false,
}: {
  defaults?: ContactFormDefaults;
  showStatus?: boolean;
} = {}) {
  const t = useTranslations("crm");
  const [track, setTrack] = useState(
    defaults?.customerTrack === "B2B" ? "B2B" : "B2C",
  );
  const isB2B = track === "B2B";

  return (
    <>
      <Select
        name="contactType"
        label={t("type")}
        required
        defaultValue={defaults?.contactType ?? "CUSTOMER"}
        options={[
          { value: "CUSTOMER", label: t("contacts.customerType") },
          { value: "LEAD", label: t("contacts.leadType") },
        ]}
      />
      <Select
        name="customerTrack"
        label={t("track")}
        required
        value={track}
        showPlaceholderOption={false}
        onChange={(e) => setTrack(e.target.value === "B2B" ? "B2B" : "B2C")}
        options={[
          { value: "B2C", label: t("b2c") },
          { value: "B2B", label: t("b2b") },
        ]}
      />
      {showStatus ? (
        <Select
          name="status"
          label={t("status")}
          defaultValue={defaults?.status ?? "ACTIVE"}
          showPlaceholderOption={false}
          options={[
            { value: "ACTIVE", label: "ACTIVE" },
            { value: "INACTIVE", label: "INACTIVE" },
          ]}
        />
      ) : null}
      <Input
        name="name"
        label={t("name")}
        required
        defaultValue={defaults?.name ?? ""}
      />
      <Input
        name="email"
        label={t("email")}
        type="email"
        defaultValue={defaults?.email ?? ""}
      />
      <PhoneWithDialCodeField
        name="phone"
        dialCodeName="phoneDialCode"
        label={t("phone")}
        defaultValue={defaults?.phone ?? ""}
      />

      {isB2B ? (
        <>
          <Input
            name="companyName"
            label={t("contacts.companyName")}
            defaultValue={defaults?.companyName ?? ""}
          />
          <Input
            name="taxNumber"
            label={t("taxNumber")}
            defaultValue={defaults?.taxNumber ?? ""}
          />
          <Input
            name="companyRegNumber"
            label={t("companyRegNumber")}
            defaultValue={defaults?.companyRegNumber ?? ""}
          />
          <Input
            name="creditLimit"
            label={t("creditLimit")}
            type="number"
            defaultValue={
              defaults?.creditLimit != null ? String(defaults.creditLimit) : "0"
            }
          />
          <Input
            name="creditTermsDays"
            label={t("creditTermsDays")}
            type="number"
            defaultValue={
              defaults?.creditTermsDays != null
                ? String(defaults.creditTermsDays)
                : "0"
            }
          />
        </>
      ) : (
        <Input
          name="dateOfBirth"
          label={t("dateOfBirth")}
          type="date"
          defaultValue={defaults?.dateOfBirth ?? ""}
        />
      )}

      <div className="md:col-span-2 sm:col-span-2">
        <Textarea
          name="notes"
          label={t("notes")}
          defaultValue={defaults?.notes ?? ""}
        />
      </div>
    </>
  );
}
