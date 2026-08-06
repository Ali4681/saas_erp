import { Injectable } from '@nestjs/common';
import {
  i18nBadRequest,
  i18nNotFound,
} from '../../common/i18n/localized-exception';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

/** Not grantable on company custom roles (platform-only or unused modules). */
const COMPANY_ROLE_EXCLUDED_PERMISSIONS = new Set([
  'plans.read',
  'plans.write',
  'subscriptions.read',
  'subscriptions.write',
  'retention.run',
  'branches.read',
  'branches.write',
]);

const RESERVED_CODES = new Set([
  'PLATFORM_SUPER_ADMIN',
  'COMPANY_OWNER',
  'COMPANY_ADMIN',
  'ACCOUNTANT',
  'OPERATIONS_MANAGER',
  'EMPLOYEE_VIEWER',
]);

/** Stable short prefix so custom role codes stay unique per company. */
export function companyRolePrefix(companyId: string): string {
  return `C${companyId.replace(/-/g, '').slice(0, 8).toUpperCase()}_`;
}

export function stripCompanyRolePrefix(code: string, companyId: string): string {
  const prefix = companyRolePrefix(companyId);
  return code.startsWith(prefix) ? code.slice(prefix.length) : code;
}

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  /** System TENANT roles + this company's custom roles. */
  listCompanyRoles(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const prefix = companyRolePrefix(companyId);
    return this.prisma.role
      .findMany({
        where: {
          scope: 'TENANT',
          OR: [{ isSystem: true }, { isSystem: false, code: { startsWith: prefix } }],
        },
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { memberships: true } },
        },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      })
      .then((rows) =>
        rows.map((role) => this.serialize(role, companyId)),
      );
  }

  listRoles(scope?: 'TENANT' | 'PLATFORM') {
    return this.prisma.role
      .findMany({
        where: {
          ...(scope ? { scope } : {}),
          isSystem: true,
        },
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { memberships: true } },
        },
        orderBy: { code: 'asc' },
      })
      .then((rows) => rows.map((role) => this.serialize(role)));
  }

  listPermissions(module?: string, forCompany = false) {
    return this.prisma.permission.findMany({
      where: {
        ...(module ? { module } : {}),
        ...(forCompany
          ? {
              AND: [
                { code: { notIn: [...COMPANY_ROLE_EXCLUDED_PERMISSIONS] } },
                { module: { not: 'branches' } },
              ],
            }
          : {}),
      },
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
  }

  async createCompanyRole(
    companyId: string,
    input: { code: string; name: string; permissionCodes?: string[] },
  ) {
    this.tenant.setCompanyId(companyId);
    const raw = input.code.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(raw)) {
      throw i18nBadRequest('errors.roles.codeFormat');
    }
    if (RESERVED_CODES.has(raw)) {
      throw i18nBadRequest('errors.roles.codeReserved');
    }

    const prefix = companyRolePrefix(companyId);
    const code = `${prefix}${raw}`.slice(0, 50);
    const existing = await this.prisma.role.findUnique({ where: { code } });
    if (existing) {
      throw i18nBadRequest('errors.roles.codeTaken');
    }

    const permissionIds = await this.resolvePermissionIds(
      input.permissionCodes ?? [],
      true,
    );

    const roleId = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          code,
          name: input.name.trim(),
          scope: 'TENANT',
          isSystem: false,
        },
      });
      if (permissionIds.length) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
        });
      }
      return role.id;
    });

    return this.getRole(roleId, companyId);
  }

  async updateCompanyRole(
    companyId: string,
    roleId: string,
    input: { name?: string; permissionCodes?: string[] },
  ) {
    this.tenant.setCompanyId(companyId);
    const role = await this.requireCompanyCustomRole(companyId, roleId);

    if (input.name?.trim()) {
      await this.prisma.role.update({
        where: { id: role.id },
        data: { name: input.name.trim() },
      });
    }

    if (input.permissionCodes) {
      const permissionIds = await this.resolvePermissionIds(
        input.permissionCodes,
        true,
      );
      await this.prisma.$transaction(async (tx) => {
        await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
        if (permissionIds.length) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
              roleId: role.id,
              permissionId,
            })),
          });
        }
      });
    }

    return this.getRole(role.id, companyId);
  }

  async updateRolePermissions(roleId: string, permissionCodes: string[]) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw i18nNotFound('errors.roles.notFound');
    if (role.isSystem) {
      throw i18nBadRequest('errors.roles.cannotModifySystem');
    }
    const prefixMatch = /^C[0-9A-F]{8}_/i.exec(role.code);
    if (!prefixMatch) {
      throw i18nBadRequest('errors.roles.useCompanyEndpoint');
    }
    // companyId unknown from prefix alone — update permissions directly
    const permissionIds = await this.resolvePermissionIds(permissionCodes, true);
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissionIds.length) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
        });
      }
    });
    return this.getRole(roleId);
  }

  async deleteCompanyRole(companyId: string, roleId: string) {
    this.tenant.setCompanyId(companyId);
    const role = await this.requireCompanyCustomRole(companyId, roleId);
    const members = await this.prisma.companyUser.count({
      where: { companyId, roleId: role.id },
    });
    if (members > 0) {
      throw i18nBadRequest('errors.roles.cannotDeleteLinked', {
        count: members,
      });
    }
    await this.prisma.role.delete({ where: { id: role.id } });
    return { ok: true, id: role.id };
  }

  private async requireCompanyCustomRole(companyId: string, roleId: string) {
    const prefix = companyRolePrefix(companyId);
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        isSystem: false,
        code: { startsWith: prefix },
      },
    });
    if (!role) {
      throw i18nNotFound('errors.roles.customNotFound');
    }
    return role;
  }

  private async getRole(id: string, companyId?: string) {
    const role = await this.prisma.role.findUniqueOrThrow({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { memberships: true } },
      },
    });
    return this.serialize(role, companyId);
  }

  private serialize(
    role: {
      id: string;
      code: string;
      name: string;
      scope: string;
      isSystem: boolean;
      permissions: Array<{
        permission: {
          id: string;
          code: string;
          module: string;
          action: string;
        };
      }>;
      _count?: { memberships: number };
    },
    companyId?: string,
  ) {
    return {
      id: role.id,
      code: role.code,
      displayCode: companyId
        ? stripCompanyRolePrefix(role.code, companyId)
        : role.code,
      name: role.name,
      scope: role.scope,
      isSystem: role.isSystem,
      memberCount: role._count?.memberships ?? 0,
      permissions: role.permissions.map((rp) => ({
        id: rp.permission.id,
        code: rp.permission.code,
        module: rp.permission.module,
        action: rp.permission.action,
      })),
    };
  }

  private async resolvePermissionIds(
    codes: string[],
    forCompany: boolean,
  ): Promise<string[]> {
    if (!codes.length) return [];
    const normalized = [...new Set(codes.map((c) => c.trim().toLowerCase()))];
    if (forCompany) {
      const blocked = normalized.filter((c) =>
        COMPANY_ROLE_EXCLUDED_PERMISSIONS.has(c),
      );
      if (blocked.length) {
        throw i18nBadRequest('errors.roles.blockedPermissions', {
          codes: blocked.join(', '),
        });
      }
    }
    const rows = await this.prisma.permission.findMany({
      where: { code: { in: normalized } },
    });
    if (rows.length !== normalized.length) {
      const found = new Set(rows.map((r) => r.code));
      const missing = normalized.filter((c) => !found.has(c));
      throw i18nBadRequest('errors.roles.unknownPermissions', {
        codes: missing.join(', '),
      });
    }
    return rows.map((r) => r.id);
  }
}
