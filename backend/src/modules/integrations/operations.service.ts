import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { EffectiveCapabilityService } from './effective-capability.service';
import { JobDispatcherService } from './sync/job-dispatcher.service';
import { SyncRunnerService } from './sync/sync-runner.service';

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly effectiveCapabilities: EffectiveCapabilityService,
    private readonly dispatcher: JobDispatcherService,
    private readonly runner: SyncRunnerService,
  ) {}

  list(companyId: string, projectId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.connectedProject
      .findFirst({ where: { id: projectId, companyId } })
      .then(async (project) => {
        if (!project) {
          throw new NotFoundException('Connected project not found');
        }
        return this.prisma.providerOperationRequest.findMany({
          where: { connectedProjectId: projectId },
          include: { capability: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
      });
  }

  private async resolveCapability(projectId: string, capabilityCode: string) {
    const list = await this.effectiveCapabilities.listForProject(projectId);
    const match = list.find((item) => item.code === capabilityCode);
    if (!match) {
      throw new NotFoundException(
        `Capability ${capabilityCode} not mapped for provider`,
      );
    }
    if (!match.effective) {
      throw new ForbiddenException(
        `Capability ${capabilityCode} is not effective (${match.reason})`,
      );
    }
    return match;
  }

  async create(input: {
    companyId: string;
    projectId: string;
    capabilityCode: string;
    operationType: string;
    idempotencyKey: string;
    requestedById: string;
    externalTargetId?: string;
    payload?: Record<string, unknown>;
  }) {
    this.tenant.setCompanyId(input.companyId);

    const project = await this.prisma.connectedProject.findFirst({
      where: { id: input.projectId, companyId: input.companyId },
    });
    if (!project) {
      throw new NotFoundException('Connected project not found');
    }

    const match = await this.resolveCapability(
      input.projectId,
      input.capabilityCode,
    );

    try {
      const created = await this.prisma.providerOperationRequest.create({
        data: {
          connectedProjectId: input.projectId,
          capabilityId: match.capabilityId,
          requestedById: input.requestedById,
          operationType: input.operationType,
          idempotencyKey: input.idempotencyKey,
          externalTargetId: input.externalTargetId,
          payload: (input.payload ?? {}) as Prisma.InputJsonValue,
          status: 'PENDING',
        },
        include: { capability: true },
      });

      await this.dispatcher.enqueueOperation({
        operationRequestId: created.id,
        connectedProjectId: input.projectId,
        companyId: input.companyId,
      });

      const fresh = await this.prisma.providerOperationRequest.findUnique({
        where: { id: created.id },
        include: { capability: true },
      });
      return fresh ?? created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing =
          await this.prisma.providerOperationRequest.findUnique({
            where: {
              connectedProjectId_idempotencyKey: {
                connectedProjectId: input.projectId,
                idempotencyKey: input.idempotencyKey,
              },
            },
            include: { capability: true },
          });
        if (existing) {
          return existing;
        }
        throw new ConflictException('Duplicate idempotency key');
      }
      throw error;
    }
  }

  /**
   * Run operation inline and return adapter rawResponse (for hub reads/writes).
   */
  async invoke(input: {
    companyId: string;
    projectId: string;
    capabilityCode: string;
    operationType: string;
    idempotencyKey: string;
    requestedById: string;
    externalTargetId?: string;
    payload?: Record<string, unknown>;
  }) {
    this.tenant.setCompanyId(input.companyId);

    const project = await this.prisma.connectedProject.findFirst({
      where: { id: input.projectId, companyId: input.companyId },
    });
    if (!project) {
      throw new NotFoundException('Connected project not found');
    }

    const match = await this.resolveCapability(
      input.projectId,
      input.capabilityCode,
    );

    let created;
    try {
      created = await this.prisma.providerOperationRequest.create({
        data: {
          connectedProjectId: input.projectId,
          capabilityId: match.capabilityId,
          requestedById: input.requestedById,
          operationType: input.operationType,
          idempotencyKey: input.idempotencyKey,
          externalTargetId: input.externalTargetId,
          payload: (input.payload ?? {}) as Prisma.InputJsonValue,
          status: 'PENDING',
        },
        include: { capability: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Duplicate idempotency key');
      }
      throw error;
    }

    try {
      const result = await this.runner.executeOperation({
        operationRequestId: created.id,
        connectedProjectId: input.projectId,
        companyId: input.companyId,
      });

      const fresh = await this.prisma.providerOperationRequest.findUnique({
        where: { id: created.id },
        include: { capability: true },
      });

      return {
        id: created.id,
        status: fresh?.status ?? 'SUCCEEDED',
        responseExternalId: fresh?.responseExternalId ?? result?.responseExternalId ?? null,
        failureMessage: fresh?.failureMessage ?? null,
        rawResponse: result?.rawResponse ?? null,
      };
    } catch (error) {
      const fresh = await this.prisma.providerOperationRequest.findUnique({
        where: { id: created.id },
      });
      return {
        id: created.id,
        status: fresh?.status ?? 'FAILED',
        responseExternalId: null,
        failureMessage:
          fresh?.failureMessage ??
          (error instanceof Error ? error.message : String(error)),
        rawResponse: null,
      };
    }
  }

  async getOne(companyId: string, projectId: string, operationId: string) {
    this.tenant.setCompanyId(companyId);
    const project = await this.prisma.connectedProject.findFirst({
      where: { id: projectId, companyId },
    });
    if (!project) {
      throw new NotFoundException('Connected project not found');
    }
    const operation = await this.prisma.providerOperationRequest.findFirst({
      where: { id: operationId, connectedProjectId: projectId },
      include: { capability: true },
    });
    if (!operation) {
      throw new NotFoundException('Operation not found');
    }
    return operation;
  }
}
