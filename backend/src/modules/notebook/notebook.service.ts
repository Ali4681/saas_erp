import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotebookNoteStatus,
  TaskPriority,
} from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';

export const NOTEBOOK_BUCKETS = {
  PROBLEMS: { codeKey: 'PROBLEMS', name: 'Problems', nameAr: 'المشاكل' },
  DEV_IDEAS: {
    codeKey: 'DEV_IDEAS',
    name: 'Development ideas',
    nameAr: 'أفكار تطويرية',
  },
  WORK_NOTES: {
    codeKey: 'WORK_NOTES',
    name: 'Work notes',
    nameAr: 'ملاحظات أثناء العمل',
  },
} as const;

export type NotebookBucketCode = keyof typeof NOTEBOOK_BUCKETS;

const OPERATOR_ROLES = new Set([
  'OPERATIONS_MANAGER',
  'COMPANY_OWNER',
  'COMPANY_ADMIN',
  'PLATFORM_SUPER_ADMIN',
]);

@Injectable()
export class NotebookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  isOperator(roleCode?: string | null, isPlatformAdmin?: boolean) {
    if (isPlatformAdmin) return true;
    return roleCode ? OPERATOR_ROLES.has(roleCode) : false;
  }

  async ensureDefaultCategories(companyId: string) {
    this.tenant.setCompanyId(companyId);
    for (const bucket of Object.values(NOTEBOOK_BUCKETS)) {
      const existing = await this.prisma.notebookCategory.findFirst({
        where: { companyId, codeKey: bucket.codeKey },
      });
      if (!existing) {
        await this.prisma.notebookCategory.create({
          data: {
            companyId,
            code: bucket.codeKey,
            codeKey: bucket.codeKey,
            name: bucket.nameAr,
            status: 'ACTIVE',
          },
        });
      }
    }
  }

  async listCategories(companyId: string) {
    await this.ensureDefaultCategories(companyId);
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

  async listNotes(
    companyId: string,
    opts?: { search?: string; categoryCode?: string },
  ) {
    await this.ensureDefaultCategories(companyId);
    const categoryCode = opts?.categoryCode?.trim().toUpperCase();
    let categoryId: string | undefined;
    if (categoryCode) {
      const cat = await this.prisma.notebookCategory.findFirst({
        where: { companyId, codeKey: categoryCode },
      });
      if (!cat) return [];
      categoryId = cat.id;
    }

    return this.prisma.businessNote.findMany({
      where: {
        ...(categoryId ? { categoryId } : {}),
        ...(opts?.search
          ? {
              OR: [
                { title: { contains: opts.search } },
                { body: { contains: opts.search } },
              ],
            }
          : {}),
      },
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
    categoryCode?: string;
    priority?: TaskPriority;
    status?: NotebookNoteStatus;
    workProjectId?: string;
    crmContactId?: string;
    employeeId?: string;
    roleCode?: string;
    isPlatformAdmin?: boolean;
  }) {
    await this.ensureDefaultCategories(input.companyId);
    let categoryId = input.categoryId;
    let categoryCode = input.categoryCode?.trim().toUpperCase();

    if (!categoryId && categoryCode) {
      const cat = await this.prisma.notebookCategory.findFirst({
        where: { companyId: input.companyId, codeKey: categoryCode },
      });
      if (!cat) throw new BadRequestException('Category not found');
      categoryId = cat.id;
    }

    if (categoryId && !categoryCode) {
      const cat = await this.prisma.notebookCategory.findFirst({
        where: { id: categoryId, companyId: input.companyId },
      });
      categoryCode = cat?.codeKey?.toUpperCase() || undefined;
    }

    if (
      categoryCode === 'DEV_IDEAS' &&
      !this.isOperator(input.roleCode, input.isPlatformAdmin)
    ) {
      throw new ForbiddenException(
        'Only operators can add development ideas',
      );
    }

    await this.validateLinks({
      companyId: input.companyId,
      categoryId,
      workProjectId: input.workProjectId,
      crmContactId: input.crmContactId,
      employeeId: input.employeeId,
    });
    return this.prisma.businessNote.create({
      data: {
        companyId: input.companyId,
        createdById: input.createdById,
        title: input.title,
        body: input.body,
        categoryId,
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
    actor?: { roleCode?: string; isPlatformAdmin?: boolean },
  ) {
    this.tenant.setCompanyId(companyId);
    const note = await this.prisma.businessNote.findFirst({
      where: { id: noteId, companyId },
      include: { category: true },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }

    const targetCategoryId =
      data.categoryId === undefined ? note.categoryId : data.categoryId;
    if (targetCategoryId) {
      const cat = await this.prisma.notebookCategory.findFirst({
        where: { id: targetCategoryId, companyId },
      });
      if (
        cat?.codeKey === 'DEV_IDEAS' &&
        !this.isOperator(actor?.roleCode, actor?.isPlatformAdmin)
      ) {
        throw new ForbiddenException(
          'Only operators can manage development ideas',
        );
      }
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
