import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotebookNoteStatus,
  TaskPriority,
} from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NotebookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  listCategories(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.notebookCategory.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(input: {
    companyId: string;
    name: string;
    code?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const code = input.code?.trim() || null;
    return this.prisma.notebookCategory.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        code,
        codeKey: code ?? '',
      },
    });
  }

  listNotes(companyId: string, search?: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.businessNote.findMany({
      where: search
        ? {
            OR: [
              { title: { contains: search } },
              { body: { contains: search } },
            ],
          }
        : undefined,
      include: {
        category: true,
        contact: { select: { id: true, name: true } },
        employee: { select: { id: true, fullName: true } },
        workProject: { select: { id: true, code: true, name: true } },
        _count: { select: { comments: true, revisions: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async createNote(input: {
    companyId: string;
    createdById: string;
    title: string;
    body: string;
    categoryId?: string;
    priority?: TaskPriority;
    status?: NotebookNoteStatus;
    workProjectId?: string;
    crmContactId?: string;
    employeeId?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.validateLinks(input);
    return this.prisma.businessNote.create({
      data: {
        companyId: input.companyId,
        createdById: input.createdById,
        title: input.title,
        body: input.body,
        categoryId: input.categoryId,
        priority: input.priority ?? 'MEDIUM',
        status: input.status ?? 'OPEN',
        workProjectId: input.workProjectId,
        crmContactId: input.crmContactId,
        employeeId: input.employeeId,
      },
      include: { category: true },
    });
  }

  async updateNote(
    companyId: string,
    noteId: string,
    editedById: string,
    data: {
      title?: string;
      body?: string;
      status?: NotebookNoteStatus;
      priority?: TaskPriority;
      categoryId?: string | null;
      workProjectId?: string | null;
      crmContactId?: string | null;
      employeeId?: string | null;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    const note = await this.prisma.businessNote.findFirst({
      where: { id: noteId, companyId },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }

    await this.prisma.businessNoteRevision.create({
      data: {
        noteId: note.id,
        editedById,
        title: note.title,
        body: note.body,
        status: note.status,
      },
    });

    return this.prisma.businessNote.update({
      where: { id: noteId },
      data: {
        title: data.title,
        body: data.body,
        status: data.status,
        priority: data.priority,
        categoryId: data.categoryId === undefined ? undefined : data.categoryId,
        workProjectId:
          data.workProjectId === undefined ? undefined : data.workProjectId,
        crmContactId:
          data.crmContactId === undefined ? undefined : data.crmContactId,
        employeeId: data.employeeId === undefined ? undefined : data.employeeId,
      },
      include: { revisions: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
  }

  async addComment(
    companyId: string,
    noteId: string,
    authorUserId: string,
    body: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const note = await this.prisma.businessNote.findFirst({
      where: { id: noteId, companyId },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    return this.prisma.businessNoteComment.create({
      data: { noteId, authorUserId, body },
    });
  }

  listRevisions(companyId: string, noteId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.businessNoteRevision.findMany({
      where: { noteId, note: { companyId } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  private async validateLinks(input: {
    companyId: string;
    categoryId?: string;
    workProjectId?: string;
    crmContactId?: string;
    employeeId?: string;
  }) {
    if (input.categoryId) {
      const category = await this.prisma.notebookCategory.findFirst({
        where: { id: input.categoryId, companyId: input.companyId },
      });
      if (!category) {
        throw new BadRequestException('Category not found');
      }
    }
    if (input.workProjectId) {
      const project = await this.prisma.workProject.findFirst({
        where: { id: input.workProjectId, companyId: input.companyId },
      });
      if (!project) {
        throw new BadRequestException('Work project not found');
      }
    }
    if (input.crmContactId) {
      const contact = await this.prisma.crmContact.findFirst({
        where: { id: input.crmContactId, companyId: input.companyId },
      });
      if (!contact) {
        throw new BadRequestException('Contact not found');
      }
    }
    if (input.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: input.employeeId, companyId: input.companyId },
      });
      if (!employee) {
        throw new BadRequestException('Employee not found');
      }
    }
  }
}
