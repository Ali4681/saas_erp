import { getTranslations } from "next-intl/server";
import { AttachmentFileCard } from "@/components/erp/AttachmentFileCard";
import { PhoneWithDialCodeField } from "@/components/erp/PhoneWithDialCodeField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { MyProfile } from "@/lib/hr/my-profile";
import { getFormatters } from "@/lib/format-server";

type AttachmentRef = {
  id: string;
  fileName: string;
};

export async function EmployeePortalProfileView({
  companyId,
  me,
  updateProfileAction,
}: {
  companyId: string;
  me: MyProfile;
  updateProfileAction: (formData: FormData) => void | Promise<void>;
}) {
  const t = await getTranslations("hr");
  const { formatDate } = await getFormatters();

  const identityAttachment: AttachmentRef | null = me.identityAttachmentId
    ? { id: me.identityAttachmentId, fileName: t("identityPhoto") }
    : null;

  return (
    <div className="space-y-5">
      <Card className="grid gap-3 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">{t("fullName")}</p>
          <p className="mt-1 font-semibold">{me.fullName}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("employeeNumber")}
          </p>
          <p className="mt-1 font-mono text-sm">{me.employeeNumber}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">{t("titleCol")}</p>
          <p className="mt-1 font-medium">{me.jobTitle ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("identityNumber")}
          </p>
          <p className="mt-1 font-mono text-sm">{me.identityNumber ?? "—"}</p>
        </div>
        {me.identityExpiresOn ? (
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("identityExpiresOn")}
            </p>
            <p className="mt-1 font-medium">{formatDate(me.identityExpiresOn)}</p>
          </div>
        ) : null}
      </Card>

      {identityAttachment ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">{t("identityPhoto")}</h2>
          <AttachmentFileCard
            companyId={companyId}
            attachment={identityAttachment}
            missingLabel={t("identityPhotoMissing")}
          />
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-3 text-sm font-semibold">{t("updateProfile")}</h2>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          {t("employeePortalEditHint")}
        </p>
        <form action={updateProfileAction} className="grid gap-3 md:grid-cols-2">
          <PhoneWithDialCodeField
            name="phone"
            label={t("phone")}
            defaultValue={me.phone ?? ""}
          />
          <Input
            name="email"
            label={t("email")}
            type="email"
            defaultValue={me.email ?? ""}
          />
          <div className="md:col-span-2">
            <Input
              name="iban"
              label={t("iban")}
              placeholder="SA03 8000 0000 6080 1016 7519"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
              {me.hasIban || me.ibanLast4
                ? t("ibanCurrentHint", { last4: me.ibanLast4 ?? "••••" })
                : t("ibanHint")}
            </p>
          </div>
          <div className="md:col-span-2">
            <Button type="submit">{t("save")}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
