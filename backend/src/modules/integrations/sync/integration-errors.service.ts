import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class IntegrationErrorsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    connectedProjectId: string;
    integrationJobId?: string;
    operationRequestId?: string;
    errorCode?: string;
    message: string;
    isRetryable?: boolean;
    payloadExcerpt?: string;
  }) {
    const existing = await this.prisma.integrationError.findFirst({
      where: {
        connectedProjectId: input.connectedProjectId,
        errorCode: input.errorCode ?? null,
        message: input.message,
        integrationJobId: input.integrationJobId ?? null,
        operationRequestId: input.operationRequestId ?? null,
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    if (existing) {
      return this.prisma.integrationError.update({
        where: { id: existing.id },
        data: {
          occurrenceCount: { increment: 1 },
          lastSeenAt: new Date(),
          isRetryable: input.isRetryable ?? existing.isRetryable,
          payloadExcerpt: input.payloadExcerpt ?? existing.payloadExcerpt,
        },
      });
    }

    return this.prisma.integrationError.create({
      data: {
        connectedProjectId: input.connectedProjectId,
        integrationJobId: input.integrationJobId,
        operationRequestId: input.operationRequestId,
        errorCode: input.errorCode,
        message: input.message,
        isRetryable: input.isRetryable ?? false,
        payloadExcerpt: input.payloadExcerpt,
      },
    });
  }
}
