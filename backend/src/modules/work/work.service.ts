import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  TaskPriority,
  TaskStatus,
  WorkPhaseStatus,
  WorkProjectStatus,
} from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { AutomationEngine } from '../automation/automation.engine';

@Injectable()
export class WorkService {
  private readonly logger = new Logger(WorkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    @Inject(forwardRef(() => AutomationEngine))
    private readonly automation: AutomationEngine,
  ) {}

  private emit(
    companyId: string,
    event: string,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>,
  ) {
    void this.automation
      .dispatch({ companyId, event, entityType, entityId, payload })
      .catch((error) => {
        this.logger.warn(
          `automation ${event} failed: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      });
  }

  listProjects(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.workProject.findMany({
      include: {
        phases: { orderBy: { position: 'asc' } },
        members: true,
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createProject(input: {
    companyId: string;
    code: string;
    name: string;
    crmContactId?: string;
    ownerUserId?: string;
    startsOn?: string;
    endsOn?: string;
    budget?: string | number;
    currency?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    if (input.budget != null && Number(input.budget) < 0) {
      throw new BadRequestException('budget must be >= 0');
    }
    if (input.startsOn && input.endsOn) {
      if (new Date(input.endsOn) < new Date(input.startsOn)) {
        throw new BadRequestException('endsOn must be >= startsOn');
      }
    }
    return this.prisma.workProject.create({
      data: {
        companyId: input.companyId,
        code: input.code,
        name: input.name,
        crmContactId: input.crmContactId,
        ownerUserId: input.ownerUserId,
        startsOn: input.startsOn ? new Date(input.startsOn) : undefined,
        endsOn: input.endsOn ? new Date(input.endsOn) : undefined,
        budget: input.budget != null ? String(input.budget) : undefined,
        currency: input.currency ?? 'SAR',
        status: 'PLANNED',
      },
    });
  }

  async updateProjectStatus(
    companyId: string,
    projectId: string,
    status: WorkProjectStatus,
    progressPercent?: number,
  ) {
    this.tenant.setCompanyId(companyId);
    await this.requireProject(companyId, projectId);
    if (
      progressPercent != null &&
      (progressPercent < 0 || progressPercent > 100)
    ) {
      throw new BadRequestException('progressPercent must be 0..100');
    }
    return this.prisma.workProject.update({
      where: { id: projectId },
      data: {
        status,
        ...(progressPercent != null
          ? { progressPercent: progressPercent.toFixed(2) }
          : {}),
      },
    });
  }

  async addMember(
    companyId: string,
    projectId: string,
    companyUserId: string,
    projectRole?: string,
  ) {
    this.tenant.setCompanyId(companyId);
    await this.requireProject(companyId, projectId);
    const membership = await this.prisma.companyUser.findFirst({
      where: { id: companyUserId, companyId },
    });
    if (!membership) {
      throw new BadRequestException('Company user not found');
    }
    return this.prisma.workProjectMember.create({
      data: {
        workProjectId: projectId,
        companyUserId,
        projectRole,
      },
    });
  }

  async addPhase(
    companyId: string,
    projectId: string,
    name: string,
    position: number,
  ) {
    this.tenant.setCompanyId(companyId);
    await this.requireProject(companyId, projectId);
    return this.prisma.workProjectPhase.create({
      data: {
        workProjectId: projectId,
        name,
        position,
      },
    });
  }

  async updatePhaseStatus(
    companyId: string,
    phaseId: string,
    status: WorkPhaseStatus,
  ) {
    this.tenant.setCompanyId(companyId);
    const phase = await this.prisma.workProjectPhase.findFirst({
      where: { id: phaseId, workProject: { companyId } },
    });
    if (!phase) {
      throw new NotFoundException('Phase not found');
    }
    const previousStatus = phase.status;
    const updated = await this.prisma.workProjectPhase.update({
      where: { id: phaseId },
      data: { status },
      include: {
        workProject: {
          select: { id: true, name: true, ownerUserId: true, companyId: true },
        },
      },
    });

    if (status === 'COMPLETED' && previousStatus !== 'COMPLETED') {
      this.emit(companyId, 'work.phase.completed', 'work_phase', updated.id, {
        phaseId: updated.id,
        phaseName: updated.name,
        position: updated.position,
        workProjectId: updated.workProjectId,
        projectName: updated.workProject.name,
        ownerUserId: updated.workProject.ownerUserId,
      });
    }

    return updated;
  }

  listTasks(companyId: string, projectId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.workTask.findMany({
      where: { workProjectId: projectId, workProject: { companyId } },
      include: { comments: true, phase: true },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
      take: 200,
    });
  }

  async createTask(input: {
    companyId: string;
    workProjectId: string;
    title: string;
    description?: string;
    workProjectPhaseId?: string;
    assigneeCompanyUserId?: string;
    parentTaskId?: string;
    priority?: TaskPriority;
    dueAt?: string;
    estimatedHours?: string | number;
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.requireProject(input.companyId, input.workProjectId);
    if (input.parentTaskId && input.parentTaskId === input.workProjectId) {
      throw new BadRequestException('Invalid parent task');
    }
    if (input.parentTaskId) {
      const parent = await this.prisma.workTask.findFirst({
        where: {
          id: input.parentTaskId,
          workProjectId: input.workProjectId,
        },
      });
      if (!parent) {
        throw new BadRequestException('Parent task not found on project');
      }
    }
    return this.prisma.workTask.create({
      data: {
        workProjectId: input.workProjectId,
        title: input.title,
        description: input.description,
        workProjectPhaseId: input.workProjectPhaseId,
        assigneeCompanyUserId: input.assigneeCompanyUserId,
        parentTaskId: input.parentTaskId,
        priority: input.priority ?? 'MEDIUM',
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        estimatedHours:
          input.estimatedHours != null
            ? String(input.estimatedHours)
            : undefined,
      },
    });
  }

  async updateTaskStatus(
    companyId: string,
    taskId: string,
    status: TaskStatus,
    progressPercent?: number,
  ) {
    this.tenant.setCompanyId(companyId);
    const task = await this.prisma.workTask.findFirst({
      where: { id: taskId, workProject: { companyId } },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (
      progressPercent != null &&
      (progressPercent < 0 || progressPercent > 100)
    ) {
      throw new BadRequestException('progressPercent must be 0..100');
    }
    return this.prisma.workTask.update({
      where: { id: taskId },
      data: {
        status,
        ...(progressPercent != null
          ? { progressPercent: progressPercent.toFixed(2) }
          : {}),
        ...(status === 'DONE' ? { progressPercent: '100.00' } : {}),
      },
    });
  }

  async addComment(
    companyId: string,
    taskId: string,
    authorUserId: string,
    body: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const task = await this.prisma.workTask.findFirst({
      where: { id: taskId, workProject: { companyId } },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return this.prisma.workTaskComment.create({
      data: {
        workTaskId: taskId,
        authorUserId,
        body,
      },
    });
  }

  private async requireProject(companyId: string, projectId: string) {
    const project = await this.prisma.workProject.findFirst({
      where: { id: projectId, companyId },
    });
    if (!project) {
      throw new NotFoundException('Work project not found');
    }
    return project;
  }
}
