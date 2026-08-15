import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { RequirePermissions } from '../../../common/auth/auth.decorators';
import { JobsService } from './jobs.service';

class EnqueueSyncBody {
  @IsString()
  @MinLength(2)
  entityType!: string;

  @IsOptional()
  @IsBoolean()
  fullSync?: boolean;
}

@Controller()
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get('integrations/sync-engine')
  @RequirePermissions('integrations.read')
  engineStatus() {
    return this.jobs.engineStatus();
  }

  @Get('companies/:companyId/projects/:projectId/jobs')
  @RequirePermissions('integrations.read')
  listJobs(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.jobs.list(companyId, projectId);
  }

  @Post('companies/:companyId/projects/:projectId/jobs/sync')
  @RequirePermissions('integrations.write')
  enqueueSync(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
    @Body() body: EnqueueSyncBody,
  ) {
    return this.jobs.enqueueSync({
      companyId,
      projectId,
      entityType: body.entityType,
      fullSync: body.fullSync,
    });
  }

  @Get('companies/:companyId/projects/:projectId/sync-states')
  @RequirePermissions('integrations.read')
  listSyncStates(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.jobs.listSyncStates(companyId, projectId);
  }

  @Get('companies/:companyId/projects/:projectId/integration-errors')
  @RequirePermissions('integrations.read')
  listErrors(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.jobs.listErrors(companyId, projectId);
  }
}
