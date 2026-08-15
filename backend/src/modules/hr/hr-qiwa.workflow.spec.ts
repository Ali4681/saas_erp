jest.mock('../../generated/prisma/client', () => ({
  EmployeeQiwaContractStatus: {
    NOT_STARTED: 'NOT_STARTED',
    IN_PROGRESS: 'IN_PROGRESS',
    AWAITING_EMPLOYEE: 'AWAITING_EMPLOYEE',
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    DOCUMENTED: 'DOCUMENTED',
    REJECTED_OR_MODIFICATION: 'REJECTED_OR_MODIFICATION',
  },
  Prisma: {},
}));
jest.mock('../../database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../common/tenant/tenant-context.service', () => ({
  TenantContextService: class TenantContextService {},
}));
jest.mock('../platform/platform.service', () => ({
  PlatformService: class PlatformService {},
}));

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { HrQiwaService } from './hr-qiwa.service';

function makeService() {
  const prisma = {
    employee: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    employeeQiwaContract: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    attachment: { findFirst: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const tenant = { setCompanyId: jest.fn() };
  const platform = {
    registerAttachment: jest.fn().mockResolvedValue({
      id: 'att-1',
      fileName: 'qiwa-contract.pdf',
    }),
  };
  const service = new HrQiwaService(
    prisma as never,
    tenant as never,
    platform as never,
  );
  return { service, prisma, tenant, platform };
}

const employee = {
  id: 'emp-1',
  companyId: 'co-1',
  fullName: 'Ahmed',
  employeeNumber: 'E1',
  identityType: 'CITIZEN',
  identityNumber: '123',
  jobTitle: 'Dev',
  department: null,
  branch: null,
  basicSalary: '5000',
  currency: 'SAR',
  hireDate: new Date('2024-01-01'),
  employmentStatus: 'ACTIVE',
};

describe('HrQiwaService workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('startDocumentation: NOT_STARTED → IN_PROGRESS', async () => {
    const { service, prisma } = makeService();
    prisma.employee.findFirst.mockResolvedValue(employee);
    prisma.employeeQiwaContract.findFirst
      .mockResolvedValueOnce({
        id: 'q-1',
        status: 'NOT_STARTED',
        startedAt: null,
      })
      .mockResolvedValueOnce({
        id: 'q-1',
        employeeId: 'emp-1',
        status: 'IN_PROGRESS',
        qiwaContractReference: null,
        contractAttachmentId: null,
        startedAt: new Date(),
        sentAt: null,
        documentedAt: null,
        rejectedAt: null,
        verifiedByUserId: null,
        lastUpdatedByUserId: 'u-1',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        verifiedByUser: null,
        lastUpdatedByUser: null,
      });
    prisma.employeeQiwaContract.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.startDocumentation('co-1', 'emp-1', 'u-1');
    expect(prisma.employeeQiwaContract.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'IN_PROGRESS' }),
      }),
    );
    expect(result.status).toBe('IN_PROGRESS');
  });

  it('markSent rejects when not IN_PROGRESS', async () => {
    const { service, prisma } = makeService();
    prisma.employee.findFirst.mockResolvedValue(employee);
    prisma.employeeQiwaContract.findFirst.mockResolvedValue({
      id: 'q-1',
      status: 'NOT_STARTED',
    });
    await expect(
      service.markSent('co-1', 'emp-1', 'u-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('confirmDocumentation requires PDF magic and reference', async () => {
    const { service, prisma } = makeService();
    prisma.employee.findFirst.mockResolvedValue(employee);
    prisma.employeeQiwaContract.findFirst.mockResolvedValue({
      id: 'q-1',
      status: 'AWAITING_EMPLOYEE',
      notes: null,
    });

    await expect(
      service.confirmDocumentation('co-1', 'emp-1', 'u-1', {
        qiwaContractReference: '',
        documentedAt: '2026-08-01',
        fileName: 'x.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        contentBase64: Buffer.from('%PDF-1.4').toString('base64'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.confirmDocumentation('co-1', 'emp-1', 'u-1', {
        qiwaContractReference: 'QW-1',
        documentedAt: '2026-08-01',
        fileName: 'x.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        contentBase64: Buffer.from('NOTPDF').toString('base64'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('confirmDocumentation submits for approval with valid PDF + reference', async () => {
    const { service, prisma, platform } = makeService();
    prisma.employee.findFirst.mockResolvedValue(employee);
    prisma.employeeQiwaContract.findFirst
      .mockResolvedValueOnce({
        id: 'q-1',
        status: 'AWAITING_EMPLOYEE',
        notes: null,
      })
      .mockResolvedValueOnce({
        id: 'q-1',
        employeeId: 'emp-1',
        status: 'PENDING_APPROVAL',
        qiwaContractReference: 'QW-1',
        contractAttachmentId: 'att-1',
        startedAt: new Date(),
        sentAt: new Date(),
        documentedAt: new Date('2026-08-01'),
        rejectedAt: null,
        verifiedByUserId: null,
        lastUpdatedByUserId: 'u-1',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        verifiedByUser: null,
        lastUpdatedByUser: { id: 'u-1', fullName: 'HR' },
      });
    prisma.employeeQiwaContract.updateMany.mockResolvedValue({ count: 1 });
    prisma.employee.update.mockResolvedValue({});
    prisma.attachment.findFirst.mockResolvedValue({
      id: 'att-1',
      fileName: 'qiwa-contract.pdf',
    });

    const result = await service.confirmDocumentation('co-1', 'emp-1', 'u-1', {
      qiwaContractReference: 'QW-1',
      documentedAt: '2026-08-01',
      fileName: 'contract.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 20,
      contentBase64: Buffer.from('%PDF-1.4 hello').toString('base64'),
    });

    expect(platform.registerAttachment).toHaveBeenCalled();
    expect(prisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qiwaContractRef: 'QW-1',
        }),
      }),
    );
    expect(prisma.employee.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ approvalStatus: 'APPROVED' }),
      }),
    );
    expect(result.status).toBe('PENDING_APPROVAL');
  });

  it('approveDocumentation: PENDING_APPROVAL → DOCUMENTED', async () => {
    const { service, prisma } = makeService();
    prisma.employee.findFirst.mockResolvedValue(employee);
    prisma.employeeQiwaContract.findFirst
      .mockResolvedValueOnce({
        id: 'q-1',
        status: 'PENDING_APPROVAL',
        qiwaContractReference: 'QW-1',
        contractAttachmentId: 'att-1',
        documentedAt: new Date('2026-08-01'),
        notes: null,
      })
      .mockResolvedValueOnce({
        id: 'q-1',
        employeeId: 'emp-1',
        status: 'DOCUMENTED',
        qiwaContractReference: 'QW-1',
        contractAttachmentId: 'att-1',
        startedAt: new Date(),
        sentAt: new Date(),
        documentedAt: new Date('2026-08-01'),
        rejectedAt: null,
        verifiedByUserId: 'u-owner',
        lastUpdatedByUserId: 'u-owner',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        verifiedByUser: { id: 'u-owner', fullName: 'Owner' },
        lastUpdatedByUser: { id: 'u-owner', fullName: 'Owner' },
      });
    prisma.employeeQiwaContract.updateMany.mockResolvedValue({ count: 1 });
    prisma.employee.update.mockResolvedValue({});
    prisma.attachment.findFirst.mockResolvedValue({
      id: 'att-1',
      fileName: 'qiwa-contract.pdf',
    });

    const result = await service.approveDocumentation(
      'co-1',
      'emp-1',
      'u-owner',
    );
    expect(prisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ approvalStatus: 'APPROVED' }),
      }),
    );
    expect(result.status).toBe('DOCUMENTED');
  });

  it('requireEmployee throws 404 for missing employee', async () => {
    const { service, prisma } = makeService();
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(
      service.startDocumentation('co-1', 'missing', 'u-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
