import { Controller, Post, Query } from '@nestjs/common';
import { IsBooleanString, IsOptional } from 'class-validator';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { RetentionService } from './retention.service';

class PurgeQuery {
  @IsOptional()
  @IsBooleanString()
  dryRun?: string;
}

@Controller('admin/retention')
export class RetentionController {
  constructor(private readonly retention: RetentionService) {}

  @Post('purge')
  @RequirePermissions('retention.run')
  purge(@Query() query: PurgeQuery) {
    return this.retention.purgeExpired({
      dryRun: query.dryRun === 'true',
    });
  }
}
