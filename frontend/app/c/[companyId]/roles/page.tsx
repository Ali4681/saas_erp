import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { ActionForm } from "@/components/erp/ActionForm";
import { RolePermissionsForm } from "@/components/erp/RolePermissionsForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createRole, deleteRole, updateRole } from "./actions";

type Role = {
  id: string;
  code: string;
  displayCode?: string;
  name: string;
  isSystem: boolean;
  memberCount: number;
  permissions: Array<{ code: string; module: string; action: string }>;
};

type Permission = {
  id: string;
  code: string;
  module: string;
  action: string;
  description?: string | null;
};

export default async function RolesPage({
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
  const t = await getTranslations("rolesPage");

  const [roles, permissions] = await Promise.all([
    apiServer<Role[]>(`/companies/${companyId}/roles`, { companyId }).catch(
      () => [],
    ),
    apiServer<Permission[]>(`/companies/${companyId}/permissions`, {
      companyId,
    }).catch(() =>
      apiServer<Permission[]>(`/permissions`, { companyId }).catch(() => []),
    ),
  ]);

  const custom = roles.filter((r) => !r.isSystem);
  const system = roles.filter((r) => r.isSystem);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button href={`/c/${companyId}/users`} variant="secondary">
              {t("usersLink")}
            </Button>
            {canWrite ? (
              <CreateFormDialog
                title={t("newTitle")}
                description={t("newDescription")}
                triggerLabel={t("newTrigger")}
              >
                <RolePermissionsForm
                  action={createRole.bind(null, companyId)}
                  companyId={companyId}
                  permissions={permissions}
                  submitLabel={t("createSubmit")}
                />
              </CreateFormDialog>
            ) : null}
          </div>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <Card className="p-4">
        <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
          {t("intro")}
        </p>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("customHeading")}</h2>
        {custom.length === 0 ? (
          <Card>
            <EmptyState message={t("customEmpty")} />
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {custom.map((role) => (
              <Card key={role.id} className="p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{role.name}</h3>
                    <p className="font-mono text-xs text-[var(--muted-foreground)]">
                      {role.displayCode ?? role.code}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {t("permCount", { count: role.permissions.length })}
                    </Badge>
                    <Badge variant="outline">
                      {t("userCount", { count: role.memberCount })}
                    </Badge>
                  </div>
                </div>
                <ul className="mb-3 flex flex-wrap gap-1">
                  {role.permissions.slice(0, 12).map((p) => (
                    <li key={p.code}>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {p.code}
                      </Badge>
                    </li>
                  ))}
                  {role.permissions.length > 12 ? (
                    <li>
                      <Badge variant="secondary">
                        +{role.permissions.length - 12}
                      </Badge>
                    </li>
                  ) : null}
                </ul>
                {canWrite ? (
                  <div className="flex flex-wrap gap-2">
                    <CreateFormDialog
                      title={t("editTitle", { name: role.name })}
                      description={t("editDescription")}
                      triggerLabel={t("editTrigger")}
                      triggerVariant="secondary"
                      showPlus={false}
                    >
                      <RolePermissionsForm
                        action={updateRole.bind(null, companyId, role.id)}
                        companyId={companyId}
                        permissions={permissions}
                        initialSelected={role.permissions.map((p) => p.code)}
                        initialName={role.name}
                        initialCode={role.displayCode ?? role.code}
                        lockCode
                        submitLabel={t("saveEdits")}
                      />
                    </CreateFormDialog>
                    <ActionForm
                      label={t("delete")}
                      variant="ghost"
                      confirm={
                        role.memberCount > 0
                          ? t("confirmDeleteLinked")
                          : t("confirmDelete")
                      }
                      action={deleteRole.bind(null, companyId, role.id)}
                    />
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("systemHeading")}</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {system.map((role) => (
            <Card key={role.id} className="p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-medium">{role.name}</h3>
                <Badge>{t("systemBadge")}</Badge>
              </div>
              <p className="mb-2 font-mono text-xs text-[var(--muted-foreground)]">
                {role.code}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("systemMeta", {
                  perms: role.permissions.length,
                  users: role.memberCount,
                })}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
