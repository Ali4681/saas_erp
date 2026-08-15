import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaClient } from '../../generated/prisma/client';
import {
  APPEND_ONLY_MODELS,
  TENANT_OWNED_MODELS,
} from '../../database/schema-conventions';

type TenantClsStore = {
  companyId?: string;
  userId?: string;
  tenantBypass?: boolean;
  /** Allows deleteMany on APPEND_ONLY models during retention purge only. */
  appendOnlyPurge?: boolean;
};

const READ_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const WRITE_CREATE_OPS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
]);

const WRITE_MUTATE_OPS = new Set([
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);

@Injectable()
export class TenantContextService {
  constructor(private readonly cls: ClsService<TenantClsStore>) {}

  getCompanyId(): string | undefined {
    return this.cls.get('companyId');
  }

  requireCompanyId(): string {
    const companyId = this.getCompanyId();
    if (!companyId) {
      throw new UnauthorizedException(
        'Tenant context missing (companyId). Send x-company-id until auth is wired.',
      );
    }
    return companyId;
  }

  isBypassed(): boolean {
    return this.cls.get('tenantBypass') === true;
  }

  setBypass(value: boolean): void {
    this.cls.set('tenantBypass', value);
  }

  setCompanyId(companyId: string): void {
    this.cls.set('companyId', companyId);
  }

  setUserId(userId: string): void {
    this.cls.set('userId', userId);
  }

  isAppendOnlyPurgeAllowed(): boolean {
    return this.cls.get('appendOnlyPurge') === true;
  }

  setAppendOnlyPurge(value: boolean): void {
    this.cls.set('appendOnlyPurge', value);
  }
}

export function applyTenantExtension(
  client: PrismaClient,
  tenant: TenantContextService,
) {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const run = query as (nextArgs: unknown) => Promise<unknown>;

          if (!model) {
            return run(args);
          }

          if (
            APPEND_ONLY_MODELS.has(model) &&
            WRITE_MUTATE_OPS.has(operation) &&
            !(
              tenant.isAppendOnlyPurgeAllowed() &&
              (operation === 'delete' || operation === 'deleteMany')
            )
          ) {
            throw new ForbiddenException(
              `Model ${model} is append-only; ${operation} is not allowed`,
            );
          }

          if (!TENANT_OWNED_MODELS.has(model) || tenant.isBypassed()) {
            return run(args);
          }

          const companyId = tenant.requireCompanyId();
          const nextArgs = { ...(args as Record<string, unknown>) };

          if (WRITE_CREATE_OPS.has(operation)) {
            if (operation === 'create') {
              const data = {
                ...((nextArgs.data as Record<string, unknown>) ?? {}),
              };
              assertCompanyMatch(
                data.companyId as string | undefined,
                companyId,
              );
              data.companyId = companyId;
              nextArgs.data = data;
            } else {
              const rows = Array.isArray(nextArgs.data)
                ? (nextArgs.data as Record<string, unknown>[])
                : [nextArgs.data as Record<string, unknown>];
              nextArgs.data = rows.map((row) => {
                assertCompanyMatch(
                  row?.companyId as string | undefined,
                  companyId,
                );
                return { ...row, companyId };
              });
            }
          }

          if (READ_OPS.has(operation) || WRITE_MUTATE_OPS.has(operation)) {
            nextArgs.where = injectCompanyWhere(
              nextArgs.where as Record<string, unknown> | undefined,
              companyId,
            );
          }

          if (operation === 'upsert') {
            const create = {
              ...((nextArgs.create as Record<string, unknown>) ?? {}),
            };
            assertCompanyMatch(
              create.companyId as string | undefined,
              companyId,
            );
            create.companyId = companyId;
            nextArgs.create = create;
            nextArgs.where = injectCompanyWhere(
              nextArgs.where as Record<string, unknown> | undefined,
              companyId,
            );
          }

          return run(nextArgs);
        },
      },
    },
  });
}

function assertCompanyMatch(
  provided: string | undefined,
  expected: string,
): void {
  if (provided != null && provided !== expected) {
    throw new ForbiddenException(
      'companyId in payload does not match tenant context',
    );
  }
}

function injectCompanyWhere(
  where: Record<string, unknown> | undefined,
  companyId: string,
): Record<string, unknown> {
  if (!where) {
    return { companyId };
  }

  if (where.AND) {
    return { ...where, AND: [...asArray(where.AND), { companyId }] };
  }

  return { ...where, companyId };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

export type ExtendedPrismaClient = ReturnType<typeof applyTenantExtension>;
