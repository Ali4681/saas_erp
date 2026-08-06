import { Injectable } from '@nestjs/common';
import {
  i18nBadRequest,
  i18nNotFound,
} from '../../common/i18n/localized-exception';
import * as bcrypt from 'bcrypt';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { PlanLimitsService } from '../plans/plan-limits.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  async inviteToCompany(input: {
    companyId: string;
    fullName: string;
    email: string;
    password: string;
    roleCode: string;
    branchId?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.planLimits.assertCanAddUser(input.companyId);

    const role = await this.resolveTenantRole(input.companyId, input.roleCode);
    if (!role) {
      throw i18nNotFound('errors.users.roleNotFound');
    }

    const email = input.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, 12);

    return this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        user = await tx.user.create({
          data: {
            fullName: input.fullName.trim(),
            email,
            passwordHash,
            status: 'ACTIVE',
          },
        });
      } else {
        if (user.status === 'DISABLED' || user.status === 'SUSPENDED') {
          throw i18nBadRequest('errors.users.accountDisabled');
        }
        if (user.isPlatformAdmin) {
          throw i18nBadRequest('errors.users.cannotAddPlatformAdmin');
        }
        // Only reset credentials for unused/invited accounts
        if (user.status === 'INVITED' || !user.lastLoginAt) {
          user = await tx.user.update({
            where: { id: user.id },
            data: {
              fullName: input.fullName.trim(),
              passwordHash,
              status: 'ACTIVE',
            },
          });
        } else {
          user = await tx.user.update({
            where: { id: user.id },
            data: { status: 'ACTIVE' },
          });
        }
      }

      const existing = await tx.companyUser.findUnique({
        where: {
          companyId_userId: {
            companyId: input.companyId,
            userId: user.id,
          },
        },
      });
      if (existing) {
        throw i18nBadRequest('errors.users.alreadyMember');
      }

      return tx.companyUser.create({
        data: {
          companyId: input.companyId,
          userId: user.id,
          roleId: role.id,
          branchId: input.branchId,
          status: 'ACTIVE',
        },
        include: { user: true, role: true },
      });
    });
  }

  listCompanyUsers(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.companyUser.findMany({
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
            lastLoginAt: true,
          },
        },
        role: true,
      },
      orderBy: { joinedAt: 'desc' },
    });
  }

  async updateMembershipRole(
    companyId: string,
    membershipId: string,
    roleCode: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const membership = await this.prisma.companyUser.findFirst({
      where: { id: membershipId, companyId },
      include: { role: true },
    });
    if (!membership) {
      throw i18nNotFound('errors.users.membershipNotFound');
    }

    const nextRole = await this.resolveTenantRole(companyId, roleCode);
    if (!nextRole) {
      throw i18nNotFound('errors.users.roleNotFound');
    }

    if (
      membership.role.code === 'COMPANY_OWNER' &&
      nextRole.code !== 'COMPANY_OWNER'
    ) {
      const owners = await this.prisma.companyUser.count({
        where: {
          companyId,
          role: { code: 'COMPANY_OWNER' },
          status: { in: ['ACTIVE', 'INVITED'] },
        },
      });
      if (owners <= 1) {
        throw i18nBadRequest('errors.users.cannotRemoveLastOwner');
      }
    }

    return this.prisma.companyUser.update({
      where: { id: membership.id },
      data: { roleId: nextRole.id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
            lastLoginAt: true,
          },
        },
        role: true,
      },
    });
  }

  private async resolveTenantRole(companyId: string, roleCode: string) {
    const raw = roleCode.trim().toUpperCase();
    const prefix = `C${companyId.replace(/-/g, '').slice(0, 8).toUpperCase()}_`;
    const candidates = [raw];
    if (!raw.startsWith(prefix) && !RESERVED_SYSTEM.has(raw)) {
      candidates.push(`${prefix}${raw}`.slice(0, 50));
    }
    return this.prisma.role.findFirst({
      where: {
        scope: 'TENANT',
        code: { in: candidates },
        OR: [
          { isSystem: true },
          { isSystem: false, code: { startsWith: prefix } },
        ],
      },
    });
  }
}

const RESERVED_SYSTEM = new Set([
  'COMPANY_OWNER',
  'COMPANY_ADMIN',
  'ACCOUNTANT',
  'OPERATIONS_MANAGER',
  'EMPLOYEE_VIEWER',
]);

