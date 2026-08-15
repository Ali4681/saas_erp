import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BankAccountType,
  ExpenseStatus,
  FinancialDirection,
  FinancialTransactionType,
  Prisma,
} from '../../generated/prisma/client';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { DocumentNumberService } from '../../common/documents/document-number.service';
import { assertValidSaudiIban, normalizeIban } from '../../common/iban';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';

function fingerprintIban(iban: string): string {
  return createHash('sha256').update(normalizeIban(iban)).digest('hex');
}

function assertSingleSource(input: {
  externalOrderId?: string | null;
  installmentTransactionId?: string | null;
  externalSettlementId?: string | null;
  expenseId?: string | null;
  salesInvoiceId?: string | null;
  supplierBillId?: string | null;
}) {
  const sources = [
    input.externalOrderId,
    input.installmentTransactionId,
    input.externalSettlementId,
    input.expenseId,
    input.salesInvoiceId,
    input.supplierBillId,
  ].filter((value) => value != null && value !== '');
  if (sources.length > 1) {
    throw new BadRequestException(
      'At most one source FK is allowed on a financial transaction',
    );
  }
}

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
    private readonly docNumbers: DocumentNumberService,
  ) {}

  // --- Bank accounts ---

  listBankAccounts(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.bankAccount.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        companyId: true,
        name: true,
        accountType: true,
        bankName: true,
        ibanLast4: true,
        currency: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createBankAccount(input: {
    companyId: string;
    name: string;
    accountType: BankAccountType;
    bankName?: string;
    iban?: string;
    currency?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const ibanData = this.encryptIban(input.iban);
    return this.prisma.bankAccount.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        accountType: input.accountType,
        bankName: input.bankName,
        currency: input.currency ?? 'SAR',
        ...ibanData,
      },
      select: {
        id: true,
        name: true,
        accountType: true,
        bankName: true,
        ibanLast4: true,
        currency: true,
        status: true,
      },
    });
  }

  // --- Expense categories ---

  listExpenseCategories(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.expenseCategory.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
  }

  async createExpenseCategory(input: {
    companyId: string;
    name: string;
    code?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const code = input.code?.trim() || null;
    return this.prisma.expenseCategory.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        code,
        codeKey: code ?? '',
      },
    });
  }

  // --- Expenses ---

  listExpenses(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.expense.findMany({
      include: {
        category: true,
        bankAccount: {
          select: { id: true, name: true, ibanLast4: true, currency: true },
        },
      },
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async createExpense(input: {
    companyId: string;
    createdById: string;
    expenseCategoryId: string;
    description: string;
    amount: string | number;
    currency?: string;
    expenseDate: string;
    bankAccountId?: string;
    connectedProjectId?: string;
    referenceNumber?: string;
    status?: ExpenseStatus;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const amount = String(input.amount);
    if (Number(amount) <= 0) {
      throw new BadRequestException('Expense amount must be > 0');
    }

    await this.prisma.expenseCategory.findFirstOrThrow({
      where: { id: input.expenseCategoryId, companyId: input.companyId },
    });

    if (input.connectedProjectId) {
      const project = await this.prisma.connectedProject.findFirst({
        where: { id: input.connectedProjectId, companyId: input.companyId },
      });
      if (!project) {
        throw new BadRequestException('Project does not belong to company');
      }
    }

    const status = input.status ?? 'DRAFT';
    const expense = await this.prisma.expense.create({
      data: {
        companyId: input.companyId,
        expenseCategoryId: input.expenseCategoryId,
        bankAccountId: input.bankAccountId,
        connectedProjectId: input.connectedProjectId,
        description: input.description,
        amount,
        currency: input.currency ?? 'SAR',
        expenseDate: new Date(input.expenseDate),
        status,
        referenceNumber: input.referenceNumber,
        createdById: input.createdById,
      },
      include: { category: true },
    });

    if (status === 'PAID') {
      await this.createExpenseLedgerEntry(expense);
    }

    return expense;
  }

  async updateExpenseStatus(
    companyId: string,
    expenseId: string,
    status: ExpenseStatus,
  ) {
    this.tenant.setCompanyId(companyId);
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, companyId },
    });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    const updated = await this.prisma.expense.update({
      where: { id: expenseId },
      data: { status },
      include: { category: true },
    });

    if (status === 'PAID' && expense.status !== 'PAID') {
      const existing = await this.prisma.financialTransaction.findFirst({
        where: { expenseId },
      });
      if (!existing) {
        await this.createExpenseLedgerEntry(updated);
      }
    }

    return updated;
  }

  // --- Financial transactions ---

  listTransactions(
    companyId: string,
    opts?: { from?: string; to?: string; projectId?: string },
  ) {
    this.tenant.setCompanyId(companyId);
    const where: Prisma.FinancialTransactionWhereInput = {
      ...(opts?.projectId ? { connectedProjectId: opts.projectId } : {}),
      ...(opts?.from || opts?.to
        ? {
            occurredAt: {
              ...(opts.from ? { gte: new Date(opts.from) } : {}),
              ...(opts.to ? { lte: new Date(opts.to) } : {}),
            },
          }
        : {}),
    };

    return this.prisma.financialTransaction.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }

  async createTransaction(input: {
    companyId: string;
    transactionType: FinancialTransactionType;
    direction: FinancialDirection;
    amount: string | number;
    currency?: string;
    occurredAt?: string;
    connectedProjectId?: string;
    externalOrderId?: string;
    installmentTransactionId?: string;
    externalSettlementId?: string;
    expenseId?: string;
    description?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    assertSingleSource(input);
    const amount = String(input.amount);
    if (Number(amount) <= 0) {
      throw new BadRequestException('Transaction amount must be > 0');
    }

    if (input.connectedProjectId) {
      const project = await this.prisma.connectedProject.findFirst({
        where: { id: input.connectedProjectId, companyId: input.companyId },
      });
      if (!project) {
        throw new BadRequestException('Project does not belong to company');
      }
    }

    return this.prisma.financialTransaction.create({
      data: {
        companyId: input.companyId,
        connectedProjectId: input.connectedProjectId,
        transactionType: input.transactionType,
        direction: input.direction,
        amount,
        currency: input.currency ?? 'SAR',
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        externalOrderId: input.externalOrderId,
        installmentTransactionId: input.installmentTransactionId,
        externalSettlementId: input.externalSettlementId,
        expenseId: input.expenseId,
        description: input.description,
      },
    });
  }

  async postExternalOrder(companyId: string, externalOrderId: string) {
    this.tenant.setCompanyId(companyId);
    const order = await this.prisma.externalOrder.findFirst({
      where: { id: externalOrderId },
      include: { project: true },
    });
    if (!order || order.project.companyId !== companyId) {
      throw new NotFoundException('External order not found for company');
    }

    const existing = await this.prisma.financialTransaction.findFirst({
      where: { externalOrderId },
    });
    if (existing) {
      return existing;
    }

    const created = await this.prisma.financialTransaction.create({
      data: {
        companyId,
        connectedProjectId: order.connectedProjectId,
        transactionType: 'PLATFORM_SALE',
        direction: 'INFLOW',
        amount: order.totalAmount,
        currency: order.currency,
        occurredAt: order.placedAt,
        externalOrderId: order.id,
        description: `Platform sale ${order.externalNumber ?? order.externalId}`,
      },
    });

    if (Number(order.providerFee) > 0) {
      await this.prisma.financialTransaction.create({
        data: {
          companyId,
          connectedProjectId: order.connectedProjectId,
          transactionType: 'PROVIDER_FEE',
          direction: 'OUTFLOW',
          amount: order.providerFee,
          currency: order.currency,
          occurredAt: order.placedAt,
          description: `Provider fee for order ${order.externalId}`,
        },
      });
    }

    return created;
  }

  async dashboard(companyId: string, opts?: { from?: string; to?: string }) {
    this.tenant.setCompanyId(companyId);
    const from = opts?.from ? new Date(opts.from) : undefined;
    const to = opts?.to ? new Date(opts.to) : undefined;
    const where: Prisma.FinancialTransactionWhereInput = {
      ...(from || to
        ? {
            occurredAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const rows = await this.prisma.financialTransaction.findMany({
      where,
      select: {
        transactionType: true,
        direction: true,
        amount: true,
        currency: true,
      },
    });

    let inflow = 0;
    let outflow = 0;
    const byType: Record<string, { inflow: number; outflow: number }> = {};

    for (const row of rows) {
      const amount = Number(row.amount);
      const bucket = byType[row.transactionType] ?? { inflow: 0, outflow: 0 };
      if (row.direction === 'INFLOW') {
        inflow += amount;
        bucket.inflow += amount;
      } else {
        outflow += amount;
        bucket.outflow += amount;
      }
      byType[row.transactionType] = bucket;
    }

    const expenseAgg = await this.prisma.expense.aggregate({
      where: {
        status: { in: ['APPROVED', 'PAID'] },
        ...(from || to
          ? {
              expenseDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      _sum: { amount: true },
      _count: true,
    });

    return {
      currency: 'SAR',
      inflow: inflow.toFixed(2),
      outflow: outflow.toFixed(2),
      net: (inflow - outflow).toFixed(2),
      byType,
      expenses: {
        count: expenseAgg._count,
        total: expenseAgg._sum.amount?.toString() ?? '0.00',
      },
      transactionCount: rows.length,
    };
  }

  private encryptIban(iban?: string) {
    if (!iban) {
      return {
        ibanCiphertext: null,
        ibanKeyVersion: null,
        ibanLast4: null,
        ibanFingerprint: null,
      };
    }
    let valid: string;
    try {
      valid = assertValidSaudiIban(iban);
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Invalid IBAN',
      );
    }
    const encrypted = this.encryption.encrypt(valid);
    return {
      ibanCiphertext: Uint8Array.from(encrypted.ciphertext),
      ibanKeyVersion: encrypted.keyVersion,
      ibanLast4: valid.slice(-4),
      ibanFingerprint: fingerprintIban(valid),
    };
  }

  private createExpenseLedgerEntry(expense: {
    id: string;
    companyId: string;
    connectedProjectId: string | null;
    amount: Prisma.Decimal | string;
    currency: string;
    expenseDate: Date;
    description: string;
  }) {
    return this.prisma.financialTransaction.create({
      data: {
        companyId: expense.companyId,
        connectedProjectId: expense.connectedProjectId,
        transactionType: 'EXPENSE',
        direction: 'OUTFLOW',
        amount: expense.amount,
        currency: expense.currency,
        occurredAt: expense.expenseDate,
        expenseId: expense.id,
        description: expense.description,
      },
    });
  }

  // --- Payment gateways (Stripe / PayPal catalog) ---

  async listPaymentGateways(country?: string) {
    const gateways = await this.prisma.paymentGateway.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    if (!country) {
      return gateways;
    }
    const code = country.trim().toUpperCase();
    return gateways.filter((gateway) => {
      const countries = this.asStringArray(gateway.countryCodes);
      return countries.includes('*') || countries.includes(code);
    });
  }

  listCompanyPaymentMethods(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.companyPaymentMethod
      .findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          paymentGateway: {
            select: {
              id: true,
              code: true,
              name: true,
              providerType: true,
              countryCodes: true,
              supportsCurrencies: true,
              docsUrl: true,
            },
          },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          companyId: row.companyId,
          name: row.name,
          status: row.status,
          config: row.config,
          hasCredentials: row.credentialsCiphertext != null,
          keyVersion: row.keyVersion,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          paymentGateway: row.paymentGateway,
        })),
      );
  }

  async enableCompanyPaymentMethod(input: {
    companyId: string;
    createdById: string;
    paymentGatewayId?: string;
    code?: string;
    name?: string;
    config?: Record<string, unknown>;
    credentials?: Record<string, unknown>;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const company = await this.prisma.company.findFirst({
      where: { id: input.companyId, deletedAt: null },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const gateway = await this.resolveGateway(
      input.paymentGatewayId,
      input.code,
    );
    this.assertGatewayAvailableForCountry(
      gateway.countryCodes,
      company.countryCode,
    );

    const name = input.name?.trim() || gateway.name;
    const existing = await this.prisma.companyPaymentMethod.findFirst({
      where: {
        companyId: input.companyId,
        paymentGatewayId: gateway.id,
        name,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'This payment method is already enabled for the company',
      );
    }

    const creds = input.credentials
      ? this.encryption.encrypt(JSON.stringify(input.credentials))
      : null;

    const created = await this.prisma.companyPaymentMethod.create({
      data: {
        companyId: input.companyId,
        paymentGatewayId: gateway.id,
        name,
        status: 'ACTIVE',
        config: (input.config ?? { mode: 'sandbox' }) as Prisma.InputJsonValue,
        credentialsCiphertext: creds ? Uint8Array.from(creds.ciphertext) : null,
        keyVersion: creds?.keyVersion,
        createdById: input.createdById,
      },
      include: {
        paymentGateway: {
          select: { id: true, code: true, name: true, providerType: true },
        },
      },
    });

    return {
      id: created.id,
      companyId: created.companyId,
      name: created.name,
      status: created.status,
      config: created.config,
      hasCredentials: created.credentialsCiphertext != null,
      keyVersion: created.keyVersion,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      paymentGateway: created.paymentGateway,
    };
  }

  async updateCompanyPaymentMethod(input: {
    companyId: string;
    paymentMethodId: string;
    name?: string;
    status?: 'ACTIVE' | 'DISABLED';
    config?: Record<string, unknown>;
    credentials?: Record<string, unknown>;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const existing = await this.prisma.companyPaymentMethod.findFirst({
      where: { id: input.paymentMethodId, companyId: input.companyId },
    });
    if (!existing) {
      throw new NotFoundException('Company payment method not found');
    }

    const creds = input.credentials
      ? this.encryption.encrypt(JSON.stringify(input.credentials))
      : null;

    const updated = await this.prisma.companyPaymentMethod.update({
      where: { id: existing.id },
      data: {
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.status != null ? { status: input.status } : {}),
        ...(input.config != null
          ? { config: input.config as Prisma.InputJsonValue }
          : {}),
        ...(creds
          ? {
              credentialsCiphertext: Uint8Array.from(creds.ciphertext),
              keyVersion: creds.keyVersion,
            }
          : {}),
      },
      include: {
        paymentGateway: {
          select: { id: true, code: true, name: true, providerType: true },
        },
      },
    });

    return {
      id: updated.id,
      companyId: updated.companyId,
      name: updated.name,
      status: updated.status,
      config: updated.config,
      hasCredentials: updated.credentialsCiphertext != null,
      keyVersion: updated.keyVersion,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      paymentGateway: updated.paymentGateway,
    };
  }

  async chargeCompanyPaymentMethod(input: {
    companyId: string;
    paymentMethodId: string;
    amount: string | number;
    currency?: string;
    description?: string;
    salesInvoiceId?: string;
    returnUrl?: string;
    paymentMethodToken?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const amount = Number(input.amount);
    if (!(amount > 0)) {
      throw new BadRequestException('amount must be > 0');
    }

    const method = await this.prisma.companyPaymentMethod.findFirst({
      where: { id: input.paymentMethodId, companyId: input.companyId },
      include: {
        paymentGateway: {
          select: { id: true, code: true, name: true },
        },
      },
    });
    if (!method) {
      throw new NotFoundException('Company payment method not found');
    }
    if (method.status !== 'ACTIVE') {
      throw new BadRequestException('Payment method is disabled');
    }

    const currency = (input.currency ?? 'SAR').toUpperCase();
    const code = method.paymentGateway.code.toUpperCase();
    const creds = this.decryptMethodCredentials(method);
    const description =
      input.description ??
      (input.salesInvoiceId
        ? `Invoice ${input.salesInvoiceId}`
        : `Charge via ${code}`);

    let providerResult: {
      mode: 'LIVE' | 'LOCAL_STUB';
      providerChargeId: string;
      status: 'SUCCEEDED' | 'PENDING' | 'FAILED';
      raw?: Record<string, unknown>;
      errorMessage?: string;
    };

    if (code === 'STRIPE') {
      providerResult = await this.chargeStripe({
        amount,
        currency,
        description,
        creds,
        paymentMethodToken: input.paymentMethodToken,
      });
    } else if (code === 'PAYPAL') {
      providerResult = await this.chargePayPal({
        amount,
        currency,
        description,
        creds,
        returnUrl: input.returnUrl,
      });
    } else {
      throw new BadRequestException(`Unsupported gateway ${code}`);
    }

    let salesPayment: unknown = null;
    if (input.salesInvoiceId && providerResult.status === 'SUCCEEDED') {
      salesPayment = await this.recordGatewaySalesPayment({
        companyId: input.companyId,
        salesInvoiceId: input.salesInvoiceId,
        companyPaymentMethodId: method.id,
        amount,
        currency,
        externalReference: providerResult.providerChargeId,
      });
    }

    return {
      paymentMethodId: method.id,
      gateway: method.paymentGateway,
      amount: amount.toFixed(2),
      currency,
      mode: providerResult.mode,
      status: providerResult.status,
      providerChargeId: providerResult.providerChargeId,
      errorMessage: providerResult.errorMessage,
      salesPayment,
      provider: providerResult.raw ?? null,
    };
  }

  private decryptMethodCredentials(method: {
    credentialsCiphertext: Uint8Array | Buffer | null;
  }): Record<string, unknown> {
    if (!method.credentialsCiphertext) {
      return {};
    }
    try {
      const plain = this.encryption.decrypt(
        Buffer.from(method.credentialsCiphertext),
      );
      return JSON.parse(plain) as Record<string, unknown>;
    } catch (error) {
      this.logger.warn(
        `Failed to decrypt payment credentials: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return {};
    }
  }

  private isDemoSecret(value: string | undefined): boolean {
    if (!value) return true;
    const v = value.toLowerCase();
    return (
      v.includes('demo') ||
      v.includes('placeholder') ||
      v === 'sk_test_demo_seed' ||
      v.startsWith('sk_test_demo')
    );
  }

  private async chargeStripe(input: {
    amount: number;
    currency: string;
    description: string;
    creds: Record<string, unknown>;
    paymentMethodToken?: string;
  }) {
    const secret =
      String(input.creds.secretKey ?? input.creds.secret_key ?? '').trim() ||
      this.config.get<string>('STRIPE_SECRET_KEY')?.trim() ||
      '';
    const base = (
      this.config.get<string>('STRIPE_API_BASE_URL') ?? 'https://api.stripe.com'
    ).replace(/\/$/, '');

    if (this.isDemoSecret(secret)) {
      return {
        mode: 'LOCAL_STUB' as const,
        providerChargeId: `pi_stub_${Date.now()}`,
        status: 'SUCCEEDED' as const,
        raw: { stub: true, reason: 'STRIPE_SECRET_KEY not configured' },
      };
    }

    const params = new URLSearchParams();
    params.set('amount', String(Math.round(input.amount * 100)));
    params.set('currency', input.currency.toLowerCase());
    params.set('description', input.description);
    params.set('confirm', 'true');
    if (input.paymentMethodToken) {
      params.set('payment_method', input.paymentMethodToken);
    } else {
      params.set('payment_method_data[type]', 'card');
      // Without a real card token Stripe will reject — callers should pass token.
    }

    const res = await fetch(`${base}/v1/payment_intents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const raw = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return {
        mode: 'LIVE' as const,
        providerChargeId: String(raw.id ?? `stripe_err_${Date.now()}`),
        status: 'FAILED' as const,
        errorMessage: String(
          (raw.error as { message?: string } | undefined)?.message ??
            raw.message ??
            'Stripe charge failed',
        ),
        raw,
      };
    }
    const statusRaw = String(raw.status ?? '');
    return {
      mode: 'LIVE' as const,
      providerChargeId: String(raw.id),
      status:
        statusRaw === 'succeeded'
          ? ('SUCCEEDED' as const)
          : statusRaw === 'requires_action' || statusRaw === 'processing'
            ? ('PENDING' as const)
            : ('FAILED' as const),
      raw,
    };
  }

  private async chargePayPal(input: {
    amount: number;
    currency: string;
    description: string;
    creds: Record<string, unknown>;
    returnUrl?: string;
  }) {
    const clientId =
      String(input.creds.clientId ?? input.creds.client_id ?? '').trim() ||
      this.config.get<string>('PAYPAL_CLIENT_ID')?.trim() ||
      '';
    const clientSecret =
      String(
        input.creds.clientSecret ?? input.creds.client_secret ?? '',
      ).trim() ||
      this.config.get<string>('PAYPAL_CLIENT_SECRET')?.trim() ||
      '';
    const base = (
      this.config.get<string>('PAYPAL_API_BASE_URL') ??
      'https://api-m.sandbox.paypal.com'
    ).replace(/\/$/, '');

    if (this.isDemoSecret(clientId) || this.isDemoSecret(clientSecret)) {
      return {
        mode: 'LOCAL_STUB' as const,
        providerChargeId: `PAYID-STUB-${Date.now()}`,
        status: 'SUCCEEDED' as const,
        raw: { stub: true, reason: 'PAYPAL credentials not configured' },
      };
    }

    const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      error_description?: string;
    };
    if (!tokenRes.ok || !tokenJson.access_token) {
      return {
        mode: 'LIVE' as const,
        providerChargeId: `paypal_auth_err_${Date.now()}`,
        status: 'FAILED' as const,
        errorMessage: tokenJson.error_description ?? 'PayPal auth failed',
        raw: tokenJson as unknown as Record<string, unknown>,
      };
    }

    const returnUrl =
      input.returnUrl ??
      this.config.get<string>('APP_URL') ??
      'http://127.0.0.1:3000';
    const orderBody = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: input.currency,
            value: input.amount.toFixed(2),
          },
          description: input.description.slice(0, 120),
        },
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: returnUrl,
      },
    };

    const orderRes = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderBody),
    });
    const orderJson = (await orderRes.json()) as Record<string, unknown>;
    if (!orderRes.ok) {
      return {
        mode: 'LIVE' as const,
        providerChargeId: String(orderJson.id ?? `paypal_err_${Date.now()}`),
        status: 'FAILED' as const,
        errorMessage: 'PayPal order create failed',
        raw: orderJson,
      };
    }
    return {
      mode: 'LIVE' as const,
      providerChargeId: String(orderJson.id),
      status: 'PENDING' as const,
      raw: orderJson,
    };
  }

  private async recordGatewaySalesPayment(input: {
    companyId: string;
    salesInvoiceId: string;
    companyPaymentMethodId: string;
    amount: number;
    currency: string;
    externalReference: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.findFirst({
        where: { id: input.salesInvoiceId, companyId: input.companyId },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }
      const balance = Number(invoice.balanceDue);
      if (input.amount > balance + 0.001) {
        throw new BadRequestException('Payment exceeds balance due');
      }

      const receiptNumber = await this.docNumbers.nextSequence(
        tx,
        input.companyId,
        'receipt',
      );
      const payment = await tx.salesPayment.create({
        data: {
          companyId: input.companyId,
          salesInvoiceId: invoice.id,
          companyPaymentMethodId: input.companyPaymentMethodId,
          receiptNumber,
          method: 'PAYMENT_GATEWAY',
          amount: input.amount.toFixed(2),
          currency: input.currency,
          paidAt: new Date(),
          externalReference: input.externalReference,
        },
      });

      const newBalance = Number((balance - input.amount).toFixed(2));
      await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: {
          balanceDue: newBalance.toFixed(2),
          status:
            newBalance <= 0
              ? 'PAID'
              : newBalance < Number(invoice.totalAmount)
                ? 'PARTIALLY_PAID'
                : invoice.status,
        },
      });

      await tx.financialTransaction.create({
        data: {
          companyId: input.companyId,
          transactionType: 'RECEIPT',
          direction: 'INFLOW',
          amount: input.amount.toFixed(2),
          currency: input.currency,
          occurredAt: payment.paidAt,
          salesInvoiceId: invoice.id,
          description: `Gateway receipt ${receiptNumber}`,
        },
      });

      return payment;
    });
  }

  private async resolveGateway(id?: string, code?: string) {
    if (id) {
      const byId = await this.prisma.paymentGateway.findFirst({
        where: { id, isActive: true },
      });
      if (!byId) {
        throw new NotFoundException('Payment gateway not found');
      }
      return byId;
    }
    if (code) {
      const byCode = await this.prisma.paymentGateway.findFirst({
        where: { code: code.trim().toUpperCase(), isActive: true },
      });
      if (!byCode) {
        throw new NotFoundException('Payment gateway not found');
      }
      return byCode;
    }
    throw new BadRequestException('paymentGatewayId or code is required');
  }

  private assertGatewayAvailableForCountry(
    countryCodes: Prisma.JsonValue,
    companyCountry: string | null | undefined,
  ) {
    const countries = this.asStringArray(countryCodes);
    if (countries.includes('*')) {
      return;
    }
    const cc = companyCountry?.trim().toUpperCase();
    if (!cc || !countries.includes(cc)) {
      throw new BadRequestException(
        `Payment gateway is not available for country ${cc ?? 'unknown'}`,
      );
    }
  }

  private asStringArray(value: Prisma.JsonValue): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((item) => String(item).toUpperCase());
  }

  listDailyClosings(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.dailyCashClosing.findMany({
      orderBy: { closingDate: 'desc' },
      take: 60,
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async openDailyClosing(input: {
    companyId: string;
    createdById: string;
    closingDate: string;
    openingCash?: string | number;
    companyBranchId?: string;
    currency?: string;
    notes?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const closingDate = new Date(input.closingDate);
    const branchKey = input.companyBranchId ?? '';
    const dayStart = new Date(closingDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(closingDate);
    dayEnd.setHours(23, 59, 59, 999);

    const opening = Number(input.openingCash ?? 0);
    const { cashSales, cashExpenses } = await this.computeDailyCashTotals(
      dayStart,
      dayEnd,
    );
    const expected = opening + cashSales - cashExpenses;

    return this.prisma.dailyCashClosing.upsert({
      where: {
        companyId_closingDate_branchKey: {
          companyId: input.companyId,
          closingDate,
          branchKey,
        },
      },
      create: {
        companyId: input.companyId,
        companyBranchId: input.companyBranchId,
        branchKey,
        closingDate,
        openingCash: opening.toFixed(2),
        cashSales: cashSales.toFixed(2),
        cashExpenses: cashExpenses.toFixed(2),
        expectedCash: expected.toFixed(2),
        currency: input.currency ?? 'SAR',
        notes: input.notes,
        createdById: input.createdById,
      },
      update: {
        openingCash: opening.toFixed(2),
        cashSales: cashSales.toFixed(2),
        cashExpenses: cashExpenses.toFixed(2),
        expectedCash: expected.toFixed(2),
        notes: input.notes,
      },
    });
  }

  async closeDailyClosing(input: {
    companyId: string;
    closingId: string;
    closedById: string;
    countedCash: string | number;
    notes?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const row = await this.prisma.dailyCashClosing.findFirst({
      where: { id: input.closingId, companyId: input.companyId },
    });
    if (!row) {
      throw new BadRequestException('Daily closing not found');
    }
    if (row.status === 'CLOSED') {
      throw new BadRequestException('Already closed');
    }

    // Refresh sales/expense totals from sales payments + finance before closing
    const dayStart = new Date(row.closingDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(row.closingDate);
    dayEnd.setHours(23, 59, 59, 999);
    const { cashSales, cashExpenses } = await this.computeDailyCashTotals(
      dayStart,
      dayEnd,
    );
    const opening = Number(row.openingCash);
    const expected = opening + cashSales - cashExpenses;
    const counted = Number(input.countedCash);

    return this.prisma.dailyCashClosing.update({
      where: { id: input.closingId },
      data: {
        status: 'CLOSED',
        cashSales: cashSales.toFixed(2),
        cashExpenses: cashExpenses.toFixed(2),
        expectedCash: expected.toFixed(2),
        countedCash: counted.toFixed(2),
        variance: (counted - expected).toFixed(2),
        notes: input.notes ?? row.notes,
        closedById: input.closedById,
        closedAt: new Date(),
      },
    });
  }

  /**
   * Daily income prefers sales payments (cash collected), plus other inflows
   * that are not already tied to a sales invoice (avoids double-counting).
   */
  private async computeDailyCashTotals(dayStart: Date, dayEnd: Date) {
    const [salesPayments, otherInflow, expensesOut] = await Promise.all([
      this.prisma.salesPayment.aggregate({
        where: {
          status: 'SUCCEEDED',
          paidAt: { gte: dayStart, lte: dayEnd },
        },
        _sum: { amount: true },
      }),
      this.prisma.financialTransaction.aggregate({
        where: {
          direction: 'INFLOW',
          salesInvoiceId: null,
          occurredAt: { gte: dayStart, lte: dayEnd },
        },
        _sum: { amount: true },
      }),
      this.prisma.financialTransaction.aggregate({
        where: {
          direction: 'OUTFLOW',
          occurredAt: { gte: dayStart, lte: dayEnd },
        },
        _sum: { amount: true },
      }),
    ]);

    const cashSales =
      Number(salesPayments._sum?.amount ?? 0) +
      Number(otherInflow._sum?.amount ?? 0);
    const cashExpenses = Number(expensesOut._sum?.amount ?? 0);
    return { cashSales, cashExpenses };
  }
}
