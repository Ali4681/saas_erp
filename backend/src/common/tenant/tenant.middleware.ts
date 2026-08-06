import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AuthUser } from '../auth/auth.decorators';
import { TenantContextService } from './tenant-context.service';

/** Early CLS bind; TenantInterceptor re-applies after JWT (authoritative). */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenant: TenantContextService) {}

  use(req: Request & { user?: AuthUser }, _res: Response, next: NextFunction) {
    const headerRaw = req.headers['x-company-id'];
    const headerCompanyId =
      typeof headerRaw === 'string' && headerRaw.length > 0
        ? headerRaw
        : Array.isArray(headerRaw) && headerRaw[0]
          ? headerRaw[0]
          : undefined;

    if (headerCompanyId) {
      this.tenant.setCompanyId(headerCompanyId);
    }

    next();
  }
}
