import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeQiwaContractStatus,
  Prisma,
} from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { PlatformService } from '../platform/platform.service';

const ALLOWED: Record<
  EmployeeQiwaContractStatus,
  EmployeeQiwaContractStatus[]
> = {
  NOT_STARTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['AWAITING_EMPLOYEE'],
  AWAITING_EMPLOYEE: ['PENDING_APPROVAL', 'REJECTED_OR_MODIFICATION'],
  PENDING_APPROVAL: ['DOCUMENTED', 'AWAITING_EMPLOYEE'],
  REJECTED_OR_MODIFICATION: ['IN_PROGRESS'],
  DOCUMENTED: [],
};

const MAX_PDF_BYTES = 15 * 1024 * 1024;

@Injectable()
export class HrQiwaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly platform: PlatformService,
  ) {}

  private assertTransition(
    from: EmployeeQiwaContractStatus,
    to: EmployeeQiwaContractStatus,
  ) {
    if (!ALLOWED[from]?.includes(to)) {
      throw new ConflictException(
        `Invalid Qiwa status transition ${from} → ${to}`,
      );
    }
  }

  private async audit(
    companyId: string,
    actorUserId: string,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId,
          actorUserId,
          action,
          entityType: 'employee_qiwa_contract',
          entityId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch {
      // never break primary flow
    }
  }

  private async requireEmployee(companyId: string, employeeId: string) {
    this.tenant.setCompanyId(companyId);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      include: {
        department: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  private serialize(
    row: {
      id: string;
      employeeId: string;
      status: EmployeeQiwaContractStatus;
      qiwaContractReference: string | null;
      contractAttachmentId: string | null;
      startedAt: Date | null;
      sentAt: Date | null;
      documentedAt: Date | null;
      rejectedAt: Date | null;
      verifiedByUserId: string | null;
      lastUpdatedByUserId: string | null;
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
      verifiedByUser?: { id: string; fullName: string } | null;
      lastUpdatedByUser?: { id: string; fullName: string } | null;
    },
    attachment?: { id: string; fileName: string } | null,
  ) {
    return {
      id: row.id,
      employeeId: row.employeeId,
      status: row.status,
      qiwaContractReference: row.qiwaContractReference,
      contractAttachmentId: row.contractAttachmentId,
      contractFile:
        attachment ??
        (row.contractAttachmentId
          ? { id: row.contractAttachmentId, fileName: 'Qiwa contract.pdf' }
          : null),
      startedAt: row.startedAt,
      sentAt: row.sentAt,
      documentedAt: row.documentedAt,
      rejectedAt: row.rejectedAt,
      verifiedBy: row.verifiedByUser
        ? { id: row.verifiedByUser.id, fullName: row.verifiedByUser.fullName }
        : row.verifiedByUserId
          ? { id: row.verifiedByUserId, fullName: null }
          : null,
      lastUpdatedBy: row.lastUpdatedByUser
        ? {
            id: row.lastUpdatedByUser.id,
            fullName: row.lastUpdatedByUser.fullName,
          }
        : null,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async getCurrent(companyId: string, employeeId: string) {
    await this.requireEmployee(companyId, employeeId);
    const row = await this.prisma.employeeQiwaContract.findFirst({
      where: { companyId, employeeId },
      orderBy: { updatedAt: 'desc' },
      include: {
        verifiedByUser: { select: { id: true, fullName: true } },
        lastUpdatedByUser: { select: { id: true, fullName: true } },
      },
    });
    if (!row) {
      return {
        id: null,
        employeeId,
        status: 'NOT_STARTED' as const,
        qiwaContractReference: null,
        contractAttachmentId: null,
        contractFile: null,
        startedAt: null,
        sentAt: null,
        documentedAt: null,
        rejectedAt: null,
        verifiedBy: null,
        lastUpdatedBy: null,
        notes: null,
        createdAt: null,
        updatedAt: null,
      };
    }
    let attachment: { id: string; fileName: string } | null = null;
    if (row.contractAttachmentId) {
      const att = await this.prisma.attachment.findFirst({
        where: { id: row.contractAttachmentId, companyId },
        select: { id: true, fileName: true },
      });
      attachment = att;
    }
    return this.serialize(row, attachment);
  }

  async getEmployeeSummaryForQiwa(companyId: string, employeeId: string) {
    const employee = await this.requireEmployee(companyId, employeeId);
    return {
      fullName: employee.fullName,
      employeeNumber: employee.employeeNumber,
      identityType: employee.identityType,
      identityNumber: employee.identityNumber,
      jobTitle: employee.jobTitle,
      department: employee.department?.name ?? null,
      branch: employee.branch?.name ?? null,
      basicSalary: employee.basicSalary,
      currency: employee.currency ?? 'SAR',
      hireDate: employee.hireDate,
      employmentStatus: employee.employmentStatus,
    };
  }

  private async getOrCreateDraft(
    companyId: string,
    employeeId: string,
    userId: string,
  ) {
    const existing = await this.prisma.employeeQiwaContract.findFirst({
      where: { companyId, employeeId },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return existing;
    return this.prisma.employeeQiwaContract.create({
      data: {
        companyId,
        employeeId,
        status: 'NOT_STARTED',
        lastUpdatedByUserId: userId,
      },
    });
  }

  async startDocumentation(
    companyId: string,
    employeeId: string,
    userId: string,
  ) {
    await this.requireEmployee(companyId, employeeId);
    const current = await this.getOrCreateDraft(companyId, employeeId, userId);

    if (current.status === 'IN_PROGRESS') {
      return this.getCurrent(companyId, employeeId);
    }
    if (current.status === 'DOCUMENTED') {
      // renewal: create a new row
      const created = await this.prisma.employeeQiwaContract.create({
        data: {
          companyId,
          employeeId,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          lastUpdatedByUserId: userId,
        },
      });
      await this.audit(
        companyId,
        userId,
        'QIWA_DOCUMENTATION_STARTED',
        created.id,
        {
          employeeId,
          from: 'DOCUMENTED',
          to: 'IN_PROGRESS',
          renewed: true,
        },
      );
      return this.getCurrent(companyId, employeeId);
    }

    this.assertTransition(current.status, 'IN_PROGRESS');
    const updated = await this.prisma.employeeQiwaContract.updateMany({
      where: { id: current.id, companyId, status: current.status },
      data: {
        status: 'IN_PROGRESS',
        startedAt: current.startedAt ?? new Date(),
        lastUpdatedByUserId: userId,
        rejectedAt: null,
      },
    });
    if (updated.count === 0) {
      throw new ConflictException(
        'The Qiwa contract status has changed. Please refresh.',
      );
    }
    await this.audit(
      companyId,
      userId,
      'QIWA_DOCUMENTATION_STARTED',
      current.id,
      {
        employeeId,
        from: current.status,
        to: 'IN_PROGRESS',
      },
    );
    return this.getCurrent(companyId, employeeId);
  }

  async markSent(companyId: string, employeeId: string, userId: string) {
    await this.requireEmployee(companyId, employeeId);
    const current = await this.prisma.employeeQiwaContract.findFirst({
      where: { companyId, employeeId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!current) throw new NotFoundException('Qiwa contract not found');
    this.assertTransition(current.status, 'AWAITING_EMPLOYEE');
    const updated = await this.prisma.employeeQiwaContract.updateMany({
      where: { id: current.id, companyId, status: 'IN_PROGRESS' },
      data: {
        status: 'AWAITING_EMPLOYEE',
        sentAt: new Date(),
        lastUpdatedByUserId: userId,
      },
    });
    if (updated.count === 0) {
      throw new ConflictException(
        'The Qiwa contract status has changed. Please refresh.',
      );
    }
    await this.audit(companyId, userId, 'QIWA_CONTRACT_SENT', current.id, {
      employeeId,
      from: 'IN_PROGRESS',
      to: 'AWAITING_EMPLOYEE',
    });
    return this.getCurrent(companyId, employeeId);
  }

  async markRejected(
    companyId: string,
    employeeId: string,
    userId: string,
    notes?: string,
  ) {
    await this.requireEmployee(companyId, employeeId);
    const reason = notes?.trim();
    if (!reason) {
      throw new BadRequestException('notes are required');
    }
    if (reason.length > 2000) {
      throw new BadRequestException('notes must be at most 2000 characters');
    }
    const current = await this.prisma.employeeQiwaContract.findFirst({
      where: { companyId, employeeId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!current) throw new NotFoundException('Qiwa contract not found');
    this.assertTransition(current.status, 'REJECTED_OR_MODIFICATION');
    const updated = await this.prisma.employeeQiwaContract.updateMany({
      where: { id: current.id, companyId, status: 'AWAITING_EMPLOYEE' },
      data: {
        status: 'REJECTED_OR_MODIFICATION',
        rejectedAt: new Date(),
        notes: reason,
        lastUpdatedByUserId: userId,
      },
    });
    if (updated.count === 0) {
      throw new ConflictException(
        'The Qiwa contract status has changed. Please refresh.',
      );
    }
    await this.audit(
      companyId,
      userId,
      'QIWA_CONTRACT_MARKED_REJECTED',
      current.id,
      {
        employeeId,
        from: 'AWAITING_EMPLOYEE',
        to: 'REJECTED_OR_MODIFICATION',
        notes: reason,
      },
    );
    return this.getCurrent(companyId, employeeId);
  }

  async retryDocumentation(
    companyId: string,
    employeeId: string,
    userId: string,
  ) {
    await this.requireEmployee(companyId, employeeId);
    const current = await this.prisma.employeeQiwaContract.findFirst({
      where: { companyId, employeeId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!current) throw new NotFoundException('Qiwa contract not found');
    this.assertTransition(current.status, 'IN_PROGRESS');
    const updated = await this.prisma.employeeQiwaContract.updateMany({
      where: {
        id: current.id,
        companyId,
        status: 'REJECTED_OR_MODIFICATION',
      },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        lastUpdatedByUserId: userId,
      },
    });
    if (updated.count === 0) {
      throw new ConflictException(
        'The Qiwa contract status has changed. Please refresh.',
      );
    }
    await this.audit(companyId, userId, 'QIWA_STATUS_CHANGED', current.id, {
      employeeId,
      from: 'REJECTED_OR_MODIFICATION',
      to: 'IN_PROGRESS',
    });
    return this.getCurrent(companyId, employeeId);
  }

  async confirmDocumentation(
    companyId: string,
    employeeId: string,
    userId: string,
    input: {
      qiwaContractReference: string;
      documentedAt: string;
      notes?: string;
      fileName: string;
      mimeType: string;
      sizeBytes: string | number;
      contentBase64: string;
    },
  ) {
    await this.requireEmployee(companyId, employeeId);
    const ref = input.qiwaContractReference?.trim();
    if (!ref || ref.length < 2 || ref.length > 120) {
      throw new BadRequestException(
        'qiwaContractReference is required (2–120 chars)',
      );
    }
    const documentedAt = new Date(input.documentedAt);
    if (Number.isNaN(documentedAt.getTime())) {
      throw new BadRequestException('documentedAt must be a valid date');
    }
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    if (documentedAt >= tomorrow) {
      throw new BadRequestException('documentedAt cannot be in the future');
    }
    const mime = (input.mimeType || '').toLowerCase();
    const name = input.fileName || 'qiwa-contract.pdf';
    if (mime !== 'application/pdf' && !/\.pdf$/i.test(name)) {
      throw new BadRequestException('contractFile must be a PDF');
    }
    const size = Number(input.sizeBytes);
    if (!(size > 0) || size > MAX_PDF_BYTES) {
      throw new BadRequestException(
        `PDF size must be between 1 byte and ${MAX_PDF_BYTES} bytes`,
      );
    }
    if (!input.contentBase64?.trim()) {
      throw new BadRequestException('contractFile content is required');
    }
    // Reject non-PDF payloads even if MIME/extension claims PDF
    try {
      const head = Buffer.from(
        input.contentBase64.slice(0, 64),
        'base64',
      ).toString('latin1');
      if (!head.startsWith('%PDF')) {
        throw new BadRequestException('contractFile must be a PDF');
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('contractFile content is invalid');
    }
    if (input.notes && input.notes.length > 2000) {
      throw new BadRequestException('notes must be at most 2000 characters');
    }

    const current = await this.prisma.employeeQiwaContract.findFirst({
      where: { companyId, employeeId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!current) throw new NotFoundException('Qiwa contract not found');
    this.assertTransition(current.status, 'PENDING_APPROVAL');
    if (current.status !== 'AWAITING_EMPLOYEE') {
      throw new ConflictException(
        'The Qiwa contract status has changed. Please refresh.',
      );
    }

    const attachment = await this.platform.registerAttachment({
      companyId,
      uploadedById: userId,
      entityType: 'employee_qiwa_contract',
      entityId: current.id,
      fileName: `qiwa-contract-${current.id.slice(0, 8)}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: size,
      contentBase64: input.contentBase64,
    });

    const updated = await this.prisma.employeeQiwaContract.updateMany({
      where: { id: current.id, companyId, status: 'AWAITING_EMPLOYEE' },
      data: {
        status: 'PENDING_APPROVAL',
        qiwaContractReference: ref,
        contractAttachmentId: attachment.id,
        documentedAt,
        verifiedByUserId: null,
        lastUpdatedByUserId: userId,
        notes: input.notes?.trim() || current.notes,
      },
    });
    if (updated.count === 0) {
      throw new ConflictException(
        'The Qiwa contract status has changed. Please refresh.',
      );
    }

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { qiwaContractRef: ref },
    });

    await this.audit(
      companyId,
      userId,
      'QIWA_CONTRACT_SUBMITTED_FOR_APPROVAL',
      current.id,
      {
        employeeId,
        from: 'AWAITING_EMPLOYEE',
        to: 'PENDING_APPROVAL',
        qiwaContractReference: ref,
        attachmentId: attachment.id,
      },
    );
    await this.audit(
      companyId,
      userId,
      'QIWA_CONTRACT_FILE_UPLOADED',
      current.id,
      {
        employeeId,
        attachmentId: attachment.id,
      },
    );

    return this.getCurrent(companyId, employeeId);
  }

  async approveDocumentation(
    companyId: string,
    employeeId: string,
    userId: string,
  ) {
    await this.requireEmployee(companyId, employeeId);
    const current = await this.prisma.employeeQiwaContract.findFirst({
      where: { companyId, employeeId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!current) throw new NotFoundException('Qiwa contract not found');
    this.assertTransition(current.status, 'DOCUMENTED');
    if (current.status !== 'PENDING_APPROVAL') {
      throw new ConflictException(
        'The Qiwa contract status has changed. Please refresh.',
      );
    }
    if (!current.qiwaContractReference || !current.contractAttachmentId) {
      throw new BadRequestException(
        'Reference and contract PDF are required before approval',
      );
    }

    const updated = await this.prisma.employeeQiwaContract.updateMany({
      where: { id: current.id, companyId, status: 'PENDING_APPROVAL' },
      data: {
        status: 'DOCUMENTED',
        verifiedByUserId: userId,
        lastUpdatedByUserId: userId,
        documentedAt: current.documentedAt ?? new Date(),
      },
    });
    if (updated.count === 0) {
      throw new ConflictException(
        'The Qiwa contract status has changed. Please refresh.',
      );
    }

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        approvalStatus: 'APPROVED',
        qiwaContractRef: current.qiwaContractReference,
      },
    });

    await this.audit(companyId, userId, 'QIWA_CONTRACT_DOCUMENTED', current.id, {
      employeeId,
      from: 'PENDING_APPROVAL',
      to: 'DOCUMENTED',
      qiwaContractReference: current.qiwaContractReference,
    });

    return this.getCurrent(companyId, employeeId);
  }

  async rejectApproval(
    companyId: string,
    employeeId: string,
    userId: string,
    notes: string,
  ) {
    await this.requireEmployee(companyId, employeeId);
    const reason = notes?.trim();
    if (!reason || reason.length < 2) {
      throw new BadRequestException('notes are required (min 2 characters)');
    }
    if (reason.length > 2000) {
      throw new BadRequestException('notes must be at most 2000 characters');
    }

    const current = await this.prisma.employeeQiwaContract.findFirst({
      where: { companyId, employeeId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!current) throw new NotFoundException('Qiwa contract not found');
    this.assertTransition(current.status, 'AWAITING_EMPLOYEE');
    if (current.status !== 'PENDING_APPROVAL') {
      throw new ConflictException(
        'The Qiwa contract status has changed. Please refresh.',
      );
    }

    const updated = await this.prisma.employeeQiwaContract.updateMany({
      where: { id: current.id, companyId, status: 'PENDING_APPROVAL' },
      data: {
        status: 'AWAITING_EMPLOYEE',
        lastUpdatedByUserId: userId,
        notes: reason,
      },
    });
    if (updated.count === 0) {
      throw new ConflictException(
        'The Qiwa contract status has changed. Please refresh.',
      );
    }

    await this.audit(
      companyId,
      userId,
      'QIWA_APPROVAL_REJECTED',
      current.id,
      {
        employeeId,
        from: 'PENDING_APPROVAL',
        to: 'AWAITING_EMPLOYEE',
        notes: reason,
      },
    );

    return this.getCurrent(companyId, employeeId);
  }
}
