import { Injectable, NotFoundException } from '@nestjs/common';
import { RoleFinancialProfile } from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { companyRolePrefix } from '../users/roles.service';

const DEFAULT_INDUSTRIES: Array<{
  code: string;
  nameEn: string;
  nameAr: string;
  roles: Array<{
    code: string;
    nameEn: string;
    nameAr: string;
    profile: RoleFinancialProfile;
  }>;
  categories: Array<{
    kind: string;
    code: string;
    nameEn: string;
    nameAr: string;
  }>;
}> = [
  {
    code: 'FLOWERS_GIFTS',
    nameEn: 'Flowers & gifts',
    nameAr: 'ورود وهدايا',
    roles: [
      {
        code: 'FLORIST',
        nameEn: 'Florist',
        nameAr: 'منسق ورود',
        profile: 'NONE',
      },
      {
        code: 'CASHIER',
        nameEn: 'Cashier',
        nameAr: 'كاشير',
        profile: 'CASHIER',
      },
      {
        code: 'DELIVERY',
        nameEn: 'Delivery rep',
        nameAr: 'مندوب توصيل',
        profile: 'SALES_DELIVERY',
      },
      {
        code: 'CS',
        nameEn: 'Customer service',
        nameAr: 'خدمة عملاء',
        profile: 'NONE',
      },
    ],
    categories: [
      {
        kind: 'ITEM_CATEGORY',
        code: 'BOUQUETS',
        nameEn: 'Bouquets',
        nameAr: 'باقات',
      },
      {
        kind: 'EXPENSE_CATEGORY',
        code: 'FLOWERS_SUPPLY',
        nameEn: 'Flower supply',
        nameAr: 'توريد ورود',
      },
      {
        kind: 'SUPPLIER_TYPE',
        code: 'FLORIST_WHOLESALE',
        nameEn: 'Flower wholesaler',
        nameAr: 'تاجر ورود جملة',
      },
    ],
  },
  {
    code: 'RESTAURANT',
    nameEn: 'Restaurant / F&B',
    nameAr: 'مطاعم ومقاهي',
    roles: [
      { code: 'CHEF', nameEn: 'Chef', nameAr: 'شيف', profile: 'NONE' },
      {
        code: 'WAITER',
        nameEn: 'Waiter',
        nameAr: 'مباشر',
        profile: 'NONE',
      },
      {
        code: 'CASHIER',
        nameEn: 'Cashier',
        nameAr: 'كاشير',
        profile: 'CASHIER',
      },
      {
        code: 'OPS',
        nameEn: 'Ops staff',
        nameAr: 'عامل تشغيل',
        profile: 'NONE',
      },
    ],
    categories: [
      {
        kind: 'ITEM_CATEGORY',
        code: 'MENU',
        nameEn: 'Menu',
        nameAr: 'قائمة طعام',
      },
      {
        kind: 'EXPENSE_CATEGORY',
        code: 'FOOD_COST',
        nameEn: 'Food cost',
        nameAr: 'تكلفة مواد غذائية',
      },
      {
        kind: 'SUPPLIER_TYPE',
        code: 'FOOD_SUPPLIER',
        nameEn: 'Food supplier',
        nameAr: 'مورد أغذية',
      },
    ],
  },
  {
    code: 'RETAIL',
    nameEn: 'Retail',
    nameAr: 'تجزئة',
    roles: [
      {
        code: 'CASHIER',
        nameEn: 'Cashier',
        nameAr: 'كاشير',
        profile: 'CASHIER',
      },
      {
        code: 'SALES',
        nameEn: 'Sales associate',
        nameAr: 'بائع',
        profile: 'SALES_DELIVERY',
      },
      {
        code: 'WAREHOUSE',
        nameEn: 'Warehouse',
        nameAr: 'أمين مخزن',
        profile: 'WAREHOUSE_KEEPER',
      },
    ],
    categories: [
      {
        kind: 'ITEM_CATEGORY',
        code: 'GENERAL',
        nameEn: 'General merchandise',
        nameAr: 'بضاعة عامة',
      },
      {
        kind: 'EXPENSE_CATEGORY',
        code: 'STORE_OPS',
        nameEn: 'Store ops',
        nameAr: 'تشغيل المتجر',
      },
    ],
  },
  {
    code: 'SERVICES',
    nameEn: 'Professional services',
    nameAr: 'خدمات مهنية',
    roles: [
      {
        code: 'CONSULTANT',
        nameEn: 'Consultant',
        nameAr: 'مستشار',
        profile: 'NONE',
      },
      {
        code: 'ACCOUNTANT',
        nameEn: 'Accountant',
        nameAr: 'محاسب',
        profile: 'ACCOUNTANT',
      },
    ],
    categories: [
      {
        kind: 'ITEM_CATEGORY',
        code: 'SERVICE',
        nameEn: 'Services',
        nameAr: 'خدمات',
      },
      {
        kind: 'EXPENSE_CATEGORY',
        code: 'PROF_FEES',
        nameEn: 'Professional fees',
        nameAr: 'أتعاب مهنية',
      },
    ],
  },
  {
    code: 'PHARMACY',
    nameEn: 'Pharmacy',
    nameAr: 'صيدلية',
    roles: [
      {
        code: 'PHARMACIST',
        nameEn: 'Pharmacist',
        nameAr: 'صيدلي',
        profile: 'NONE',
      },
      {
        code: 'CASHIER',
        nameEn: 'Cashier',
        nameAr: 'كاشير',
        profile: 'CASHIER',
      },
    ],
    categories: [
      {
        kind: 'ITEM_CATEGORY',
        code: 'MEDS',
        nameEn: 'Medicines',
        nameAr: 'أدوية',
      },
    ],
  },
  {
    code: 'AUTO_SERVICE',
    nameEn: 'Auto service',
    nameAr: 'خدمات سيارات',
    roles: [
      {
        code: 'TECH',
        nameEn: 'Technician',
        nameAr: 'فني',
        profile: 'NONE',
      },
      {
        code: 'CASHIER',
        nameEn: 'Cashier',
        nameAr: 'كاشير',
        profile: 'CASHIER',
      },
    ],
    categories: [
      {
        kind: 'ITEM_CATEGORY',
        code: 'PARTS',
        nameEn: 'Parts',
        nameAr: 'قطع غيار',
      },
    ],
  },
  {
    code: 'SALON',
    nameEn: 'Salon / beauty',
    nameAr: 'صالون وتجميل',
    roles: [
      {
        code: 'STYLIST',
        nameEn: 'Stylist',
        nameAr: 'مصفف',
        profile: 'NONE',
      },
      {
        code: 'CASHIER',
        nameEn: 'Cashier',
        nameAr: 'كاشير',
        profile: 'CASHIER',
      },
    ],
    categories: [
      {
        kind: 'ITEM_CATEGORY',
        code: 'TREATMENTS',
        nameEn: 'Treatments',
        nameAr: 'جلسات',
      },
    ],
  },
  {
    code: 'CONSTRUCTION',
    nameEn: 'Construction',
    nameAr: 'مقاولات',
    roles: [
      {
        code: 'SITE_SUPER',
        nameEn: 'Site supervisor',
        nameAr: 'مشرف موقع',
        profile: 'MANAGER_SUPERVISOR',
      },
      {
        code: 'WAREHOUSE',
        nameEn: 'Storekeeper',
        nameAr: 'أمين مستودع',
        profile: 'WAREHOUSE_KEEPER',
      },
    ],
    categories: [
      {
        kind: 'ITEM_CATEGORY',
        code: 'MATERIALS',
        nameEn: 'Materials',
        nameAr: 'مواد',
      },
    ],
  },
];

@Injectable()
export class IndustryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async ensureCatalog() {
    let sort = 0;
    for (const industry of DEFAULT_INDUSTRIES) {
      sort += 10;
      const row = await this.prisma.industryActivity.upsert({
        where: { code: industry.code },
        update: {
          nameEn: industry.nameEn,
          nameAr: industry.nameAr,
          isActive: true,
          sortOrder: sort,
        },
        create: {
          code: industry.code,
          nameEn: industry.nameEn,
          nameAr: industry.nameAr,
          isActive: true,
          sortOrder: sort,
        },
      });
      for (const role of industry.roles) {
        await this.prisma.industryPackRoleTemplate.upsert({
          where: {
            industryActivityId_roleCode: {
              industryActivityId: row.id,
              roleCode: role.code,
            },
          },
          update: {
            roleNameEn: role.nameEn,
            roleNameAr: role.nameAr,
            financialProfile: role.profile,
          },
          create: {
            industryActivityId: row.id,
            roleCode: role.code,
            roleNameEn: role.nameEn,
            roleNameAr: role.nameAr,
            financialProfile: role.profile,
            permissionCodes: [],
          },
        });
      }
      for (const cat of industry.categories) {
        await this.prisma.industryPackCategoryTemplate.upsert({
          where: {
            industryActivityId_kind_code: {
              industryActivityId: row.id,
              kind: cat.kind,
              code: cat.code,
            },
          },
          update: { nameEn: cat.nameEn, nameAr: cat.nameAr },
          create: {
            industryActivityId: row.id,
            kind: cat.kind,
            code: cat.code,
            nameEn: cat.nameEn,
            nameAr: cat.nameAr,
          },
        });
      }
    }
    return this.listCatalog();
  }

  listCatalog() {
    return this.prisma.industryActivity.findMany({
      where: { isActive: true },
      include: {
        roleTemplates: true,
        categoryTemplates: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  listActivations(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.companyIndustryActivation.findMany({
      where: { companyId },
      include: { industry: true },
      orderBy: { appliedAt: 'desc' },
    });
  }

  async applyPack(
    companyId: string,
    industryActivityId: string,
    appliedByUserId?: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const industry = await this.prisma.industryActivity.findFirst({
      where: { id: industryActivityId, isActive: true },
      include: { roleTemplates: true, categoryTemplates: true },
    });
    if (!industry) throw new NotFoundException('Industry not found');

    const activation = await this.prisma.companyIndustryActivation.upsert({
      where: {
        companyId_industryActivityId: {
          companyId,
          industryActivityId: industry.id,
        },
      },
      update: { appliedByUserId, appliedAt: new Date() },
      create: {
        companyId,
        industryActivityId: industry.id,
        appliedByUserId,
      },
    });

    const prefix = companyRolePrefix(companyId);
    const createdRoles: string[] = [];
    for (const tmpl of industry.roleTemplates) {
      const code = `${prefix}${tmpl.roleCode}`.slice(0, 50);
      const existing = await this.prisma.role.findUnique({ where: { code } });
      if (existing) continue;
      await this.prisma.role.create({
        data: {
          code,
          name: tmpl.roleNameAr || tmpl.roleNameEn,
          description: `${industry.nameEn} / ${tmpl.roleNameEn}`,
          scope: 'TENANT',
          isSystem: false,
          companyId,
          financialProfile: tmpl.financialProfile,
        },
      });
      createdRoles.push(code);
    }

    const createdCategories: string[] = [];
    for (const tmpl of industry.categoryTemplates) {
      if (tmpl.kind === 'ITEM_CATEGORY') {
        const codeKey = tmpl.code.slice(0, 40);
        const exists = await this.prisma.itemCategory.findFirst({
          where: { companyId, codeKey },
        });
        if (!exists) {
          await this.prisma.itemCategory.create({
            data: {
              companyId,
              name: tmpl.nameEn,
              code: codeKey,
              codeKey,
            },
          });
          createdCategories.push(tmpl.code);
        }
      } else if (tmpl.kind === 'EXPENSE_CATEGORY') {
        const codeKey = tmpl.code.slice(0, 40);
        const exists = await this.prisma.expenseCategory.findFirst({
          where: { companyId, codeKey },
        });
        if (!exists) {
          await this.prisma.expenseCategory.create({
            data: {
              companyId,
              name: tmpl.nameEn,
              code: codeKey,
              codeKey,
            },
          });
          createdCategories.push(tmpl.code);
        }
      }
    }

    return {
      activation,
      createdRoles,
      createdCategories,
      industry: { id: industry.id, code: industry.code },
    };
  }
}
