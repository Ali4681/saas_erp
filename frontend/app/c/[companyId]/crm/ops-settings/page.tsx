import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { saveCrmOpsSettings } from "../actions";

type Settings = {
  loyalty: { b2cRatePct: number; b2bRatePct: number; birthdayBonus: number; otpRequired: boolean };
  pos: { maxDiscountPct: number; overrideCode: string };
  zatca: { sellerName: string; vatNumber: string };
};

export default async function CrmOpsSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("crm");
  const session = await getSession();
  const canWrite = can(session?.user, "crm.write");
  const settings = await apiServer<Settings>(
    `/companies/${companyId}/crm/ops-settings`,
    { companyId },
  ).catch(() => null);
  const save = saveCrmOpsSettings.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("ops.title")}
        actions={
          <Button href={`/c/${companyId}/crm`} variant="secondary">
            CRM
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />
      <Card>
        {canWrite && settings ? (
          <form action={save} className="grid gap-3 md:grid-cols-2">
            <Input name="b2cRatePct" label={t("ops.b2cRate")} type="number" defaultValue={settings.loyalty.b2cRatePct} />
            <Input name="b2bRatePct" label={t("ops.b2bRate")} type="number" defaultValue={settings.loyalty.b2bRatePct} />
            <Input name="birthdayBonus" label={t("ops.birthdayBonus")} type="number" defaultValue={settings.loyalty.birthdayBonus} />
            <Input name="maxDiscountPct" label={t("ops.maxDiscount")} type="number" defaultValue={settings.pos.maxDiscountPct} />
            <Input name="overrideCode" label={t("ops.overrideCode")} defaultValue={settings.pos.overrideCode} />
            <Input name="sellerName" label={t("ops.sellerName")} defaultValue={settings.zatca.sellerName} />
            <Input name="vatNumber" label={t("ops.vatNumber")} defaultValue={settings.zatca.vatNumber} />
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                name="otpRequired"
                defaultChecked={settings.loyalty.otpRequired}
              />
              {t("ops.otpRequired")}
            </label>
            <div className="md:col-span-2">
              <Button type="submit">{t("contacts.save")}</Button>
            </div>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
