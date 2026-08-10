import { getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { ActionForm } from "@/components/erp/ActionForm";
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
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import {
  createContract,
  submitContract,
  updateContract,
  uploadContractFile,
} from "../actions";

type Employee = { id: string; fullName: string; employeeNumber: string };
type Contract = {
  id: string;
  title: string;
  contractNumber: string | null;
  status: string;
  startsOn: string | null;
  endsOn: string | null;
  baseSalary: string | null;
  targetPercent: string | null;
  notes: string | null;
  employee?: { fullName: string; employeeNumber: string } | null;
};
type Attachment = {
  id: string;
  entityType: string;
  entityId: string;
  fileName: string;
};

function toDateInput(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export default async function ContractsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("hr");
  const { formatDate, formatMoney } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "hr.write");

  const [contracts, employees, attachments] = await Promise.all([
    apiServer<Contract[]>(`/companies/${companyId}/hr/contracts`, {
      companyId,
    }).catch(() => []),
    apiServer<Employee[]>(`/companies/${companyId}/hr/employees`, {
      companyId,
    }).catch(() => []),
    apiServer<Attachment[]>(
      `/companies/${companyId}/attachments?entityType=employee_contract`,
      { companyId },
    ).catch(() => []),
  ]);

  const fileByContract = new Map<string, Attachment>();
  for (const a of attachments) {
    if (!fileByContract.has(a.entityId)) fileByContract.set(a.entityId, a);
  }

  const create = createContract.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("contractsTitle")}
        description={t("contractsHint")}
        actions={
          <Button href={`/c/${companyId}/hr`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("newContract")}
          triggerLabel={t("addContract")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Select
              name="employeeId"
              label={t("employee")}
              required
              placeholder={t("selectPlaceholder")}
              options={employees.map((e) => ({
                value: e.id,
                label: `${e.employeeNumber} — ${e.fullName}`,
              }))}
            />
            <Input name="title" label={t("contractTitle")} required />
            <Input name="contractNumber" label={t("contractNumber")} />
            <Input name="baseSalary" label={t("baseSalary")} />
            <Input name="targetPercent" label={t("targetPercent")} />
            <Input name="startsOn" label={t("startsOn")} type="date" />
            <Input name="endsOn" label={t("endsOn")} type="date" />
            <div className="md:col-span-2">
              <Textarea name="notes" label={t("notes")} />
            </div>
            <label className="flex flex-col gap-1.5 text-sm md:col-span-2">
              <span className="font-medium">{t("contractFile")}</span>
              <input
                type="file"
                name="contractFile"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf"
                className="h-10 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-sm file:me-3 file:rounded-md file:border-0 file:bg-[var(--secondary)] file:px-3 file:py-1.5 file:text-sm"
              />
              <span className="text-xs text-[var(--muted-foreground)]">
                {t("contractFileHint")}
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" name="submitNow" value="true" />
              <span>{t("submitOnCreate")}</span>
            </label>
            <div className="md:col-span-2">
              <Button type="submit">{t("createContract")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {contracts.length === 0 ? (
          <EmptyState message={t("emptyContracts")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("employee")}</th>
                  <th className="px-2 py-2 font-medium">{t("contractTitle")}</th>
                  <th className="px-2 py-2 font-medium">{t("salary")}</th>
                  <th className="px-2 py-2 font-medium">{t("targetPercent")}</th>
                  <th className="px-2 py-2 font-medium">{t("period")}</th>
                  <th className="px-2 py-2 font-medium">{t("contractFile")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const file = fileByContract.get(c.id);
                  const canEdit =
                    canWrite &&
                    (c.status === "DRAFT" || c.status === "SUBMITTED");
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className="px-2 py-2">
                        {c.employee?.fullName ?? "—"}
                      </td>
                      <td className="px-2 py-2">
                        <p className="font-medium">{c.title}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {c.contractNumber ?? ""}
                        </p>
                      </td>
                      <td className="px-2 py-2">
                        {formatMoney(c.baseSalary)}
                      </td>
                      <td className="px-2 py-2">
                        {c.targetPercent != null
                          ? `${c.targetPercent}%`
                          : "—"}
                      </td>
                      <td className="px-2 py-2">
                        {c.startsOn ? formatDate(c.startsOn) : "—"}
                        {" → "}
                        {c.endsOn ? formatDate(c.endsOn) : "—"}
                      </td>
                      <td className="px-2 py-2">
                        {file ? (
                          <a
                            href={`/api/attachments/${file.id}?companyId=${companyId}`}
                            className="inline-flex items-center gap-1 text-[var(--primary)] underline-offset-2 hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {file.fileName}
                          </a>
                        ) : canWrite ? (
                          <CreateFormDialog
                            title={t("uploadFile")}
                            triggerLabel={t("uploadFile")}
                            triggerVariant="outline"
                            showPlus={false}
                            className="!px-2 !py-1 text-xs"
                          >
                            <form
                              action={uploadContractFile.bind(
                                null,
                                companyId,
                                c.id,
                              )}
                              className="grid gap-3"
                            >
                              <input
                                type="file"
                                name="contractFile"
                                required
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf"
                                className="h-10 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-sm file:me-3 file:rounded-md file:border-0 file:bg-[var(--secondary)] file:px-3 file:py-1.5"
                              />
                              <Button type="submit">{t("uploadFile")}</Button>
                            </form>
                          </CreateFormDialog>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {canEdit ? (
                            <CreateFormDialog
                              title={t("editContract")}
                              triggerLabel={t("edit")}
                              triggerVariant="outline"
                              showPlus={false}
                            >
                              <form
                                action={updateContract.bind(
                                  null,
                                  companyId,
                                  c.id,
                                )}
                                className="grid gap-3 md:grid-cols-2"
                              >
                                <Input
                                  name="title"
                                  label={t("contractTitle")}
                                  required
                                  defaultValue={c.title}
                                />
                                <Input
                                  name="contractNumber"
                                  label={t("contractNumber")}
                                  defaultValue={c.contractNumber ?? ""}
                                />
                                <Input
                                  name="baseSalary"
                                  label={t("baseSalary")}
                                  defaultValue={c.baseSalary ?? ""}
                                />
                                <Input
                                  name="targetPercent"
                                  label={t("targetPercent")}
                                  defaultValue={c.targetPercent ?? ""}
                                />
                                <Input
                                  name="startsOn"
                                  label={t("startsOn")}
                                  type="date"
                                  defaultValue={toDateInput(c.startsOn)}
                                />
                                <Input
                                  name="endsOn"
                                  label={t("endsOn")}
                                  type="date"
                                  defaultValue={toDateInput(c.endsOn)}
                                />
                                <div className="md:col-span-2">
                                  <Textarea
                                    name="notes"
                                    label={t("notes")}
                                    defaultValue={c.notes ?? ""}
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <Button type="submit">{t("save")}</Button>
                                </div>
                              </form>
                            </CreateFormDialog>
                          ) : null}
                          {canEdit ? (
                            <ActionForm
                              label={t("submitContract")}
                              variant="primary"
                              action={submitContract.bind(
                                null,
                                companyId,
                                c.id,
                              )}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
