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
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tenant: TenantContextService,
    private readonly i18n: I18nService,
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

      await this.prisma.withoutTenant().user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), status: 'ACTIVE' },
      });

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

    const companyId = await this.resolveTenantCompanyId(user.id, dto);
    this.tenant.setCompanyId(companyId);

    const membership = await this.prisma.withoutTenant().companyUser.findFirst({
      where: { userId: user.id, companyId, status: 'ACTIVE' },
      include: membershipInclude,
    });
    if (!membership) {
      throw i18nUnauthorized('errors.auth.noMembership');
    }

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

    await this.prisma.withoutTenant().user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), status: 'ACTIVE' },
    });

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        isPlatformAdmin: false,
        companyId,
        roleCode: membership.role.code,
        permissions,
        locale: user.locale === 'en' ? 'en' : 'ar',
        theme: this.resolveUserTheme(user.theme),
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
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

    const membership = await this.prisma.withoutTenant().companyUser.findFirst({
      where: { userId: stored.userId, status: 'ACTIVE' },
      include: membershipInclude,
    });

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

  private async resolveTenantCompanyId(
    userId: string,
    dto: LoginDto,
  ): Promise<string> {
    if (dto.companyId) {
      const membership = await this.prisma.withoutTenant().companyUser.findFirst({
        where: { userId, companyId: dto.companyId, status: 'ACTIVE' },
      });
      if (!membership) {
        throw i18nUnauthorized('errors.auth.notCompanyMember');
      }
      return dto.companyId;
    }

    if (dto.companySlug) {
      const company = await this.prisma.withoutTenant().company.findFirst({
        where: { slug: dto.companySlug.trim().toLowerCase(), deletedAt: null },
      });
      if (!company) {
        throw i18nUnauthorized('errors.auth.companyNotFound');
      }
      const membership = await this.prisma.withoutTenant().companyUser.findFirst({
        where: { userId, companyId: company.id, status: 'ACTIVE' },
      });
      if (!membership) {
        throw i18nUnauthorized('errors.auth.notCompanyMember');
      }
      return company.id;
    }

    const memberships = await this.prisma.withoutTenant().companyUser.findMany({
      where: { userId, status: 'ACTIVE' },
      take: 2,
    });
    if (memberships.length === 0) {
      throw i18nUnauthorized('errors.auth.noMembership');
    }
    if (memberships.length > 1) {
      throw i18nUnauthorized('errors.auth.multipleCompanies');
    }
    return memberships[0]!.companyId;
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
    const refreshTtlDays = Number(this.config.get('JWT_REFRESH_TTL_DAYS') ?? 30);
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
