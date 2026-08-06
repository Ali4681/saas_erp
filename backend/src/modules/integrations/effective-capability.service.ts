import { Injectable, NotFoundException } from '@nestjs/common';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { PrismaService } from '../../database/prisma.service';

export type CredentialPayload = {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  grantedScopes?: string[];
  storeId?: string;
  vendorId?: string;
  merchantId?: string;
  cookies?: Record<string, string> | string;
  pxCookie?: string;
  webhookSecret?: string;
  baseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  deviceToken?: string;
  [key: string]: unknown;
};

export type EffectiveCapability = {
  capabilityId: string;
  code: string;
  name: string;
  entityType: string;
  direction: string;
  supportStatus: string;
  requiredScope: string | null;
  effective: boolean;
  reason?: string;
};

@Injectable()
export class EffectiveCapabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  decryptCredentials(ciphertext: Buffer): CredentialPayload {
    const raw = this.encryption.decrypt(ciphertext);
    return JSON.parse(raw) as CredentialPayload;
  }

  async listForProject(connectedProjectId: string): Promise<EffectiveCapability[]> {
    const project = await this.prisma.connectedProject.findUnique({
      where: { id: connectedProjectId },
      include: {
        credentials: true,
        provider: {
          include: {
            capabilities: { include: { capability: true } },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Connected project not found');
    }

    let grantedScopes: string[] = [];
    if (project.credentials?.status === 'ACTIVE') {
      try {
        const payload = this.decryptCredentials(
          Buffer.from(project.credentials.credentialsCiphertext),
        );
        grantedScopes = payload.grantedScopes ?? [];
      } catch {
        grantedScopes = [];
      }
    }

    return project.provider.capabilities.map((row) => {
      const executable =
        row.supportStatus === 'VERIFIED' ||
        row.supportStatus === 'PARTNER_ENABLED';

      if (!executable) {
        return {
          capabilityId: row.capabilityId,
          code: row.capability.code,
          name: row.capability.name,
          entityType: row.capability.entityType,
          direction: row.capability.direction,
          supportStatus: row.supportStatus,
          requiredScope: row.requiredScope,
          effective: false,
          reason: `support_status=${row.supportStatus}`,
        };
      }

      if (project.status !== 'ACTIVE') {
        return {
          capabilityId: row.capabilityId,
          code: row.capability.code,
          name: row.capability.name,
          entityType: row.capability.entityType,
          direction: row.capability.direction,
          supportStatus: row.supportStatus,
          requiredScope: row.requiredScope,
          effective: false,
          reason: `project_status=${project.status}`,
        };
      }

      if (
        row.requiredScope &&
        grantedScopes.length > 0 &&
        !grantedScopes.includes('*') &&
        !grantedScopes.includes(row.requiredScope)
      ) {
        return {
          capabilityId: row.capabilityId,
          code: row.capability.code,
          name: row.capability.name,
          entityType: row.capability.entityType,
          direction: row.capability.direction,
          supportStatus: row.supportStatus,
          requiredScope: row.requiredScope,
          effective: false,
          reason: `missing_scope=${row.requiredScope}`,
        };
      }

      return {
        capabilityId: row.capabilityId,
        code: row.capability.code,
        name: row.capability.name,
        entityType: row.capability.entityType,
        direction: row.capability.direction,
        supportStatus: row.supportStatus,
        requiredScope: row.requiredScope,
        effective: true,
      };
    });
  }

  async assertEffective(
    connectedProjectId: string,
    capabilityCode: string,
  ): Promise<{ capabilityId: string }> {
    const list = await this.listForProject(connectedProjectId);
    const match = list.find((item) => item.code === capabilityCode);
    if (!match) {
      throw new NotFoundException(`Capability ${capabilityCode} not mapped`);
    }
    if (!match.effective) {
      throw new NotFoundException(
        `Capability ${capabilityCode} is not effective (${match.reason})`,
      );
    }
    return { capabilityId: match.capabilityId };
  }
}
