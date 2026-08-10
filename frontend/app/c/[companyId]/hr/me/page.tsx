import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/Textarea";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";
import {
  requestMyAdvance,
  requestMyLeave,
  updateMyProfile,
} from "../actions";

type MyProfile = {
  id: string;
  fullName: string;
  employeeNumber: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  basicSalary: string | null;
  currency: string;
  employmentStatus: string;
  salaryAdvances?: {
    id: string;
    amount: string;
    currency: string;
    status: string;
    requestedAt: string;
  }[];
  leaveRequests?: {
    id: string;
    leaveType: string;
    status: string;
    startsOn: string;
    endsOn: string;
    requestedDays: string | number;
  }[];
};

export default async function HrMePage({
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

  const me = await apiServer<MyProfile>(`/companies/${companyId}/hr/me`, {
    companyId,
  }).catch(() => null);

  const updateProfile = updateMyProfile.bind(null, companyId);
  const requestAdvance = requestMyAdvance.bind(null, companyId);
  const requestLeave = requestMyLeave.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("meTitle")}
        description={t("meDesc")}
        actions={
          <Button href={`/c/${companyId}/hr`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {!me ? (
        <Card>
          <EmptyState message={t("meNoProfile")} />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("fullName")}
              </p>
              <p className="mt-1 font-semibold">{me.fullName}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {me.employeeNumber}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("basicSalary")}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {formatMoney(me.basicSalary, me.currency)}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("titleCol")}
              </p>
              <p className="mt-1 font-semibold">{me.jobTitle ?? "—"}</p>
            </Card>
            <Card>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("status")}
              </p>
              <div className="mt-1">
                <StatusBadge status={me.employmentStatus} />
              </div>
            </Card>
          </div>

          <p className="text-sm text-[var(--muted-foreground)]">
            {t("advanceCapHint")}
          </p>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">{t("updateProfile")}</h2>
            <form
              action={updateProfile}
              className="grid gap-3 md:grid-cols-2"
            >
              <Input
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
                <Button type="submit">{t("save")}</Button>
              </div>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">{t("requestAdvance")}</h2>
            <form
              action={requestAdvance}
              className="grid gap-3 md:grid-cols-2"
            >
              <Input name="amount" label={t("amount")} required />
              <div className="md:col-span-2">
                <Textarea name="reason" label={t("reason")} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">{t("submit")}</Button>
              </div>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">{t("requestLeave")}</h2>
            <form action={requestLeave} className="grid gap-3 md:grid-cols-2">
              <Select
                name="leaveType"
                label={t("type")}
                required
                options={[
                  { value: "ANNUAL", label: t("leaveAnnual") },
                  { value: "SICK", label: t("leaveSick") },
                  { value: "UNPAID", label: t("leaveUnpaid") },
                  { value: "EMERGENCY", label: t("leaveEmergency") },
                  { value: "OTHER", label: t("leaveOther") },
                ]}
              />
              <Input
                name="requestedDays"
                label={t("days")}
                required
                defaultValue="1"
              />
              <Input name="startsOn" label={t("from")} type="date" required />
              <Input name="endsOn" label={t("to")} type="date" required />
              <div className="md:col-span-2">
                <Textarea name="reason" label={t("reason")} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">{t("submit")}</Button>
              </div>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">{t("myAdvances")}</h2>
            {!me.salaryAdvances?.length ? (
              <EmptyState message={t("emptyAdvances")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                      <th className="px-2 py-2 font-medium">{t("amount")}</th>
                      <th className="px-2 py-2 font-medium">{t("date")}</th>
                      <th className="px-2 py-2 font-medium">{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {me.salaryAdvances.map((a) => (
                      <tr
                        key={a.id}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="px-2 py-2">
                          {formatMoney(a.amount, a.currency)}
                        </td>
                        <td className="px-2 py-2">
                          {formatDate(a.requestedAt)}
                        </td>
                        <td className="px-2 py-2">
                          <StatusBadge status={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">{t("myLeaves")}</h2>
            {!me.leaveRequests?.length ? (
              <EmptyState message={t("emptyLeaves")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                      <th className="px-2 py-2 font-medium">{t("type")}</th>
                      <th className="px-2 py-2 font-medium">{t("period")}</th>
                      <th className="px-2 py-2 font-medium">{t("daysCol")}</th>
                      <th className="px-2 py-2 font-medium">{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {me.leaveRequests.map((l) => (
                      <tr
                        key={l.id}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="px-2 py-2">{l.leaveType}</td>
                        <td className="px-2 py-2">
                          {formatDate(l.startsOn)} → {formatDate(l.endsOn)}
                        </td>
                        <td className="px-2 py-2">{l.requestedDays}</td>
                        <td className="px-2 py-2">
                          <StatusBadge status={l.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
