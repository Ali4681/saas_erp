import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { TenantContextService } from '../tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async list(
    companyId: string,
    opts: {
      from?: string;
      to?: string;
      actorUserId?: string;
      module?: string;
      operation?: string;
      entityType?: string;
      entityId?: string;
      limit?: number;
    } = {},
  ) {
    this.tenant.setCompanyId(companyId);
    const limit = Math.min(Math.max(Number(opts.limit ?? 100) || 100, 1), 500);
    const createdAt: Prisma.DateTimeFilter = {};
    if (opts.from) createdAt.gte = new Date(opts.from);
    if (opts.to) createdAt.lte = new Date(opts.to);

    const rows = await this.prisma.auditLog.findMany({
      where: {
        companyId,
        ...(Object.keys(createdAt).length ? { createdAt } : {}),
        ...(opts.actorUserId ? { actorUserId: opts.actorUserId } : {}),
        ...(opts.entityType ? { entityType: opts.entityType } : {}),
        ...(opts.entityId ? { entityId: opts.entityId } : {}),
      },
      include: {
        actor: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit * 3, 1000),
    });

    const mapped = rows
      .map((row) => {
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        return {
          id: row.id,
          companyId: row.companyId,
          actorUserId: row.actorUserId,
          actor: row.actor,
          action: row.action,
          operation: (meta.operation as string) ?? null,
          module: (meta.module as string) ?? null,
          entityType: row.entityType,
          entityId: row.entityId,
          ipAddress: row.ipAddress,
          userAgent: row.userAgent,
          metadata: row.metadata,
          createdAt: row.createdAt,
        };
      })
      .filter((row) => (opts.module ? row.module === opts.module : true))
      .filter((row) =>
        opts.operation ? row.operation === opts.operation : true,
      )
      .slice(0, limit);

    const names = await this.resolveEntityNames(mapped);

    return mapped.map((row) => ({
      ...row,
      entityName:
        (row.entityId
          ? names.get(`${row.entityType}:${row.entityId}`)
          : null) ?? null,
    }));
  }

  private async resolveEntityNames(
    rows: Array<{ entityType: string; entityId: string | null }>,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const byType = new Map<string, Set<string>>();

    for (const row of rows) {
      if (!row.entityId) continue;
      const type = row.entityType;
      if (!byType.has(type)) byType.set(type, new Set());
      byType.get(type)!.add(row.entityId);
    }

    const load = async (
      type: string,
      ids: string[],
      lookup: (ids: string[]) => Promise<Array<{ id: string; name: string }>>,
    ) => {
      if (!ids.length) return;
      const found = await lookup(ids);
      for (const item of found) {
        result.set(`${type}:${item.id}`, item.name);
      }
    };

    await Promise.all([
      load(
        'subscription',
        [...(byType.get('subscription') ?? [])],
        async (ids) => {
          const subs = await this.prisma.subscription.findMany({
            where: { id: { in: ids } },
            include: { plan: true, company: { select: { displayName: true } } },
          });
          const found = new Set(subs.map((s) => s.id));
          const asCompanyIds = ids.filter((id) => !found.has(id));
          const companies = asCompanyIds.length
            ? await this.prisma.company.findMany({
                where: { id: { in: asCompanyIds } },
                select: { id: true, displayName: true },
              })
            : [];

          return [
            ...subs.map((s) => ({
              id: s.id,
              name: `${s.plan.name} — ${s.company.displayName}`,
            })),
            ...companies.map((c) => ({
              id: c.id,
              name: c.displayName,
            })),
          ];
        },
      ),
      load('company', [...(byType.get('company') ?? [])], async (ids) => {
        const companies = await this.prisma.company.findMany({
          where: { id: { in: ids } },
          select: { id: true, displayName: true },
        });
        return companies.map((c) => ({ id: c.id, name: c.displayName }));
      }),
      load('user', [...(byType.get('user') ?? [])], async (ids) => {
        const users = await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, fullName: true, email: true },
        });
        return users.map((u) => ({
          id: u.id,
          name: u.fullName || u.email || u.id,
        }));
      }),
      load('plan', [...(byType.get('plan') ?? [])], async (ids) => {
        const byId = await this.prisma.plan.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, code: true },
        });
        const byCode = await this.prisma.plan.findMany({
          where: { code: { in: ids } },
          select: { id: true, name: true, code: true },
        });
        return [
          ...byId.map((p) => ({ id: p.id, name: `${p.name} (${p.code})` })),
          ...byCode.map((p) => ({ id: p.code, name: `${p.name} (${p.code})` })),
        ];
      }),
      load(
        'company_branch',
        [...(byType.get('company_branch') ?? [])],
        async (ids) => {
          const branches = await this.prisma.companyBranch.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, code: true },
          });
          return branches.map((b) => ({
            id: b.id,
            name: `${b.name} (${b.code})`,
          }));
        },
      ),
      load(
        'company_department',
        [...(byType.get('company_department') ?? [])],
        async (ids) => {
          const deps = await this.prisma.companyDepartment.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
          });
          return deps.map((d) => ({ id: d.id, name: d.name }));
        },
      ),
    ]);

    // Generic fallback: if still unresolved and id matches current company, use company name
    const unresolvedCompanyIds = new Set<string>();
    for (const row of rows) {
      if (!row.entityId) continue;
      if (!result.has(`${row.entityType}:${row.entityId}`)) {
        unresolvedCompanyIds.add(row.entityId);
      }
    }
    if (unresolvedCompanyIds.size) {
      const companies = await this.prisma.company.findMany({
        where: { id: { in: [...unresolvedCompanyIds] } },
        select: { id: true, displayName: true },
      });
      for (const c of companies) {
        for (const row of rows) {
          if (row.entityId === c.id) {
            result.set(`${row.entityType}:${c.id}`, c.displayName);
          }
        }
      }
    }

    return result;
  }
}
