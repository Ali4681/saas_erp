import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { ActionForm } from "@/components/erp/ActionForm";
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
import {
  addPosCashier,
  createPointOfSale,
  deactivatePosCashier,
  updatePointOfSale,
} from "./actions";

type Branch = { id: string; code: string; name: string };
type Employee = {
  id: string;
  fullName: string;
  employeeNumber: string;
  userId?: string | null;
};
type Cashier = {
  id: string;
  displayName?: string | null;
  status: string;
  employee: { id: string; fullName: string; employeeNumber: string };
  user?: { id: string; email?: string | null; fullName?: string } | null;
};
type PointOfSale = {
  id: string;
  code: string;
  name: string;
  status: string;
  locationNote?: string | null;
  branch?: Branch | null;
  cashiers: Cashier[];
  _count?: { cashiers: number; invoices: number };
};

export default async function PosPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("sales");
  const tCommon = await getTranslations("common");
  const session = await getSession();
  const canWrite = can(session?.user, "sales.write");

  const [points, branches, employees] = await Promise.all([
    apiServer<PointOfSale[]>(`/companies/${companyId}/sales/pos`, {
      companyId,
    }).catch(() => []),
    apiServer<Branch[]>(`/companies/${companyId}/sales/pos/branches`, {
      companyId,
    }).catch(() => []),
    apiServer<Employee[]>(`/companies/${companyId}/hr/employees`, {
      companyId,
    }).catch(() => []),
  ]);

  const employeesWithLogin = employees.filter((e) => Boolean(e.userId));
  const createPos = createPointOfSale.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("pos.title")}
        description={t("pos.description")}
        actions={
          <Button href={`/c/${companyId}/sales`} variant="secondary">
            {t("back")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("pos.newTitle")}
          triggerLabel={t("pos.add")}
        >
          <form action={createPos} className="grid gap-3 md:grid-cols-2">
            <Input name="code" label={t("pos.code")} required />
            <Input name="name" label={t("pos.name")} required />
            <Select
              name="companyBranchId"
              label={t("pos.branch")}
              placeholder={t("optional")}
              options={branches.map((b) => ({
                value: b.id,
                label: `${b.code} — ${b.name}`,
              }))}
            />
            <Input
              name="locationNote"
              label={t("pos.locationNote")}
              className="md:col-span-2"
            />
            <div className="md:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      {points.length === 0 ? (
        <Card>
          <EmptyState message={t("pos.empty")} />
        </Card>
      ) : (
        <div className="space-y-4">
          {points.map((pos) => (
            <Card key={pos.id} className="space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">
                      {pos.name}{" "}
                      <span className="font-mono text-xs text-[var(--color-muted)]">
                        ({pos.code})
                      </span>
                    </h3>
                    <StatusBadge status={pos.status} />
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    {pos.branch
                      ? `${t("pos.branch")}: ${pos.branch.name}`
                      : t("pos.noBranch")}
                    {pos.locationNote ? ` · ${pos.locationNote}` : ""}
                    {` · ${t("pos.cashierCount", { count: pos.cashiers.length })}`}
                    {pos._count?.invoices != null
                      ? ` · ${t("pos.invoiceCount", { count: pos._count.invoices })}`
                      : ""}
                  </p>
                </div>
                {canWrite ? (
                  <CreateFormDialog
                    title={t("pos.editTitle")}
                    triggerLabel={t("edit")}
                    triggerVariant="ghost"
                    showPlus={false}
                  >
                    <form
                      action={updatePointOfSale.bind(null, companyId, pos.id)}
                      className="grid gap-3"
                    >
                      <Input
                        name="name"
                        label={t("pos.name")}
                        defaultValue={pos.name}
                        required
                      />
                      <Select
                        name="companyBranchId"
                        label={t("pos.branch")}
                        defaultValue={pos.branch?.id}
                        placeholder={t("optional")}
                        options={branches.map((b) => ({
                          value: b.id,
                          label: `${b.code} — ${b.name}`,
                        }))}
                      />
                      <Input
                        name="locationNote"
                        label={t("pos.locationNote")}
                        defaultValue={pos.locationNote ?? ""}
                      />
                      <Select
                        name="status"
                        label={t("status")}
                        defaultValue={pos.status}
                        showPlaceholderOption={false}
                        options={[
                          { value: "ACTIVE", label: "ACTIVE" },
                          { value: "INACTIVE", label: "INACTIVE" },
                          { value: "ARCHIVED", label: "ARCHIVED" },
                        ]}
                      />
                      <Button type="submit">{t("saveChanges")}</Button>
                    </form>
                  </CreateFormDialog>
                ) : null}
              </div>

              <div className="border-t border-[var(--color-border)] pt-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-medium">{t("pos.cashiers")}</h4>
                  {canWrite ? (
                    <CreateFormDialog
                      title={t("pos.addCashierTitle")}
                      triggerLabel={t("pos.addCashier")}
                      triggerVariant="secondary"
                      showPlus
                    >
                      {employeesWithLogin.length === 0 ? (
                        <EmptyState message={t("pos.noEmployeesWithLogin")} />
                      ) : (
                        <form
                          action={addPosCashier.bind(null, companyId, pos.id)}
                          className="grid gap-3"
                        >
                          <Select
                            name="employeeId"
                            label={t("pos.employee")}
                            required
                            placeholder={tCommon("select")}
                            options={employeesWithLogin.map((e) => ({
                              value: e.id,
                              label: `${e.employeeNumber} — ${e.fullName}`,
                            }))}
                          />
                          <Input
                            name="displayName"
                            label={t("pos.cashierDisplayName")}
                          />
                          <Button type="submit">{t("create")}</Button>
                        </form>
                      )}
                    </CreateFormDialog>
                  ) : null}
                </div>

                {pos.cashiers.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">
                    {t("pos.noCashiers")}
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--color-border)] text-sm">
                    {pos.cashiers.map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <div>
                          <div className="font-medium">
                            {c.displayName || c.employee.fullName}
                          </div>
                          <div className="text-xs text-[var(--color-muted)]">
                            {c.employee.employeeNumber}
                            {c.user?.email ? ` · ${c.user.email}` : ""}
                          </div>
                        </div>
                        {canWrite ? (
                          <ActionForm
                            label={t("pos.deactivateCashier")}
                            variant="danger"
                            confirm={t("pos.deactivateConfirm")}
                            action={deactivatePosCashier.bind(
                              null,
                              companyId,
                              c.id,
                            )}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
