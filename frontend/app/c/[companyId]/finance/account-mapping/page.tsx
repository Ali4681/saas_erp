import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { saveAccountMapping } from "../actions";

type AccountMapping = {
  salesRevenueCode: string;
  salesVatPayableCode: string;
  salesCashPosCode: string;
  salesCardBankCode: string;
  inventoryGoodsCode: string;
  inventoryInTransitCode: string;
  inventoryShrinkageCode: string;
  apLocalCode: string;
  apInternationalCode: string;
  importLandingCostCode: string;
  cogsCode: string;
  corporateWalletCode: string;
  employeeAdvanceCode: string;
  pettyCashExpenseCode: string;
  mainTreasuryCode: string;
};

const FIELDS: Array<{ key: keyof AccountMapping; labelKey: string }> = [
  { key: "salesRevenueCode", labelKey: "mapSalesRevenue" },
  { key: "salesVatPayableCode", labelKey: "mapSalesVat" },
  { key: "salesCashPosCode", labelKey: "mapSalesCash" },
  { key: "salesCardBankCode", labelKey: "mapSalesCard" },
  { key: "inventoryGoodsCode", labelKey: "mapInventoryGoods" },
  { key: "inventoryInTransitCode", labelKey: "mapInventoryTransit" },
  { key: "inventoryShrinkageCode", labelKey: "mapInventoryShrinkage" },
  { key: "apLocalCode", labelKey: "mapApLocal" },
  { key: "apInternationalCode", labelKey: "mapApInternational" },
  { key: "importLandingCostCode", labelKey: "mapImportLanding" },
  { key: "cogsCode", labelKey: "mapCogs" },
  { key: "corporateWalletCode", labelKey: "mapCorporateWallet" },
  { key: "employeeAdvanceCode", labelKey: "mapEmployeeAdvance" },
  { key: "pettyCashExpenseCode", labelKey: "mapPettyCash" },
  { key: "mainTreasuryCode", labelKey: "mapMainTreasury" },
];

export default async function AccountMappingPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("finance");
  const session = await getSession();
  const canWrite = can(session?.user, "finance.write");

  const mapping = await apiServer<AccountMapping>(
    `/companies/${companyId}/finance/account-mapping`,
    { companyId },
  ).catch(() => null);

  const save = saveAccountMapping.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("accountMapping")}
        actions={
          <Button href={`/c/${companyId}/finance`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />
      <p className="text-sm text-[var(--color-muted)]">{t("accountMappingHint")}</p>

      <Card>
        {mapping && canWrite ? (
          <form action={save} className="grid gap-3 md:grid-cols-2">
            {FIELDS.map((f) => (
              <Input
                key={f.key}
                name={f.key}
                label={t(f.labelKey as "mapSalesRevenue")}
                defaultValue={mapping[f.key] ?? ""}
                required
              />
            ))}
            <div className="md:col-span-2">
              <Button type="submit">{t("mappingSave")}</Button>
            </div>
          </form>
        ) : mapping ? (
          <div className="grid gap-2 md:grid-cols-2 text-sm">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <p className="text-xs text-[var(--color-muted)]">
                  {t(f.labelKey as "mapSalesRevenue")}
                </p>
                <p className="font-mono">{mapping[f.key]}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">{t("mappingLoadError")}</p>
        )}
      </Card>
    </div>
  );
}
