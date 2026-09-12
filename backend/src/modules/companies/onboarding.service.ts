import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ComplianceDocumentType,
  Prisma,
  ServiceRequestStatus,
  VatStatus,
} from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BusinessHoursService } from '../governance/business-hours.service';

export type OnboardingState = {
  currentStep: number;
  completedSteps: number[];
  skippedSteps: number[];
  completedAt: string | null;
  serviceRequestIds: string[];
};

const DEFAULT_ONBOARDING: OnboardingState = {
  currentStep: 1,
  completedSteps: [],
  skippedSteps: [],
  completedAt: null,
  serviceRequestIds: [],
};

const COMPLIANCE_TYPES = Object.values(ComplianceDocumentType);

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly notifications: NotificationsService,
    private readonly businessHours: BusinessHoursService,
  ) {}

  static seedOnboardingSettings(
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      ...extra,
      onboarding: { ...DEFAULT_ONBOARDING },
    };
  }

  private asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private parseOnboarding(raw: unknown): OnboardingState | null {
    const bag = this.asObject(raw);
    const o = this.asObject(bag.onboarding);
    if (!Object.keys(o).length) return null;
    return {
      currentStep: Number(o.currentStep ?? 1) || 1,
      completedSteps: Array.isArray(o.completedSteps)
        ? o.completedSteps.map((n) => Number(n)).filter((n) => n >= 1 && n <= 5)
        : [],
      skippedSteps: Array.isArray(o.skippedSteps)
        ? o.skippedSteps.map((n) => Number(n)).filter((n) => n >= 1 && n <= 5)
        : [],
      completedAt:
        typeof o.completedAt === 'string' && o.completedAt
          ? o.completedAt
          : null,
      serviceRequestIds: Array.isArray(o.serviceRequestIds)
        ? o.serviceRequestIds.map(String)
        : [],
    };
  }

  /** Companies created on/after this date without an onboarding bag must complete the wizard. */
  private static readonly ONBOARDING_FEATURE_AT = new Date(
    '2026-09-03T00:00:00.000Z',
  );

  /** Existing tenants without onboarding key are treated as already done — unless created after the feature launch. */
  resolveOnboarding(
    settingsJson: unknown,
    companyCreatedAt?: Date | null,
  ): OnboardingState {
    const parsed = this.parseOnboarding(settingsJson);
    if (parsed) return parsed;

    const created = companyCreatedAt ? new Date(companyCreatedAt) : null;
    if (
      created &&
      !Number.isNaN(created.getTime()) &&
      created.getTime() >= OnboardingService.ONBOARDING_FEATURE_AT.getTime()
    ) {
      return { ...DEFAULT_ONBOARDING };
    }

    return {
      ...DEFAULT_ONBOARDING,
      currentStep: 5,
      completedSteps: [1, 2, 3, 4, 5],
      completedAt: 'legacy',
    };
  }

  private async loadCompany(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      include: { settings: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  /** Persist incomplete onboarding bag when missing for post-feature companies. */
  private async ensureOnboardingPersisted(
    companyId: string,
    settingsJson: unknown,
    companyCreatedAt: Date,
  ) {
    if (this.parseOnboarding(settingsJson)) return;
    const resolved = this.resolveOnboarding(settingsJson, companyCreatedAt);
    if (resolved.completedAt === 'legacy') return;
    await this.mergeSettingsBag(companyId, { onboarding: resolved });
  }

  private async mergeSettingsBag(
    companyId: string,
    patch: Record<string, unknown>,
  ) {
    const company = await this.loadCompany(companyId);
    const current = this.asObject(company.settings?.settings);
    const next = { ...current, ...patch };
    await this.prisma.companySettings.upsert({
      where: { companyId },
      create: {
        companyId,
        settings: next as Prisma.InputJsonValue,
      },
      update: {
        settings: next as Prisma.InputJsonValue,
      },
    });
    return next;
  }

  private async saveOnboarding(companyId: string, state: OnboardingState) {
    await this.mergeSettingsBag(companyId, { onboarding: state });
    return state;
  }

  async getStatus(companyId: string) {
    let company = await this.loadCompany(companyId);
    if (!this.parseOnboarding(company.settings?.settings)) {
      await this.ensureOnboardingPersisted(
        companyId,
        company.settings?.settings,
        company.createdAt,
      );
      company = await this.loadCompany(companyId);
    }
    const bag = this.asObject(company.settings?.settings);
    const onboarding = this.resolveOnboarding(
      company.settings?.settings,
      company.createdAt,
    );

    const [documents, serviceRequests, fiscalYears, bankAccounts, bh] =
      await Promise.all([
        this.prisma.companyComplianceDocument.findMany({
          where: { companyId },
          orderBy: { documentType: 'asc' },
        }),
        this.prisma.companyServiceRequest.findMany({
          where: { companyId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        this.prisma.fiscalYear.findMany({
          where: { companyId },
          include: { openingBalances: true },
          orderBy: { startsOn: 'desc' },
        }),
        this.prisma.bankAccount.findMany({
          where: { companyId, status: 'ACTIVE' },
          select: {
            id: true,
            name: true,
            bankName: true,
            accountType: true,
            currency: true,
            ibanLast4: true,
          },
        }),
        this.businessHours.getProfile(companyId).catch(() => null),
      ]);

    return {
      onboarding,
      company: {
        id: company.id,
        legalName: company.legalName,
        displayName: company.displayName,
        defaultCurrency: company.defaultCurrency,
        timezone: company.timezone,
        countryCode: company.countryCode,
        city: company.city,
        logoAttachmentId: company.logoAttachmentId,
        taxNumber: company.settings?.taxNumber ?? null,
        defaultTaxRate: company.settings?.defaultTaxRate?.toString() ?? null,
        emailFromName: company.settings?.emailFromName ?? null,
        emailFromAddress: company.settings?.emailFromAddress ?? null,
      },
      profile: {
        unifiedNumber: bag.unifiedNumber ?? null,
        commercialRegistrationNumber: bag.commercialRegistrationNumber ?? null,
        licenseNumber: bag.licenseNumber ?? null,
        addressLine: bag.addressLine ?? null,
        activityDescription: bag.activityDescription ?? null,
        activityType: bag.activityType ?? null,
        ownerPhone: bag.ownerPhone ?? null,
        companyPhone: bag.companyPhone ?? null,
        mapUrl: bag.mapUrl ?? null,
        mapLat: bag.mapLat ?? null,
        mapLng: bag.mapLng ?? null,
        officialEmail: bag.officialEmail ?? company.settings?.emailFromAddress ?? null,
        vatStatus: bag.vatStatus ?? 'TAXABLE',
        secondaryCurrencies: bag.secondaryCurrencies ?? [],
        paymentMethods: bag.paymentMethods ?? [],
        posDevices: bag.posDevices ?? [],
        salesChannels: bag.salesChannels ?? {},
        socialAccounts: bag.socialAccounts ?? {},
        adsAccounts: bag.adsAccounts ?? {},
        whatsappBusiness: bag.whatsappBusiness ?? null,
        complianceAlertDays: bag.complianceAlertDays ?? [30, 60],
      },
      businessHours: bh
        ? { mode: bh.mode, id: bh.id }
        : null,
      documents,
      serviceRequests,
      fiscalYears,
      bankAccounts,
    };
  }

  async saveStep(
    companyId: string,
    step: number,
    body: Record<string, unknown>,
    userId?: string,
  ) {
    if (step < 1 || step > 5) {
      throw new BadRequestException('step must be 1..5');
    }
    const company = await this.loadCompany(companyId);
    const onboarding = this.resolveOnboarding(
      company.settings?.settings,
      company.createdAt,
    );
    if (onboarding.completedAt && onboarding.completedAt !== 'legacy') {
      // Allow edits after completion
    }

    if (step === 1) await this.saveStep1(companyId, body);
    else if (step === 2) await this.saveStep2(companyId, body);
    else if (step === 3) await this.saveStep3(companyId, body, userId);
    else if (step === 4) await this.saveStep4(companyId, body);
    else if (step === 5) await this.saveStep5(companyId, body);

    const completed = new Set(onboarding.completedSteps);
    completed.add(step);
    const skipped = onboarding.skippedSteps.filter((s) => s !== step);
    const nextStep = Math.min(5, Math.max(onboarding.currentStep, step + 1));
    await this.saveOnboarding(companyId, {
      ...onboarding,
      currentStep: nextStep,
      completedSteps: [...completed].sort(),
      skippedSteps: skipped,
    });

    return this.getStatus(companyId);
  }

  async skipStep(companyId: string, step: number) {
    if (step < 1 || step > 5) {
      throw new BadRequestException('step must be 1..5');
    }
    const company = await this.loadCompany(companyId);
    const onboarding = this.resolveOnboarding(
      company.settings?.settings,
      company.createdAt,
    );
    const skipped = new Set(onboarding.skippedSteps);
    skipped.add(step);
    const nextStep = Math.min(5, Math.max(onboarding.currentStep, step + 1));
    await this.saveOnboarding(companyId, {
      ...onboarding,
      currentStep: nextStep,
      skippedSteps: [...skipped].sort(),
    });
    return this.getStatus(companyId);
  }

  async complete(companyId: string) {
    const company = await this.loadCompany(companyId);
    const onboarding = this.resolveOnboarding(
      company.settings?.settings,
      company.createdAt,
    );
    await this.saveOnboarding(companyId, {
      ...onboarding,
      currentStep: 5,
      completedAt: new Date().toISOString(),
    });
    return this.getStatus(companyId);
  }

  async createServiceRequest(
    companyId: string,
    input: {
      step: number;
      requestType: string;
      note?: string;
      userId?: string;
    },
  ) {
    const company = await this.loadCompany(companyId);
    const requestType = input.requestType.trim().slice(0, 80);
    if (!requestType) throw new BadRequestException('requestType required');
    if (input.step < 1 || input.step > 5) {
      throw new BadRequestException('step must be 1..5');
    }

    const row = await this.prisma.companyServiceRequest.create({
      data: {
        companyId,
        step: input.step,
        requestType,
        note: input.note?.trim().slice(0, 500) || null,
        createdById: input.userId || null,
        status: 'OPEN',
      },
    });

    const onboarding = this.resolveOnboarding(
      company.settings?.settings,
      company.createdAt,
    );
    const ids = new Set(onboarding.serviceRequestIds);
    ids.add(row.id);
    await this.saveOnboarding(companyId, {
      ...onboarding,
      serviceRequestIds: [...ids],
    });

    // Soft-link compliance docs when request matches a document type
    const docType = requestType.replace(/^REQUEST_/, '');
    if ((COMPLIANCE_TYPES as string[]).includes(docType)) {
      await this.prisma.companyComplianceDocument.upsert({
        where: {
          companyId_documentType: {
            companyId,
            documentType: docType as ComplianceDocumentType,
          },
        },
        create: {
          companyId,
          documentType: docType as ComplianceDocumentType,
          serviceRequestedAt: new Date(),
          details: {},
        },
        update: { serviceRequestedAt: new Date() },
      });
    }

    await this.notifyCompanyWriters(companyId, {
      type: 'onboarding.service_request',
      title: `Service request: ${requestType}`,
      body: `Company "${company.displayName}" requested ${requestType}${
        input.note ? `: ${input.note}` : ''
      }`,
      actionUrl: `/platform/service-requests`,
      data: { requestId: row.id, requestType, step: input.step },
    });

    return row;
  }

  async listServiceRequests(opts?: {
    status?: ServiceRequestStatus;
    limit?: number;
  }) {
    this.tenant.setBypass(true);
    try {
      const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 300);
      return this.prisma.companyServiceRequest.findMany({
        where: opts?.status ? { status: opts.status } : undefined,
        include: {
          company: {
            select: { id: true, displayName: true, slug: true },
          },
          createdBy: {
            select: { id: true, fullName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } finally {
      this.tenant.setBypass(false);
    }
  }

  async updateServiceRequestStatus(
    requestId: string,
    status: ServiceRequestStatus,
  ) {
    this.tenant.setBypass(true);
    try {
      const row = await this.prisma.companyServiceRequest.findUnique({
        where: { id: requestId },
      });
      if (!row) throw new NotFoundException('Service request not found');
      return this.prisma.companyServiceRequest.update({
        where: { id: requestId },
        data: { status },
      });
    } finally {
      this.tenant.setBypass(false);
    }
  }

  private async saveStep1(companyId: string, body: Record<string, unknown>) {
    const company = await this.loadCompany(companyId);
    const displayName =
      typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const patch: Record<string, unknown> = {};
    if (typeof body.unifiedNumber === 'string') {
      patch.unifiedNumber = body.unifiedNumber.trim() || null;
    }
    if (typeof body.addressLine === 'string') {
      patch.addressLine = body.addressLine.trim() || null;
    }
    if (typeof body.activityDescription === 'string') {
      patch.activityDescription = body.activityDescription.trim() || null;
    }
    if (typeof body.activityType === 'string') {
      patch.activityType = body.activityType.trim() || null;
    }
    if (typeof body.mapUrl === 'string') patch.mapUrl = body.mapUrl.trim() || null;
    if (body.mapLat !== undefined) patch.mapLat = body.mapLat;
    if (body.mapLng !== undefined) patch.mapLng = body.mapLng;
    if (typeof body.officialEmail === 'string') {
      patch.officialEmail = body.officialEmail.trim() || null;
    }
    if (typeof body.companyPhone === 'string') {
      patch.companyPhone = body.companyPhone.trim() || null;
    }
    if (typeof body.ownerPhone === 'string') {
      patch.ownerPhone = body.ownerPhone.trim() || null;
    }

    if (Object.keys(patch).length) {
      await this.mergeSettingsBag(companyId, patch);
    }

    const companyPatch: Prisma.CompanyUpdateInput = {};
    if (displayName.length >= 2) companyPatch.displayName = displayName;
    if (typeof body.city === 'string') {
      companyPatch.city = body.city.trim() || null;
    }
    if (typeof body.countryCode === 'string' && body.countryCode.trim()) {
      companyPatch.countryCode = body.countryCode.trim().slice(0, 2);
    }
    if (typeof body.timezone === 'string' && body.timezone.trim()) {
      companyPatch.timezone = body.timezone.trim();
    }
    if (Object.keys(companyPatch).length) {
      await this.prisma.company.update({
        where: { id: companyId },
        data: companyPatch,
      });
    }

    if (typeof body.officialEmail === 'string') {
      await this.prisma.companySettings.update({
        where: { companyId },
        data: {
          emailFromAddress: body.officialEmail.trim() || null,
          emailFromName:
            displayName || company.displayName,
        },
      });
    }

    if (typeof body.businessHoursMode === 'string') {
      await this.businessHours.upsertProfile(companyId, {
        mode: body.businessHoursMode,
      });
    }
  }

  private async saveStep2(companyId: string, body: Record<string, unknown>) {
    const docs = Array.isArray(body.documents) ? body.documents : [];
    for (const raw of docs) {
      if (!raw || typeof raw !== 'object') continue;
      const doc = raw as Record<string, unknown>;
      const documentType = String(doc.documentType ?? '');
      if (!(COMPLIANCE_TYPES as string[]).includes(documentType)) continue;

      const details =
        doc.details && typeof doc.details === 'object' && !Array.isArray(doc.details)
          ? (doc.details as Record<string, unknown>)
          : {};

      await this.prisma.companyComplianceDocument.upsert({
        where: {
          companyId_documentType: {
            companyId,
            documentType: documentType as ComplianceDocumentType,
          },
        },
        create: {
          companyId,
          documentType: documentType as ComplianceDocumentType,
          documentNumber:
            typeof doc.documentNumber === 'string'
              ? doc.documentNumber.trim() || null
              : null,
          issuedOn: this.parseDate(doc.issuedOn),
          expiresOn: this.parseDate(doc.expiresOn),
          details: details as Prisma.InputJsonValue,
        },
        update: {
          documentNumber:
            typeof doc.documentNumber === 'string'
              ? doc.documentNumber.trim() || null
              : undefined,
          issuedOn: this.parseDate(doc.issuedOn),
          expiresOn: this.parseDate(doc.expiresOn),
          details: details as Prisma.InputJsonValue,
        },
      });

      // Mirror CR / license / VAT into legacy settings bag + taxNumber
      if (documentType === 'COMMERCIAL_REGISTRATION') {
        await this.mergeSettingsBag(companyId, {
          commercialRegistrationNumber:
            typeof doc.documentNumber === 'string'
              ? doc.documentNumber.trim() || null
              : null,
        });
      }
      if (documentType === 'MUNICIPAL_LICENSE') {
        await this.mergeSettingsBag(companyId, {
          licenseNumber:
            typeof doc.documentNumber === 'string'
              ? doc.documentNumber.trim() || null
              : null,
        });
      }
      if (documentType === 'VAT_CERTIFICATE') {
        const tax = typeof doc.documentNumber === 'string'
          ? doc.documentNumber.trim()
          : '';
        if (tax) {
          await this.prisma.companySettings.update({
            where: { companyId },
            data: { taxNumber: tax },
          });
        }
      }
    }

    if (Array.isArray(body.complianceAlertDays)) {
      const days = body.complianceAlertDays
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0 && n <= 365);
      await this.mergeSettingsBag(companyId, {
        complianceAlertDays: days.length ? days : [30, 60],
      });
    }
  }

  private async saveStep3(
    companyId: string,
    body: Record<string, unknown>,
    _userId?: string,
  ) {
    const company = await this.loadCompany(companyId);
    const patch: Record<string, unknown> = {};

    if (typeof body.vatStatus === 'string') {
      const vs = body.vatStatus.toUpperCase();
      if (['TAXABLE', 'EXEMPT', 'NOT_SUBJECT'].includes(vs)) {
        patch.vatStatus = vs as VatStatus;
      }
    }
    if (Array.isArray(body.secondaryCurrencies)) {
      patch.secondaryCurrencies = body.secondaryCurrencies.map(String);
    }
    if (Array.isArray(body.paymentMethods)) {
      patch.paymentMethods = body.paymentMethods.map(String);
    }
    if (Array.isArray(body.posDevices)) {
      patch.posDevices = body.posDevices;
    }
    if (Object.keys(patch).length) {
      await this.mergeSettingsBag(companyId, patch);
    }

    if (typeof body.defaultCurrency === 'string' && body.defaultCurrency.trim()) {
      await this.prisma.company.update({
        where: { id: companyId },
        data: { defaultCurrency: body.defaultCurrency.trim().slice(0, 3) },
      });
    }
    if (body.defaultTaxRate !== undefined) {
      const rate = Number(body.defaultTaxRate);
      if (Number.isFinite(rate) && rate >= 0 && rate <= 100) {
        await this.prisma.companySettings.update({
          where: { companyId },
          data: { defaultTaxRate: rate.toFixed(2) },
        });
      }
    }

    // Fiscal year upsert (single current)
    if (body.fiscalYear && typeof body.fiscalYear === 'object') {
      const fy = body.fiscalYear as Record<string, unknown>;
      const startsOn = this.parseDate(fy.startsOn);
      const endsOn = this.parseDate(fy.endsOn);
      if (startsOn && endsOn) {
        await this.prisma.fiscalYear.updateMany({
          where: { companyId, isCurrent: true },
          data: { isCurrent: false },
        });
        const name =
          typeof fy.name === 'string' && fy.name.trim()
            ? fy.name.trim()
            : `${startsOn.toISOString().slice(0, 4)}`;
        const existingId =
          typeof fy.id === 'string' && fy.id ? fy.id : null;
        let fiscalYearId = existingId;
        if (existingId) {
          await this.prisma.fiscalYear.update({
            where: { id: existingId },
            data: { name, startsOn, endsOn, isCurrent: true },
          });
        } else {
          const created = await this.prisma.fiscalYear.create({
            data: {
              companyId,
              name,
              startsOn,
              endsOn,
              isCurrent: true,
            },
          });
          fiscalYearId = created.id;
        }

        if (fiscalYearId && Array.isArray(body.openingBalances)) {
          const currency =
            typeof body.defaultCurrency === 'string' && body.defaultCurrency
              ? body.defaultCurrency.trim().slice(0, 3)
              : company.defaultCurrency;
          for (const raw of body.openingBalances) {
            if (!raw || typeof raw !== 'object') continue;
            const line = raw as Record<string, unknown>;
            const accountKey = String(line.accountKey ?? '').trim();
            if (!accountKey) continue;
            const amount = Number(line.amount ?? 0);
            if (!Number.isFinite(amount)) continue;
            await this.prisma.openingBalanceLine.upsert({
              where: {
                fiscalYearId_accountKey: {
                  fiscalYearId,
                  accountKey,
                },
              },
              create: {
                companyId,
                fiscalYearId,
                accountKey,
                label:
                  typeof line.label === 'string' ? line.label.trim() : null,
                amount: amount.toFixed(2),
                currency,
              },
              update: {
                label:
                  typeof line.label === 'string' ? line.label.trim() : null,
                amount: amount.toFixed(2),
                currency,
              },
            });
          }
        }
      }
    }

    // Optional bank account create (one at a time from wizard)
    if (body.bankAccount && typeof body.bankAccount === 'object') {
      const ba = body.bankAccount as Record<string, unknown>;
      const name = typeof ba.name === 'string' ? ba.name.trim() : '';
      if (name) {
        await this.prisma.bankAccount.create({
          data: {
            companyId,
            name,
            accountType: 'BANK',
            bankName:
              typeof ba.bankName === 'string' ? ba.bankName.trim() || null : null,
            currency:
              typeof ba.currency === 'string' && ba.currency.trim()
                ? ba.currency.trim().slice(0, 3)
                : company.defaultCurrency,
            // IBAN encryption is handled by finance service; store last4 hint only here if provided
            ibanLast4:
              typeof ba.iban === 'string' && ba.iban.trim().length >= 4
                ? ba.iban.replace(/\s/g, '').slice(-4)
                : null,
          },
        });
      }
    }
  }

  private async saveStep4(companyId: string, body: Record<string, unknown>) {
    const patch: Record<string, unknown> = {};
    if (body.salesChannels && typeof body.salesChannels === 'object') {
      patch.salesChannels = body.salesChannels;
    }
    if (Object.keys(patch).length) {
      await this.mergeSettingsBag(companyId, patch);
    }
  }

  private async saveStep5(companyId: string, body: Record<string, unknown>) {
    const patch: Record<string, unknown> = {};
    if (body.socialAccounts && typeof body.socialAccounts === 'object') {
      patch.socialAccounts = body.socialAccounts;
    }
    if (body.adsAccounts && typeof body.adsAccounts === 'object') {
      patch.adsAccounts = body.adsAccounts;
    }
    if (body.whatsappBusiness !== undefined) {
      patch.whatsappBusiness = body.whatsappBusiness;
    }
    if (Object.keys(patch).length) {
      await this.mergeSettingsBag(companyId, patch);
    }
  }

  private parseDate(value: unknown): Date | null {
    if (value == null || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const s = String(value).trim();
    if (!s) return null;
    const d = new Date(s.length === 10 ? `${s}T00:00:00.000Z` : s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private async notifyCompanyWriters(
    companyId: string,
    input: {
      type: string;
      title: string;
      body: string;
      actionUrl?: string;
      data?: Record<string, unknown>;
    },
  ) {
    const members = await this.prisma.companyUser.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        role: {
          permissions: {
            some: { permission: { code: 'companies.write' } },
          },
        },
      },
      select: { userId: true },
    });
    for (const m of members) {
      try {
        await this.notifications.createAndPush({
          companyId,
          userId: m.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          actionUrl: input.actionUrl,
          data: input.data,
          sendPush: false,
        });
      } catch {
        // ignore per-user failures
      }
    }
  }
}
