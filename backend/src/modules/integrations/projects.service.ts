import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthType, ProjectEnvironment, ProjectStatus } from '../../generated/prisma/client';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { PlanLimitsService } from '../plans/plan-limits.service';
import {
  CredentialPayload,
  EffectiveCapabilityService,
} from './effective-capability.service';
import { ExtensionBridgeService } from './extension/extension-bridge.service';
import { AdapterRegistry } from './sync/adapters/adapter.registry';
import { JobsService } from './sync/jobs.service';
import {
  hasAnyAuthSecret,
  normalizeCredentialPayload,
} from './sync/adapters/credential-shapes';
import { asRecord } from './sync/adapters/credential-resolve';

const EXTENSION_CHANNELS: Record<string, string> = {
  HUNGERSTATION: 'hungerstation',
  NINJA: 'ninja',
  TOYOU: 'toyou',
  MRSOOL: 'mrsool',
};

const EXTENSION_SAVE_COMMAND: Record<string, string> = {
  hungerstation: 'save_session',
  ninja: 'save_ninja_session',
  toyou: 'save_toyou_session',
  mrsool: 'save_mrsool_session',
};

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly planLimits: PlanLimitsService,
    private readonly encryption: EncryptionService,
    private readonly effectiveCapabilities: EffectiveCapabilityService,
    private readonly adapters: AdapterRegistry,
    private readonly extensionBridge: ExtensionBridgeService,
    private readonly jobs: JobsService,
  ) {}

  list(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.connectedProject.findMany({
      include: {
        provider: { include: { category: true } },
        category: true,
        credentials: {
          select: {
            id: true,
            authType: true,
            status: true,
            expiresAt: true,
            keyVersion: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(companyId: string, projectId: string) {
    this.tenant.setCompanyId(companyId);
    const project = await this.prisma.connectedProject.findFirst({
      where: { id: projectId, companyId },
      include: {
        provider: { include: { category: true } },
        category: true,
        credentials: {
          select: {
            id: true,
            authType: true,
            status: true,
            expiresAt: true,
            keyVersion: true,
            updatedAt: true,
          },
        },
        locations: { take: 50, orderBy: { name: 'asc' } },
        syncStates: true,
      },
    });
    if (!project) {
      throw new NotFoundException('Connected project not found');
    }
    return project;
  }

  async create(input: {
    companyId: string;
    categoryCode: string;
    providerCode: string;
    name: string;
    createdById: string;
    environment?: ProjectEnvironment;
    externalAccountId?: string;
    defaultCurrency?: string;
    credentials?: {
      authType: AuthType;
      payload: CredentialPayload;
      expiresAt?: string;
    };
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.planLimits.assertCanAddProject(input.companyId);

    const category = await this.prisma.platformCategory.findUnique({
      where: { code: input.categoryCode },
    });
    if (!category || !category.isActive) {
      throw new BadRequestException('Company category is required');
    }

    const provider = await this.prisma.platformProvider.findUnique({
      where: { code: input.providerCode },
      include: { category: true },
    });
    if (!provider || !provider.isActive) {
      throw new NotFoundException('Provider not found');
    }

    if (provider.category.code !== category.code) {
      throw new BadRequestException(
        'Selected provider does not match the chosen company category',
      );
    }

    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('Project name is required');
    }

    const normalizedCreds = input.credentials
      ? {
          ...input.credentials,
          payload: normalizeCredentialPayload(
            input.credentials.payload as Record<string, unknown>,
          ),
        }
      : undefined;

    const encrypted = normalizedCreds
      ? this.encryption.encrypt(JSON.stringify(normalizedCreds.payload))
      : null;
    const ciphertext = encrypted
      ? Uint8Array.from(encrypted.ciphertext)
      : null;

    return this.prisma.connectedProject.create({
      data: {
        companyId: input.companyId,
        categoryId: provider.categoryId,
        providerId: provider.id,
        name,
        externalAccountId: input.externalAccountId,
        environment: input.environment ?? 'SANDBOX',
        status: ciphertext ? 'CONNECTING' : 'DRAFT',
        defaultCurrency: input.defaultCurrency,
        createdById: input.createdById,
        ...(ciphertext && encrypted && normalizedCreds
          ? {
              credentials: {
                create: {
                  authType: normalizedCreds.authType,
                  credentialsCiphertext: ciphertext,
                  keyVersion: encrypted.keyVersion,
                  expiresAt: normalizedCreds.expiresAt
                    ? new Date(normalizedCreds.expiresAt)
                    : null,
                  status: 'ACTIVE',
                },
              },
            }
          : {}),
      },
      include: {
        provider: true,
        category: true,
        credentials: {
          select: {
            id: true,
            authType: true,
            status: true,
            expiresAt: true,
            keyVersion: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async updateStatus(
    companyId: string,
    projectId: string,
    status: ProjectStatus,
  ) {
    this.tenant.setCompanyId(companyId);
    const project = await this.get(companyId, projectId);
    const providerCode = project.provider.code.toUpperCase();
    const extensionChannel = EXTENSION_CHANNELS[providerCode] ?? null;

    if (status === 'ACTIVE') {
      if (extensionChannel) {
        await this.captureExtensionSession(companyId, projectId, extensionChannel);
      } else {
        const creds = await this.prisma.projectCredential.findUnique({
          where: { connectedProjectId: projectId },
        });
        if (!creds || creds.status !== 'ACTIVE') {
          throw new BadRequestException(
            'Project needs active credentials before ACTIVE status',
          );
        }
      }
    }

    const updated = await this.prisma.connectedProject.update({
      where: { id: projectId },
      data: { status },
      include: { provider: true, category: true },
    });

    if (status === 'ACTIVE') {
      await this.enqueueAutoSync(companyId, projectId, project.category.code);
    }

    return updated;
  }

  /**
   * Pull live partner-portal cookies/tokens via the Chrome extension.
   * Fails if the extension is offline or the merchant is not logged in.
   */
  private async captureExtensionSession(
    companyId: string,
    projectId: string,
    channel: string,
  ) {
    if (!this.extensionBridge.isConnected(channel)) {
      throw new BadRequestException(
        'الإكستنشن غير متصل. ثبّته، شغّل الـ backend، وافتح تبويب بوابة الشريك.',
      );
    }

    const command = EXTENSION_SAVE_COMMAND[channel];
    if (!command) {
      throw new BadRequestException(`Unknown extension channel: ${channel}`);
    }

    let raw: unknown;
    try {
      raw = await this.extensionBridge.sendCommand(channel, command, {}, 20_000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/no_access_token|no_mrsool|unauthorized|not.?logged/i.test(msg)) {
        throw new BadRequestException(
          'لم يتم العثور على جلسة دخول في المتصفح. سجّل دخولك في بوابة الشريك ثم أعد المحاولة.',
        );
      }
      throw new BadRequestException(
        `تعذّر قراءة جلسة الإكستنشن: ${msg}`,
      );
    }

    const data = asRecord(raw);
    const cookieSource = asRecord(data.cookies ?? data);
    const cookies: Record<string, string> = {};
    for (const [key, value] of Object.entries(cookieSource)) {
      if (value != null && value !== '') cookies[key] = String(value);
    }
    const accessToken = String(
      cookies.accessToken ?? data.accessToken ?? data.token ?? '',
    ).trim();
    const hasCookieJar = Object.keys(cookies).length > 0;

    if (!accessToken && !hasCookieJar) {
      throw new BadRequestException(
        'لا توجد جلسة صالحة. سجّل دخولك في بوابة الشريك (HungerStation/Ninja/…) من نفس المتصفح.',
      );
    }

    // HungerStation specifically needs accessToken cookie from partner portal login
    if (channel === 'hungerstation' && !accessToken) {
      throw new BadRequestException(
        'سجّل دخولك في partner-app.hungerstation.com أولاً — لم يُعثر على accessToken.',
      );
    }

    await this.upsertCredentials(companyId, projectId, {
      authType: 'CUSTOM',
      payload: {
        ...(accessToken ? { accessToken } : {}),
        cookies,
        ...(data.vendorId ? { vendorId: String(data.vendorId) } : {}),
        ...(data.branchId ? { branchId: String(data.branchId) } : {}),
      },
    });
  }

  private async enqueueAutoSync(
    companyId: string,
    projectId: string,
    categoryCode: string,
  ) {
    const entities =
      categoryCode === 'INSTALLMENT'
        ? ['installment', 'order']
        : categoryCode === 'ECOMMERCE'
          ? ['order', 'product', 'category']
          : ['order', 'product', 'category', 'location'];

    for (const entityType of entities) {
      try {
        await this.jobs.enqueueSync({
          companyId,
          projectId,
          entityType,
          fullSync: true,
        });
      } catch (error) {
        this.logger.warn(
          `Auto-sync skipped for ${projectId}/${entityType}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }
  }

  async upsertCredentials(
    companyId: string,
    projectId: string,
    input: {
      authType: AuthType;
      payload: CredentialPayload | Record<string, unknown>;
      expiresAt?: string;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    await this.get(companyId, projectId);

    const incoming = normalizeCredentialPayload(
      input.payload as Record<string, unknown>,
    );

    const existing = await this.prisma.projectCredential.findUnique({
      where: { connectedProjectId: projectId },
    });

    let merged: CredentialPayload = { ...incoming };
    if (existing?.credentialsCiphertext) {
      try {
        const previous = this.effectiveCapabilities.decryptCredentials(
          Buffer.from(existing.credentialsCiphertext),
        );
        merged = {
          ...previous,
          ...incoming,
          cookies:
            (incoming.cookies as CredentialPayload['cookies']) ??
            previous.cookies,
          grantedScopes: incoming.grantedScopes?.length
            ? incoming.grantedScopes
            : previous.grantedScopes,
        };
      } catch {
        merged = { ...incoming };
      }
    }

    if (!hasAnyAuthSecret(merged)) {
      throw new BadRequestException(
        'Credential payload must include apiKey, accessToken, password, clientSecret, or cookies',
      );
    }

    const encrypted = this.encryption.encrypt(JSON.stringify(merged));
    const ciphertext = Uint8Array.from(encrypted.ciphertext);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

    await this.prisma.projectCredential.upsert({
      where: { connectedProjectId: projectId },
      create: {
        connectedProjectId: projectId,
        authType: input.authType,
        credentialsCiphertext: ciphertext,
        keyVersion: encrypted.keyVersion,
        expiresAt,
        status: 'ACTIVE',
      },
      update: {
        authType: input.authType,
        credentialsCiphertext: ciphertext,
        keyVersion: encrypted.keyVersion,
        expiresAt,
        status: 'ACTIVE',
        rotatedAt: new Date(),
      },
    });

    const project = await this.prisma.connectedProject.findUnique({
      where: { id: projectId },
      select: { status: true },
    });
    if (project && project.status !== 'ACTIVE') {
      await this.prisma.connectedProject.update({
        where: { id: projectId },
        data: { status: 'CONNECTING' },
      });
    }

    return this.get(companyId, projectId);
  }

  listEffectiveCapabilities(companyId: string, projectId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.connectedProject
      .findFirst({ where: { id: projectId, companyId } })
      .then(async (project) => {
        if (!project) {
          throw new NotFoundException('Connected project not found');
        }
        return this.effectiveCapabilities.listForProject(projectId);
      });
  }

  async adapterStatus(companyId: string, projectId: string) {
    const project = await this.get(companyId, projectId);
    const resolution = this.adapters.resolve(project.provider.code);
    const needsExtension = [
      'HUNGERSTATION',
      'NINJA',
      'TOYOU',
      'MRSOOL',
    ].includes(project.provider.code.toUpperCase());
    const extensionChannel = (() => {
      switch (project.provider.code.toUpperCase()) {
        case 'HUNGERSTATION':
          return 'hungerstation';
        case 'NINJA':
          return 'ninja';
        case 'TOYOU':
          return 'toyou';
        case 'MRSOOL':
          return 'mrsool';
        default:
          return null;
      }
    })();
    return {
      projectId: project.id,
      providerCode: project.provider.code,
      providerName: project.provider.name,
      categoryCode: project.category.code,
      adapterMode: resolution.mode,
      hasDedicatedAdapter: resolution.mode === 'real',
      registeredAdapters: resolution.registeredCodes,
      hasCredentials: Boolean(project.credentials),
      credentialsStatus: project.credentials?.status ?? null,
      credentialsAuthType: project.credentials?.authType ?? null,
      extensionBridge:
        needsExtension && extensionChannel
          ? this.extensionBridge.status(extensionChannel)
          : null,
    };
  }

  async testAuth(companyId: string, projectId: string) {
    this.tenant.setCompanyId(companyId);
    const project = await this.prisma.connectedProject.findFirst({
      where: { id: projectId, companyId },
      include: {
        provider: true,
        category: true,
        credentials: true,
      },
    });
    if (!project) {
      throw new NotFoundException('Connected project not found');
    }
    if (!project.credentials || project.credentials.status !== 'ACTIVE') {
      throw new BadRequestException('No active credentials stored for project');
    }

    let credentials: CredentialPayload;
    try {
      credentials = this.effectiveCapabilities.decryptCredentials(
        Buffer.from(project.credentials.credentialsCiphertext),
      );
    } catch {
      throw new BadRequestException('Failed to decrypt project credentials');
    }

    const resolution = this.adapters.resolve(project.provider.code);
    const adapter = this.adapters.get(project.provider.code);
    const ok = await adapter.testAuth({
      connectedProjectId: project.id,
      providerCode: project.provider.code,
      credentials,
      environment: project.environment,
    });

    if (ok && project.status === 'CONNECTING') {
      await this.prisma.connectedProject.update({
        where: { id: project.id },
        data: { status: 'ACTIVE' },
      });
    }

    return {
      ok,
      adapterMode: resolution.mode,
      hasDedicatedAdapter: resolution.mode === 'real',
      providerCode: project.provider.code,
      message: ok
        ? resolution.mode === 'real'
          ? 'Connection test succeeded'
          : 'Credentials present (stub adapter — real provider adapter not registered yet)'
        : 'Connection test failed',
    };
  }
}
