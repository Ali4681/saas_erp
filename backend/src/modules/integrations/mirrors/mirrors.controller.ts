import { Controller, Get, Param, Query } from '@nestjs/common';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RequirePermissions } from '../../../common/auth/auth.decorators';
import { MirrorsService } from './mirrors.service';

class ListQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;
}

@Controller('companies/:companyId/projects/:projectId/mirrors')
export class MirrorsController {
  constructor(private readonly mirrors: MirrorsService) {}

  @Get('orders/:orderId')
  @RequirePermissions('integrations.read')
  getOrder(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.mirrors.getOrder(companyId, projectId, orderId);
  }

  @Get(':entity')
  @RequirePermissions('integrations.read')
  list(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
    @Param('entity') entity: string,
    @Query() query: ListQuery,
  ) {
    return this.mirrors.list(companyId, projectId, entity, query.take);
  }
}
