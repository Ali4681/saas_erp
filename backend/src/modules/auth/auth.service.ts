import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { I18nService } from 'nestjs-i18n';
import {
  i18nBadRequest,
  i18nUnauthorized,
} from '../../common/i18n/localized-exception';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';

export type LoginDto = {
  email: string;
  password: string;
  companyId?: string;
  companySlug?: string;
};

const membershipInclude = {
  role: {
    include: {
      permissions: { include: { permission: true } },
    },
  },
  company: {
    select: {
      id: true,
      displayName: true,
      legalName: true,
      logoAttachmentId: true,
    },
  },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tenant: TenantContextService,
    private readonly i18n: I18nService,
    private readonly users: UsersService,
  ) {}

  async updateLocale(userId: string, locale: string) {
    const normalized = locale.trim().toLowerCase();
    if (normalized !== 'ar' && normalized !== 'en') {
      throw i18nBadRequest('errors.unsupportedLocale');
    }
    await this.prisma.withoutTenant().user.update({
      where: { id: userId },
      data: { locale: normalized },
    });
    return {
      locale: normalized,
      message: this.i18n.t('common.localeUpdated'),
    };
  }

  async updateTheme(userId: string, theme: string) {
    const normalized = theme.trim().toLowerCase();
    if (normalized !== 'light' && normalized !== 'dark') {
      throw i18nBadRequest('errors.unsupportedTheme');
    }
    await this.prisma.withoutTenant().user.update({
      where: { id: userId },
      data: { theme: normalized },
    });
    return {
      theme: normalized,
      message: this.i18n.t('common.themeUpdated'),
    };
  }

  private resolveUserTheme(theme: string | null | undefined): 'light' | 'dark' {
    return theme === 'dark' ? 'dark' : 'light';
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.withoutTenant().user.findUnique({
      where: { email },
    });
    if (!user || user.status === 'DISABLED' || user.status === 'SUSPENDED') {
      throw i18nUnauthorized('errors.auth.invalidCredentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw i18nUnauthorized('errors.auth.invalidCredentials');
    }

    this.tenant.setUserId(user.id);

    if (user.isPlatformAdmin) {
      const companyId = dto.companyId;
      if (companyId) {
        this.tenant.setCompanyId(companyId);
      } else {
        this.tenant.setBypass(true);
      }

      const tokens = await this.issueTokens({
        userId: user.id,
        email: user.email,
        isPlatformAdmin: true,
        companyId,
        roleCode: 'PLATFORM_SUPER_ADMIN',
        permissions: [],
      });

      void this.prisma
        .withoutTenant()
        .user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), status: 'ACTIVE' },
        })
        .catch(() => undefined);

      return {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          isPlatformAdmin: true,
          companyId,
          roleCode: 'PLATFORM_SUPER_ADMIN',
          permissions: [] as string[],
          locale: user.locale === 'en' ? 'en' : 'ar',
          theme: this.resolveUserTheme(user.theme),
        },
        ...tokens,
      };
    }

    let membership = await this.loadActiveMembership(user.id, dto);
    if (membership.role.code === 'COMPANY_EMPLOYEE') {
      await this.users.ensureCompanyEmployeeRole();
      membership = await this.loadActiveMembership(user.id, dto);
    }
    const companyId = membership.companyId;
    this.tenant.setCompanyId(companyId);

    const permissions =
      membership.role.permissions.map((row) => row.permission.code) ?? [];

    const tokens = await this.issueTokens({
      userId: user.id,
      email: user.email,
      isPlatformAdmin: false,
      companyId,
      roleCode: membership.role.code,
      permissions,
    });

    void this.prisma
      .withoutTenant()
      .user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), status: 'ACTIVE' },
      })
      .catch(() => undefined);

    const companyName =
      membership.company.displayName?.trim() ||
      membership.company.legalName?.trim() ||
      null;

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        isPlatformAdmin: false,
        companyId,
        companyName,
        logoAttachmentId: membership.company.logoAttachmentId,
        roleCode: membership.role.code,
        permissions,
        locale: user.locale === 'en' ? 'en' : 'ar',
        theme: this.resolveUserTheme(user.theme),
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string, preferredCompanyId?: string) {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.withoutTenant().refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt.getTime() < Date.now() ||
      stored.user.status === 'DISABLED'
    ) {
      throw i18nUnauthorized('errors.auth.invalidRefreshToken');
    }

    await this.prisma.withoutTenant().refreshToken.updateMany({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    this.tenant.setUserId(stored.user.id);

    if (stored.user.isPlatformAdmin) {
      this.tenant.setBypass(true);
      return this.issueTokens({
        userId: stored.user.id,
        email: stored.user.email,
        isPlatformAdmin: true,
        companyId: undefined,
        roleCode: 'PLATFORM_SUPER_ADMIN',
        permissions: [],
      });
    }

    const companyFilter = preferredCompanyId?.trim() || undefined;
    let membership = companyFilter
      ? await this.prisma.withoutTenant().companyUser.findFirst({
          where: {
            userId: stored.userId,
            companyId: companyFilter,
            status: 'ACTIVE',
          },
          include: membershipInclude,
        })
      : null;

    if (!membership) {
      membership = await this.prisma.withoutTenant().companyUser.findFirst({
        where: { userId: stored.userId, status: 'ACTIVE' },
        include: membershipInclude,
        orderBy: { joinedAt: 'asc' },
      });
    }

    if (!membership?.companyId) {
      throw i18nUnauthorized('errors.auth.noMembership');
    }

    this.tenant.setCompanyId(membership.companyId);

    return this.issueTokens({
      userId: stored.user.id,
      email: stored.user.email,
      isPlatformAdmin: false,
      companyId: membership.companyId,
      roleCode: membership.role.code,
      permissions:
        membership.role.permissions.map((row) => row.permission.code) ?? [],
    });
  }

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.withoutTenant().refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  private async loadActiveMembership(userId: string, dto: LoginDto) {
    if (dto.companyId) {
      const membership = await this.prisma
        .withoutTenant()
        .companyUser.findFirst({
          where: { userId, companyId: dto.companyId, status: 'ACTIVE' },
          include: membershipInclude,
        });
      if (!membership) {
        throw i18nUnauthorized('errors.auth.notCompanyMember');
      }
      return membership;
    }

    if (dto.companySlug) {
      const membership = await this.prisma
        .withoutTenant()
        .companyUser.findFirst({
          where: {
            userId,
            status: 'ACTIVE',
            company: {
              slug: dto.companySlug.trim().toLowerCase(),
              deletedAt: null,
            },
          },
          include: membershipInclude,
        });
      if (!membership) {
        throw i18nUnauthorized('errors.auth.notCompanyMember');
      }
      return membership;
    }

    const memberships = await this.prisma.withoutTenant().companyUser.findMany({
      where: { userId, status: 'ACTIVE' },
      take: 2,
      include: membershipInclude,
    });
    if (memberships.length === 0) {
      throw i18nUnauthorized('errors.auth.noMembership');
    }
    if (memberships.length > 1) {
      throw i18nUnauthorized('errors.auth.multipleCompanies');
    }
    return memberships[0];
  }

  private async resolveTenantCompanyId(
    userId: string,
    dto: LoginDto,
  ): Promise<string> {
    const membership = await this.loadActiveMembership(userId, dto);
    return membership.companyId;
  }

  private async issueTokens(input: {
    userId: string;
    email: string | null;
    isPlatformAdmin: boolean;
    companyId?: string;
    roleCode?: string;
    permissions: string[];
  }) {
    const accessToken = await this.jwt.signAsync(
      {
        sub: input.userId,
        email: input.email,
        isPlatformAdmin: input.isPlatformAdmin,
        companyId: input.companyId,
        roleCode: input.roleCode,
        permissions: input.permissions,
      },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '15m',
      },
    );

    const refreshToken = randomBytes(48).toString('hex');
    const refreshTtlDays = Number(
      this.config.get('JWT_REFRESH_TTL_DAYS') ?? 30,
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshTtlDays);

    await this.prisma.withoutTenant().refreshToken.create({
      data: {
        userId: input.userId,
        tokenHash: hashToken(refreshToken),
        expiresAt,
      },
    });

    const accessExp = new Date();
    accessExp.setMinutes(accessExp.getMinutes() + 15);

    return {
      accessToken,
      refreshToken,
      expiresAt: accessExp.toISOString(),
    };
  }
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
