import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthUser } from '../auth/auth.decorators';
import { TenantContextService } from './tenant-context.service';

/**
 * Binds tenant CLS from JWT after guards run (middleware cannot see req.user).
 *
 * Platform admin:
 * - with X-Company-Id → work inside that company (no bypass)
 * - without header → platform-wide bypass (list companies, plans, …)
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenant: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      headers: Record<string, string | string[] | undefined>;
    }>();

    const headerRaw = request.headers['x-company-id'];
    const headerCompanyId =
      typeof headerRaw === 'string' && headerRaw.length > 0
        ? headerRaw
        : Array.isArray(headerRaw) && headerRaw[0]
          ? headerRaw[0]
          : undefined;

    if (request.user?.userId) {
      this.tenant.setUserId(request.user.userId);
    }

    if (request.user?.isPlatformAdmin) {
      if (headerCompanyId) {
        this.tenant.setCompanyId(headerCompanyId);
        this.tenant.setBypass(false);
      } else {
        this.tenant.setBypass(true);
      }
      return next.handle();
    }

    if (request.user?.companyId) {
      this.tenant.setCompanyId(request.user.companyId);
    } else if (headerCompanyId) {
      this.tenant.setCompanyId(headerCompanyId);
    }

    return next.handle();
  }
}
