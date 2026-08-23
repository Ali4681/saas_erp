import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/Textarea";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { canAny } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { createCoupon } from "../../actions";

type Coupon = {
  id: string;
  code: string;
  couponType: string;
  discountValue: string;
  usageCount: number;
  maxUsages: number | null;
  validTo: string | null;
  isActive: boolean;
  _count: { usages: number };
};

export default async function CouponsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("crm");
  const { formatMoney, formatNumber } = await getFormatters();
  const session = await getSession();
  const canWrite = canAny(session?.user, "crm.write", "crm.coupons");

  const coupons = await apiServer<Coupon[]>(
    `/companies/${companyId}/crm/pricing/coupons`,
    { companyId },
  ).catch(() => []);

  const create = createCoupon.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("pricing.couponsTitle")}
        actions={
          <Button href={`/c/${companyId}/crm`} variant="secondary">
            CRM
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite && (
        <CreateFormDialog
          title={t("pricing.newCoupon")}
          triggerLabel={t("pricing.addCoupon")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Input name="code" label={t("pricing.couponCode")} required />
            <Select
              name="couponType"
              label={t("pricing.couponType")}
              defaultValue="PERCENT"
              options={[
                { value: "PERCENT", label: t("pricing.percent") },
                { value: "FIXED_AMOUNT", label: t("pricing.fixedAmount") },
              ]}
            />
            <Input name="discountValue" label={t("pricing.discountValue")} type="number" min="0" required />
            <Input name="maxUsages" label={t("pricing.maxUsages")} type="number" min="1" />
            <Input name="validFrom" label={t("pricing.validFrom")} type="datetime-local" />
            <Input name="validTo" label={t("pricing.validTo")} type="datetime-local" />
            <div className="md:col-span-2">
              <Textarea name="notes" label={t("notes")} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      )}

      <Card>
        {coupons.length === 0 ? (
          <EmptyState message={t("pricing.emptyCoupons")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium text-start">{t("pricing.couponCode")}</th>
                  <th className="px-2 py-2 font-medium text-start">{t("pricing.couponType")}</th>
                  <th className="px-2 py-2 font-medium text-end">{t("pricing.discountValue")}</th>
                  <th className="px-2 py-2 font-medium text-end">{t("pricing.usages")}</th>
                  <th className="px-2 py-2 font-medium text-start">{t("pricing.validTo")}</th>
                  <th className="px-2 py-2 font-medium text-start">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-2 py-2 font-mono font-medium">{row.code}</td>
                    <td className="px-2 py-2">{row.couponType}</td>
                    <td className="px-2 py-2 text-end">
                      {row.couponType === "PERCENT"
                        ? `${formatNumber(row.discountValue)}%`
                        : formatMoney(row.discountValue, "SAR")}
                    </td>
                    <td className="px-2 py-2 text-end">
                      {row.usageCount}
                      {row.maxUsages != null ? ` / ${row.maxUsages}` : ""}
                    </td>
                    <td className="px-2 py-2 text-[var(--color-muted)]">
                      {row.validTo ? new Date(row.validTo).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
