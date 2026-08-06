import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Badge } from "@/components/ui/Badge";
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
import { getFormatters } from "@/lib/format-server";
import { inviteUser, updateUserRole } from "../roles/actions";

type CompanyUser = {
  id: string;
  status: string;
  joinedAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    status: string;
    lastLoginAt: string | null;
  };
  role: {
    code: string;
    name: string;
    isSystem?: boolean;
  };
};

type Role = {
  id: string;
  code: string;
  displayCode?: string;
  name: string;
  isSystem: boolean;
};

export default async function UsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const session = await getSession();
  const canWrite = can(session?.user, "users.write");
  const t = await getTranslations("users");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const tCommon = await getTranslations("common");

  const [users, roles] = await Promise.all([
    apiServer<CompanyUser[]>(`/companies/${companyId}/users`, {
      companyId,
    }).catch(() => []),
    apiServer<Role[]>(`/companies/${companyId}/roles`, { companyId }).catch(
      () => [],
    ),
  ]);

  const roleOptions = roles.map((r) => ({
    value: r.code,
    label: `${r.name}${r.isSystem ? "" : t("customSuffix")}`,
  }));

  const defaultRoleCode =
    roles.find((r) => r.code === "EMPLOYEE_VIEWER")?.code ??
    roles.find((r) => !r.isSystem)?.code ??
    roles[0]?.code ??
    "";

  const addUserForm = canWrite ? (
    <CreateFormDialog
      title={t("addTitle")}
      description={t("addDescription")}
      triggerLabel={t("addTrigger")}
    >
      <form action={inviteUser.bind(null, companyId)} className="grid gap-3">
        <Input name="fullName" label={t("fullName")} required />
        <Input
          name="email"
          type="email"
          label={t("email")}
          required
          autoComplete="off"
        />
        <Input
          name="password"
          type="password"
          label={t("password")}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <Select
          name="roleCode"
          label={t("role")}
          required
          options={roleOptions}
          showPlaceholderOption={false}
          defaultValue={defaultRoleCode}
        />
        <p className="text-xs text-[var(--muted-foreground)]">{t("addHint")}</p>
        <Button type="submit">{t("createAccount")}</Button>
      </form>
    </CreateFormDialog>
  ) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button href={`/c/${companyId}/roles`} variant="secondary">
              {t("rolesLink")}
            </Button>
            {addUserForm}
          </div>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <Card>
        {users.length === 0 ? (
          <div className="space-y-4 p-2">
            <EmptyState message={t("empty")} />
            {canWrite ? (
              <div className="flex justify-center pb-4">{addUserForm}</div>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-right text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("colName")}</th>
                  <th className="px-2 py-2 font-medium">{t("colEmail")}</th>
                  <th className="px-2 py-2 font-medium">{t("colRole")}</th>
                  <th className="px-2 py-2 font-medium">{t("colStatus")}</th>
                  <th className="px-2 py-2 font-medium">{t("colLastLogin")}</th>
                  {canWrite ? (
                    <th className="px-2 py-2 font-medium">
                      {t("colChangeRole")}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--border)]/60 last:border-0"
                  >
                    <td className="px-2 py-2 font-medium">
                      {row.user.fullName}
                    </td>
                    <td className="px-2 py-2">{row.user.email}</td>
                    <td className="px-2 py-2">
                      <p>{row.role.name}</p>
                      <p className="font-mono text-xs text-[var(--muted-foreground)]">
                        {row.role.code}
                      </p>
                      {!row.role.isSystem && row.role.code.startsWith("C") ? (
                        <Badge variant="secondary" className="mt-1">
                          {t("custom")}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-2 py-2">
                      {formatDate(row.user.lastLoginAt)}
                    </td>
                    {canWrite ? (
                      <td className="px-2 py-2">
                        <form
                          action={updateUserRole.bind(null, companyId, row.id)}
                          className="flex flex-wrap items-end gap-2"
                        >
                          <Select
                            name="roleCode"
                            label={t("role")}
                            options={roleOptions}
                            defaultValue={row.role.code}
                            showPlaceholderOption={false}
                          />
                          <Button type="submit" size="sm" variant="secondary">
                            {tCommon("save")}
                          </Button>
                        </form>
                      </td>
                    ) : null}
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
