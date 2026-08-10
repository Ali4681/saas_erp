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
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { chargePaymentMethod, createPaymentMethod } from "../actions";

type Gateway = { id: string; code: string; name: string };
type Method = {
  id: string;
  name: string;
  status: string;
  paymentGateway?: { code: string; name: string } | null;
};
type Invoice = {
  id: string;
  invoiceNumber: string;
  balanceDue: string;
};

export default async function PaymentMethodsPage({
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

  const [methods, gateways, invoices] = await Promise.all([
    apiServer<Method[]>(`/companies/${companyId}/payment-methods`, {
      companyId,
    }).catch(() => []),
    apiServer<Gateway[]>("/payment-gateways", { companyId }).catch(() => []),
    apiServer<Invoice[]>(`/companies/${companyId}/sales/invoices`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createPaymentMethod.bind(null, companyId);
  const openInvoices = invoices.filter((i) => Number(i.balanceDue) > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("paymentMethodsTitle")}
        description={t("paymentMethodsDesc")}
        actions={
          <Button href={`/c/${companyId}/finance`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <CreateFormDialog
            title={t("enableMethod")}
            triggerLabel={t("enableMethod")}
          >
            <form action={create} className="grid gap-3">
              <Select
                name="paymentGatewayId"
                label={t("fromCatalog")}
                placeholder={t("selectGateway")}
                options={gateways.map((g) => ({
                  value: g.id,
                  label: `${g.name} (${g.code})`,
                }))}
              />
              <Input
                name="code"
                label={t("orCustomCode")}
                placeholder={t("customCodePlaceholder")}
              />
              <Input name="name" label={t("displayName")} />
              <Button type="submit">{t("enable")}</Button>
            </form>
          </CreateFormDialog>

          {methods[0] ? (
            <CreateFormDialog
              title={t("chargeVia", { name: methods[0].name })}
              triggerLabel={t("runCharge")}
              triggerVariant="secondary"
              showPlus={false}
            >
              <form
                action={chargePaymentMethod.bind(
                  null,
                  companyId,
                  methods[0].id,
                )}
                className="grid gap-3"
              >
                <Input name="amount" label={t("amount")} required />
                <Input
                  name="currency"
                  label={t("currency")}
                  defaultValue="SAR"
                />
                <Select
                  name="salesInvoiceId"
                  label={t("linkInvoice")}
                  placeholder={t("optional")}
                  options={openInvoices.map((i) => ({
                    value: i.id,
                    label: `${i.invoiceNumber} · ${i.balanceDue}`,
                  }))}
                />
                <Input name="description" label={t("descriptionLabel")} />
                <Button type="submit">{t("submitCharge")}</Button>
              </form>
            </CreateFormDialog>
          ) : null}
        </div>
      ) : null}

      <Card>
        {methods.length === 0 ? (
          <EmptyState message={t("emptyMethods")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("name")}</th>
                  <th className="px-2 py-2 font-medium">{t("gateway")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-medium">{m.name}</td>
                    <td className="px-2 py-2">
                      {m.paymentGateway
                        ? `${m.paymentGateway.name} (${m.paymentGateway.code})`
                        : "—"}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={m.status} />
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
