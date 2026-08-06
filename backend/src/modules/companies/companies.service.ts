import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../../generated/prisma/client';
import { StorageService } from '../../common/storage/storage.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly storage: StorageService,
  ) {}

  list() {
    return this.prisma.company.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING', 'SUSPENDED'] } },
          include: { plan: true },
          orderBy: { startsAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async get(id: string) {
    return this.prisma.company.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: {
        settings: true,
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING'] } },
          include: { plan: true },
          take: 1,
        },
      },
    });
  }

  async update(
    id: string,
    input: {
      legalName?: string;
      displayName?: string;
      businessCategory?: 'DELIVERY' | 'INSTALLMENT' | 'ECOMMERCE';
      defaultCurrency?: string;
      timezone?: string;
      countryCode?: string;
      city?: string;
      logoAttachmentId?: string | null;
      status?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
    },
  ) {
    await this.requireCompany(id);
    return this.prisma.company.update({
      where: { id },
      data: {
        legalName: input.legalName,
        displayName: input.displayName,
        businessCategory: input.businessCategory,
        defaultCurrency: input.defaultCurrency,
        timezone: input.timezone,
        countryCode: input.countryCode,
        city: input.city?.trim() || undefined,
        logoAttachmentId: input.logoAttachmentId,
        status: input.status,
      },
      include: { settings: true },
    });
  }

  async softDelete(id: string) {
    await this.requireCompany(id);
    this.tenant.setBypass(true);
    try {
      await this.prisma.subscription.updateMany({
        where: {
          companyId: id,
          status: { in: ['ACTIVE', 'TRIALING'] },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          activeCompanyId: null,
        },
      });
      return this.prisma.company.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: 'CLOSED',
        },
      });
    } finally {
      this.tenant.setBypass(false);
    }
  }

  async updateSettings(
    companyId: string,
    input: {
      taxNumber?: string | null;
      invoicePrefix?: string;
      defaultTaxRate?: string | number;
      emailFromName?: string | null;
      emailFromAddress?: string | null;
      settings?: Record<string, unknown>;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    await this.requireCompany(companyId);
    return this.prisma.companySettings.upsert({
      where: { companyId },
      create: {
        companyId,
        taxNumber: input.taxNumber ?? undefined,
        invoicePrefix: input.invoicePrefix ?? 'INV',
        defaultTaxRate:
          input.defaultTaxRate != null
            ? Number(input.defaultTaxRate).toFixed(2)
            : undefined,
        emailFromName: input.emailFromName ?? undefined,
        emailFromAddress: input.emailFromAddress ?? undefined,
        settings: (input.settings ?? {}) as Prisma.InputJsonValue,
      },
      update: {
        taxNumber: input.taxNumber,
        invoicePrefix: input.invoicePrefix,
        defaultTaxRate:
          input.defaultTaxRate != null
            ? Number(input.defaultTaxRate).toFixed(2)
            : undefined,
        emailFromName: input.emailFromName,
        emailFromAddress: input.emailFromAddress,
        settings:
          input.settings !== undefined
            ? (input.settings as Prisma.InputJsonValue)
            : undefined,
      },
    });
  }

  async create(input: {
    legalName: string;
    displayName: string;
    slug: string;
    businessCategory?: 'DELIVERY' | 'INSTALLMENT' | 'ECOMMERCE';
    defaultCurrency?: string;
    timezone?: string;
    countryCode?: string;
    city?: string;
    planCode?: string;
    defaultTaxRate?: string | number;
    ownerEmail?: string;
    ownerPassword?: string;
    ownerFullName?: string;
    uploadedById: string;
    logoFileName?: string;
    logoMimeType?: string;
    logoSizeBytes?: string;
    logoContentBase64?: string;
  }) {
    const slug = input.slug.trim().toLowerCase();
    const existing = await this.prisma.company.findUnique({ where: { slug } });
    if (existing) {
      throw new BadRequestException('Company slug already exists');
    }

    const ownerEmail = input.ownerEmail?.trim().toLowerCase() || '';
    const ownerPassword = input.ownerPassword?.trim() || '';
    const createOwner = Boolean(ownerEmail && ownerPassword);

    if (ownerEmail && !ownerPassword) {
      throw new BadRequestException(
        'ownerPassword is required when ownerEmail is provided',
      );
    }
    if (ownerPassword && !ownerEmail) {
      throw new BadRequestException(
        'ownerEmail is required when ownerPassword is provided',
      );
    }
    if (createOwner && ownerPassword.length < 8) {
      throw new BadRequestException(
        'Owner password must be at least 8 characters',
      );
    }
    if (createOwner) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: ownerEmail },
      });
      if (existingUser) {
        throw new BadRequestException('Owner email is already registered');
      }
    }

    const taxRate = Number(input.defaultTaxRate ?? 15);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      throw new BadRequestException('defaultTaxRate must be between 0 and 100');
    }
    const defaultTaxRate = taxRate.toFixed(2);

    const logoBody = this.parseOptionalLogo(input);

    const plan = await this.prisma.plan.findUnique({
      where: { code: input.planCode ?? 'BASIC' },
    });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    let ownerRole: { id: string } | null = null;
    if (createOwner) {
      const role = await this.prisma.role.findUnique({
        where: { code: 'COMPANY_OWNER' },
      });
      if (!role || role.scope !== 'TENANT') {
        throw new NotFoundException('COMPANY_OWNER role not found');
      }
      ownerRole = role;
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setMonth(endsAt.getMonth() + 1);
    const passwordHash = createOwner
      ? await bcrypt.hash(ownerPassword, 12)
      : null;
    const ownerFullName =
      input.ownerFullName?.trim() || input.displayName.trim();

    this.tenant.setBypass(true);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const countryCode = input.countryCode ?? 'SA';
        const city = input.city?.trim() || null;

        const company = await tx.company.create({
          data: {
            legalName: input.legalName,
            displayName: input.displayName,
            slug,
            businessCategory: input.businessCategory ?? 'ECOMMERCE',
            defaultCurrency: input.defaultCurrency ?? 'SAR',
            timezone: input.timezone ?? 'Asia/Riyadh',
            countryCode,
            city,
            settings: {
              create: {
                defaultTaxRate,
              },
            },
          },
          include: { settings: true },
        });

        const subscription = await tx.subscription.create({
          data: {
            companyId: company.id,
            planId: plan.id,
            status: 'TRIALING',
            startsAt,
            endsAt,
            trialEndsAt: endsAt,
            activeCompanyId: company.id,
          },
        });

        let owner: unknown = null;
        if (createOwner && passwordHash && ownerRole) {
          const user = await tx.user.create({
            data: {
              fullName: ownerFullName,
              email: ownerEmail,
              passwordHash,
              status: 'ACTIVE',
            },
          });

          owner = await tx.companyUser.create({
            data: {
              companyId: company.id,
              userId: user.id,
              roleId: ownerRole.id,
              status: 'ACTIVE',
            },
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  status: true,
                },
              },
              role: true,
            },
          });
        }

        return {
          ...company,
          subscriptions: [subscription],
          owner,
        };
      });

      if (!logoBody) {
        return created;
      }

      const folder = this.storage.companyFolderKey(created.slug);
      const storageKey = `${folder}/company/${randomUUID()}-${logoBody.fileName}`;
      await this.storage.putObject({
        storageKey,
        body: logoBody.buffer,
        contentType: logoBody.mimeType,
      });

      const attachment = await this.prisma.attachment.create({
        data: {
          companyId: created.id,
          uploadedById: input.uploadedById,
          entityType: 'company',
          entityId: created.id,
          fileName: logoBody.fileName,
          mimeType: logoBody.mimeType,
          sizeBytes: BigInt(logoBody.buffer.length),
          storageKey,
          checksumSha256: createHash('sha256')
            .update(logoBody.buffer)
            .digest('hex'),
        },
      });

      const company = await this.prisma.company.update({
        where: { id: created.id },
        data: { logoAttachmentId: attachment.id },
        include: { settings: true },
      });

      return {
        ...company,
        subscriptions: created.subscriptions,
        owner: created.owner,
      };
    } finally {
      this.tenant.setBypass(false);
    }
  }

  private parseOptionalLogo(input: {
    logoFileName?: string;
    logoMimeType?: string;
    logoSizeBytes?: string;
    logoContentBase64?: string;
  }): { fileName: string; mimeType: string; buffer: Buffer } | null {
    const content = input.logoContentBase64?.trim();
    if (!content) {
      return null;
    }

    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];
    const mimeType = (input.logoMimeType || 'image/png').trim().toLowerCase();
    if (!allowed.includes(mimeType)) {
      throw new BadRequestException(
        'Unsupported logo type (use JPG, PNG, WEBP, or GIF)',
      );
    }

    const buffer = Buffer.from(content, 'base64');
    if (!buffer.length) {
      throw new BadRequestException('Logo content is empty');
    }
    if (buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException('Logo must be smaller than 5MB');
    }

    if (
      input.logoSizeBytes &&
      BigInt(input.logoSizeBytes) !== BigInt(buffer.length)
    ) {
      throw new BadRequestException('logoSizeBytes does not match content');
    }

    const fileName =
      input.logoFileName?.trim() ||
      `logo.${mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : mimeType === 'image/gif' ? 'gif' : 'jpg'}`;

    return { fileName, mimeType, buffer };
  }

  listDepartments(companyId: string, branchId?: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.companyDepartment.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        status: { not: 'ARCHIVED' },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createDepartment(input: {
    companyId: string;
    name: string;
    code?: string;
    branchId?: string;
    parentDepartmentId?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    if (input.branchId) {
      const branch = await this.prisma.companyBranch.findFirst({
        where: {
          id: input.branchId,
          companyId: input.companyId,
          deletedAt: null,
        },
      });
      if (!branch) throw new BadRequestException('Branch not found');
    }
    return this.prisma.companyDepartment.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        code: input.code,
        branchId: input.branchId,
        parentDepartmentId: input.parentDepartmentId,
      },
    });
  }

  async updateDepartment(
    companyId: string,
    departmentId: string,
    input: {
      name?: string;
      code?: string | null;
      branchId?: string | null;
      parentDepartmentId?: string | null;
      status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
    },
  ) {
    this.tenant.setCompanyId(companyId);
    const dept = await this.prisma.companyDepartment.findFirst({
      where: { id: departmentId, companyId },
    });
    if (!dept) throw new NotFoundException('Department not found');
    return this.prisma.companyDepartment.update({
      where: { id: departmentId },
      data: {
        name: input.name,
        code: input.code,
        branchId: input.branchId,
        parentDepartmentId: input.parentDepartmentId,
        status: input.status,
      },
    });
  }

  private async requireCompany(id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }
}
