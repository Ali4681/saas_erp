import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Observable, tap } from 'rxjs';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const SKIP_PREFIXES = [
  '/health',
  '/api/health',
  '/auth/login',
  '/api/auth/login',
  '/auth/refresh',
  '/api/auth/refresh',
  '/auth/logout',
  '/api/auth/logout',
];

const MODULE_RULES: Array<{ re: RegExp; module: string; entity: string }> = [
  { re: /\/sales\//, module: 'sales', entity: 'sales' },
  { re: /\/crm\//, module: 'crm', entity: 'crm' },
  { re: /\/purchasing\//, module: 'purchasing', entity: 'purchasing' },
  { re: /\/inventory\//, module: 'inventory', entity: 'inventory' },
  { re: /\/finance\//, module: 'finance', entity: 'finance' },
  { re: /\/hr\//, module: 'hr', entity: 'hr' },
  { re: /\/work\//, module: 'work', entity: 'work' },
  { re: /\/notebook\//, module: 'notebook', entity: 'notebook' },
  { re: /\/automation\//, module: 'automation', entity: 'automation' },
  { re: /\/marketing\//, module: 'marketing', entity: 'marketing' },
  { re: /\/ai\//, module: 'ai', entity: 'ai' },
  { re: /\/reports\//, module: 'reports', entity: 'reports' },
  { re: /\/messaging\//, module: 'messaging', entity: 'messaging' },
  {
    re: /\/payment-methods|\/payment-gateways/,
    module: 'payments',
    entity: 'payment',
  },
  {
    re: /\/projects|\/integration|\/webhooks|\/mirrors/,
    module: 'integrations',
    entity: 'integration',
  },
  { re: /\/departments/, module: 'departments', entity: 'company_department' },
  { re: /\/subscriptions/, module: 'subscriptions', entity: 'subscription' },
  { re: /\/audit-logs/, module: 'audit', entity: 'audit_log' },
  { re: /\/attachments/, module: 'attachments', entity: 'attachment' },
  { re: /\/notifications/, module: 'notifications', entity: 'notification' },
  { re: /\/companies/, module: 'companies', entity: 'company' },
  { re: /\/users/, module: 'users', entity: 'user' },
];

const ENTITY_ID_KEYS = [
  'invoiceId',
  'salesInvoiceId',
  'quoteId',
  'creditNoteId',
  'contactId',
  'itemId',
  'employeeId',
  'projectId',
  'noteId',
  'branchId',
  'departmentId',
  'subscriptionId',
  'paymentMethodId',
  'postId',
  'supplierId',
  'warehouseId',
  'ruleId',
  'taskId',
  'id',
];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      method: string;
      originalUrl?: string;
      url: string;
      route?: { path?: string };
      params?: Record<string, string>;
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
    }>();

    const method = request.method.toUpperCase();
    if (!MUTATING.has(method)) {
      return next.handle();
    }

    const path = request.originalUrl ?? request.url ?? '';
    if (SKIP_PREFIXES.some((p) => path.startsWith(p) || path.includes(p))) {
      return next.handle();
    }

    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: (body) => {
          void this.writeAudit(
            request,
            'SUCCEEDED',
            Date.now() - started,
            body,
          );
        },
        error: (error: unknown) => {
          void this.writeAudit(
            request,
            'FAILED',
            Date.now() - started,
            undefined,
            error,
          );
        },
      }),
    );
  }

  private async writeAudit(
    request: {
      method: string;
      originalUrl?: string;
      url: string;
      route?: { path?: string };
      params?: Record<string, string>;
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
    },
    outcome: 'SUCCEEDED' | 'FAILED',
    durationMs: number,
    body?: unknown,
    error?: unknown,
  ): Promise<void> {
    try {
      const companyId = this.cls.get<string>('companyId');
      const userId = this.cls.get<string>('userId');
      const routePath =
        request.route?.path ?? request.originalUrl ?? request.url;
      const fullPath = request.originalUrl ?? request.url ?? routePath;
      const method = request.method.toUpperCase();
      const op =
        method === 'POST'
          ? 'CREATE'
          : method === 'DELETE'
            ? 'DELETE'
            : 'UPDATE';
      const resolved = this.resolveModule(fullPath);
      // Prefer response body id; avoid treating route companyId as the entity.
      const entityId =
        this.pickEntityIdFromBody(body) ??
        this.pickEntityId(request.params, resolved.entity) ??
        null;
      const userAgent = request.headers['user-agent'];

      await this.prisma.auditLog.create({
        data: {
          companyId: companyId ?? null,
          actorUserId: userId ?? null,
          action: `${op}:${resolved.module}`,
          entityType: resolved.entity,
          entityId,
          ipAddress: request.ip ?? null,
          userAgent: typeof userAgent === 'string' ? userAgent : null,
          metadata: {
            outcome,
            durationMs,
            httpMethod: method,
            path: routePath,
            module: resolved.module,
            operation: op,
            error:
              error instanceof Error
                ? { name: error.name, message: error.message }
                : undefined,
          } as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Audit must never break the primary request path.
    }
  }

  private resolveModule(path: string): { module: string; entity: string } {
    for (const rule of MODULE_RULES) {
      if (rule.re.test(path)) {
        return { module: rule.module, entity: rule.entity };
      }
    }
    return { module: 'platform', entity: 'http_request' };
  }

  private pickEntityId(
    params: Record<string, string> | undefined,
    entityType: string,
  ): string | undefined {
    if (!params) return undefined;
    for (const key of ENTITY_ID_KEYS) {
      if (key === 'id' && entityType !== 'company' && params.companyId) {
        // fall through — prefer specific *Id keys over bare company scope
      }
      if (params[key] && params[key].length === 36) {
        if (key === 'companyId' && entityType !== 'company') continue;
        return params[key];
      }
    }
    for (const [key, value] of Object.entries(params)) {
      if (key === 'companyId' && entityType !== 'company') continue;
      if (key.toLowerCase().endsWith('id') && value?.length === 36) {
        return value;
      }
    }
    return undefined;
  }

  private pickEntityIdFromBody(body: unknown): string | undefined {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return undefined;
    }
    const obj = body as Record<string, unknown>;
    if (typeof obj.id === 'string' && obj.id.length === 36) return obj.id;
    return undefined;
  }
}
