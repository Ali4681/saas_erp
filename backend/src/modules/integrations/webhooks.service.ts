import { createHash } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { AdapterRegistry } from './sync/adapters/adapter.registry';
import { JobDispatcherService } from './sync/job-dispatcher.service';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly encryption: EncryptionService,
    private readonly adapters: AdapterRegistry,
    private readonly dispatcher: JobDispatcherService,
  ) {}

  async ingest(input: {
    projectId: string;
    eventType: string;
    payload: unknown;
    providerEventId?: string;
    signatureHeader?: string;
    rawBody?: string;
    signatureValid?: boolean;
  }) {
    this.tenant.setBypass(true);
    try {
      const project = await this.prisma.connectedProject.findUnique({
        where: { id: input.projectId },
        include: {
          provider: true,
          credentials: true,
        },
      });
      if (!project) {
        throw new NotFoundException('Connected project not found');
      }

      const payloadJson = JSON.stringify(input.payload ?? {});
      const payloadHash = createHash('sha256')
        .update(payloadJson)
        .digest('hex');

      let signatureValid = input.signatureValid ?? null;
      if (
        signatureValid == null &&
        project.credentials &&
        input.signatureHeader
      ) {
        try {
          const credentials = JSON.parse(
            this.encryption.decrypt(
              Buffer.from(project.credentials.credentialsCiphertext),
            ),
          ) as Record<string, unknown>;
          const adapter = this.adapters.get(project.provider.code);
          if (adapter.verifyWebhookSignature) {
            signatureValid = adapter.verifyWebhookSignature({
              rawBody: input.rawBody ?? payloadJson,
              signatureHeader: input.signatureHeader,
              credentials,
            });
          }
        } catch {
          signatureValid = false;
        }
      }

      try {
        const event = await this.prisma.webhookEvent.create({
          data: {
            connectedProjectId: input.projectId,
            providerEventId: input.providerEventId ?? null,
            eventType: input.eventType,
            payload: input.payload as Prisma.InputJsonValue,
            signatureValid,
            status: 'RECEIVED',
            payloadHash,
          },
        });

        if (signatureValid !== false) {
          await this.dispatcher.enqueueWebhook({
            webhookEventId: event.id,
            connectedProjectId: input.projectId,
          });
        } else {
          await this.prisma.webhookEvent.update({
            where: { id: event.id },
            data: {
              status: 'FAILED',
              errorMessage: 'Invalid webhook signature',
              processedAt: new Date(),
            },
          });
        }

        return { created: true, event };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const existing = await this.prisma.webhookEvent.findFirst({
            where: {
              connectedProjectId: input.projectId,
              OR: [
                ...(input.providerEventId
                  ? [{ providerEventId: input.providerEventId }]
                  : []),
                { payloadHash },
              ],
            },
          });
          if (existing) {
            return { created: false, event: existing };
          }
          throw new ConflictException('Duplicate webhook event');
        }
        throw error;
      }
    } finally {
      this.tenant.setBypass(false);
    }
  }
}
