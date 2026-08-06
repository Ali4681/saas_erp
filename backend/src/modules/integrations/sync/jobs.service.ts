import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { EffectiveCapabilityService } from '../effective-capability.service';
import { JobDispatcherService } from './job-dispatcher.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly dispatcher: JobDispatcherService,
    private readonly effectiveCapabilities: EffectiveCapabilityService,
  ) {}

  list(companyId: string, projectId: string) {
    this.tenant.setCompanyId(companyId);
    return this.ensureProject(companyId, projectId).then(() =>
      this.prisma.integrationJob.findMany({
        where: { connectedProjectId: projectId },
        orderBy: { scheduledAt: 'desc' },
        take: 100,
      }),
    );
  }

  listSyncStates(companyId: string, projectId: string) {
    this.tenant.setCompanyId(companyId);
    return this.ensureProject(companyId, projectId).then(() =>
      this.prisma.projectSyncState.findMany({
        where: { connectedProjectId: projectId },
        orderBy: { entityType: 'asc' },
      }),
    );
  }

  listErrors(companyId: string, projectId: string) {
    this.tenant.setCompanyId(companyId);
    return this.ensureProject(companyId, projectId).then(() =>
      this.prisma.integrationError.findMany({
        where: { connectedProjectId: projectId },
        orderBy: { lastSeenAt: 'desc' },
        take: 100,
      }),
    );
  }

  async enqueueSync(input: {
    companyId: string;
    projectId: string;
    entityType: string;
    fullSync?: boolean;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const project = await this.ensureProject(input.companyId, input.projectId);

    if (project.status !== 'ACTIVE') {
      throw new BadRequestException('Project must be ACTIVE to sync');
    }

    const caps = await this.effectiveCapabilities.listForProject(input.projectId);
    const requiredByEntity: Record<string, string[]> = {
      location: ['LOCATION_READ', 'BULK_SYNC'],
      category: ['CATEGORY_READ', 'BULK_SYNC'],
      product: ['PRODUCT_READ', 'BULK_SYNC'],
      customer: ['CUSTOMER_READ', 'BULK_SYNC'],
      order: ['ORDER_READ', 'BULK_SYNC'],
      promotion: ['PROMOTION_READ', 'BULK_SYNC'],
      settlement: ['SETTLEMENT_READ', 'BULK_SYNC'],
      installment: ['PAYMENT_READ', 'BULK_SYNC'],
    };
    const required = requiredByEntity[input.entityType] ?? ['BULK_SYNC'];
    const allowed = required.some((code) =>
      caps.some((item) => item.code === code && item.effective),
    );
    if (!allowed) {
      throw new BadRequestException(
        `No effective capability for syncing ${input.entityType} (need one of ${required.join(', ')})`,
      );
    }

    const jobType = input.fullSync === false ? 'INCREMENTAL_SYNC' : 'FULL_SYNC';
    const activeSyncKey =
      jobType === 'FULL_SYNC'
        ? `${input.projectId}:${input.entityType}`
        : null;

    try {
      const job = await this.prisma.integrationJob.create({
        data: {
          connectedProjectId: input.projectId,
          jobType,
          entityType: input.entityType,
          status: 'QUEUED',
          scheduledAt: new Date(),
          activeSyncKey,
          metrics: {} as Prisma.InputJsonValue,
        },
      });

      await this.dispatcher.enqueueSync({
        integrationJobId: job.id,
        connectedProjectId: input.projectId,
        companyId: input.companyId,
        entityType: input.entityType,
        jobType,
      });

      return job;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        activeSyncKey
      ) {
        throw new ConflictException(
          `A full sync is already active for ${input.entityType}`,
        );
      }
      throw error;
    }
  }

  engineStatus() {
    return { driver: this.dispatcher.mode };
  }

  private async ensureProject(companyId: string, projectId: string) {
    const project = await this.prisma.connectedProject.findFirst({
      where: { id: projectId, companyId },
    });
    if (!project) {
      throw new NotFoundException('Connected project not found');
    }
    return project;
  }
}
