"use server";

import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function rolesPage(companyId: string) {
  return `/c/${companyId}/roles`;
}

function usersPage(companyId: string) {
  return `/c/${companyId}/users`;
}

export async function createRole(companyId: string, formData: FormData) {
  const permissionCodes = formData
    .getAll("permissionCodes")
    .map((v) => String(v).trim())
    .filter(Boolean);

  await erpMutate({
    companyId,
    path: `/companies/${companyId}/roles`,
    body: {
      code: str(formData, "code"),
      name: str(formData, "name"),
      description: optStr(formData, "description"),
      financialProfile: optStr(formData, "financialProfile") ?? "NONE",
      permissionCodes,
    },
    pagePath: rolesPage(companyId),
    okMessage: "تم إنشاء الدور",
  });
}

/** Create a job-title role from the employees form, then return there. */
export async function createRoleFromEmployees(
  companyId: string,
  formData: FormData,
) {
  const permissionCodes = formData
    .getAll("permissionCodes")
    .map((v) => String(v).trim())
    .filter(Boolean);

  await erpMutate({
    companyId,
    path: `/companies/${companyId}/roles`,
    body: {
      code: str(formData, "code"),
      name: str(formData, "name"),
      description: optStr(formData, "description"),
      financialProfile: optStr(formData, "financialProfile") ?? "NONE",
      permissionCodes,
    },
    pagePath: `/c/${companyId}/hr/employees`,
    okMessage: "تم إنشاء المسمى الوظيفي",
  });
}

export async function updateRole(
  companyId: string,
  roleId: string,
  formData: FormData,
) {
  const permissionCodes = formData
    .getAll("permissionCodes")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const name = optStr(formData, "name");
  const description = optStr(formData, "description");
  const financialProfile = optStr(formData, "financialProfile");

  await erpMutate({
    companyId,
    path: `/companies/${companyId}/roles/${roleId}`,
    method: "PATCH",
    body: {
      ...(name ? { name } : {}),
      ...(description !== undefined ? { description: description ?? "" } : {}),
      ...(financialProfile ? { financialProfile } : {}),
      permissionCodes,
    },
    pagePath: rolesPage(companyId),
    okMessage: "تم تحديث صلاحيات الدور",
  });
}

export async function deleteRole(companyId: string, roleId: string) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/roles/${roleId}`,
    method: "DELETE",
    pagePath: rolesPage(companyId),
    okMessage: "تم حذف الدور",
  });
}

export async function updateUserRole(
  companyId: string,
  membershipId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/users/${membershipId}/role`,
    method: "PATCH",
    body: { roleCode: str(formData, "roleCode") },
    pagePath: usersPage(companyId),
    okMessage: "تم تحديث دور المستخدم",
  });
}

export async function inviteUser(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/users`,
    body: {
      fullName: str(formData, "fullName"),
      email: str(formData, "email"),
      password: str(formData, "password"),
      roleCode: str(formData, "roleCode"),
    },
    pagePath: usersPage(companyId),
    okMessage: "تم إنشاء المستخدم ويمكنه تسجيل الدخول فوراً",
  });
}
