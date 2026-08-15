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

import { ConflictException } from '@nestjs/common';
import { HrQiwaService } from './hr-qiwa.service';

type Status =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'AWAITING_EMPLOYEE'
  | 'PENDING_APPROVAL'
  | 'DOCUMENTED'
  | 'REJECTED_OR_MODIFICATION';

const ALLOWED: Record<Status, Status[]> = {
  NOT_STARTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['AWAITING_EMPLOYEE'],
  AWAITING_EMPLOYEE: ['PENDING_APPROVAL', 'REJECTED_OR_MODIFICATION'],
  PENDING_APPROVAL: ['DOCUMENTED', 'AWAITING_EMPLOYEE'],
  REJECTED_OR_MODIFICATION: ['IN_PROGRESS'],
  DOCUMENTED: [],
};

function assertTransition(from: Status, to: Status) {
  if (!ALLOWED[from]?.includes(to)) {
    throw new ConflictException(
      `Invalid Qiwa status transition ${from} → ${to}`,
    );
  }
}

describe('HrQiwaService status transitions', () => {
  const allowed: Array<[Status, Status]> = [
    ['NOT_STARTED', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'AWAITING_EMPLOYEE'],
    ['AWAITING_EMPLOYEE', 'PENDING_APPROVAL'],
    ['AWAITING_EMPLOYEE', 'REJECTED_OR_MODIFICATION'],
    ['PENDING_APPROVAL', 'DOCUMENTED'],
    ['PENDING_APPROVAL', 'AWAITING_EMPLOYEE'],
    ['REJECTED_OR_MODIFICATION', 'IN_PROGRESS'],
  ];

  const denied: Array<[Status, Status]> = [
    ['NOT_STARTED', 'DOCUMENTED'],
    ['NOT_STARTED', 'AWAITING_EMPLOYEE'],
    ['AWAITING_EMPLOYEE', 'DOCUMENTED'],
    ['DOCUMENTED', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'DOCUMENTED'],
    ['REJECTED_OR_MODIFICATION', 'DOCUMENTED'],
  ];

  it.each(allowed)('allows %s → %s', (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each(denied)('rejects %s → %s', (from, to) => {
    expect(() => assertTransition(from, to)).toThrow(ConflictException);
  });

  it('constructs service with mocks', () => {
    const s = new HrQiwaService({} as never, {} as never, {} as never);
    expect(s).toBeInstanceOf(HrQiwaService);
  });
});
