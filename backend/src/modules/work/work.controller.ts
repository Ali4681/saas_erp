import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  IsEnum,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import {
  TaskPriority,
  TaskStatus,
  WorkPhaseStatus,
  WorkProjectStatus,
} from '../../generated/prisma/client';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { WorkService } from './work.service';

class CreateProjectBody {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  crmContactId?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  startsOn?: string;

  @IsOptional()
  @IsString()
  endsOn?: string;

  @IsOptional()
  @IsNumberString()
  budget?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

class UpdateProjectStatusBody {
  @IsEnum(WorkProjectStatus)
  status!: WorkProjectStatus;

  @IsOptional()
  @IsNumber()
  progressPercent?: number;
}

class AddMemberBody {
  @IsString()
  companyUserId!: string;

  @IsOptional()
  @IsString()
  projectRole?: string;
}

class AddPhaseBody {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  position!: number;
}

class UpdatePhaseStatusBody {
  @IsEnum(WorkPhaseStatus)
  status!: WorkPhaseStatus;
}

class CreateTaskBody {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  workProjectPhaseId?: string;

  @IsOptional()
  @IsString()
  assigneeCompanyUserId?: string;

  @IsOptional()
  @IsString()
  parentTaskId?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsOptional()
  @IsNumberString()
  estimatedHours?: string;
}

class UpdateTaskStatusBody {
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @IsOptional()
  @IsNumber()
  progressPercent?: number;
}

class AddCommentBody {
  @IsString()
  @MinLength(1)
  body!: string;
}

@Controller('companies/:companyId/work')
export class WorkController {
  constructor(private readonly work: WorkService) {}

  @Get('projects')
  @RequirePermissions('work.read')
  listProjects(@Param('companyId') companyId: string) {
    return this.work.listProjects(companyId);
  }

  @Post('projects')
  @RequirePermissions('work.write')
  createProject(
    @Param('companyId') companyId: string,
    @Body() body: CreateProjectBody,
  ) {
    return this.work.createProject({ companyId, ...body });
  }

  @Patch('projects/:projectId/status')
  @RequirePermissions('work.write')
  updateProjectStatus(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
    @Body() body: UpdateProjectStatusBody,
  ) {
    return this.work.updateProjectStatus(
      companyId,
      projectId,
      body.status,
      body.progressPercent,
    );
  }

  @Post('projects/:projectId/members')
  @RequirePermissions('work.write')
  addMember(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
    @Body() body: AddMemberBody,
  ) {
    return this.work.addMember(
      companyId,
      projectId,
      body.companyUserId,
      body.projectRole,
    );
  }

  @Post('projects/:projectId/phases')
  @RequirePermissions('work.write')
  addPhase(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
    @Body() body: AddPhaseBody,
  ) {
    return this.work.addPhase(companyId, projectId, body.name, body.position);
  }

  @Patch('phases/:phaseId/status')
  @RequirePermissions('work.write')
  updatePhaseStatus(
    @Param('companyId') companyId: string,
    @Param('phaseId') phaseId: string,
    @Body() body: UpdatePhaseStatusBody,
  ) {
    return this.work.updatePhaseStatus(companyId, phaseId, body.status);
  }

  @Get('projects/:projectId/tasks')
  @RequirePermissions('work.read')
  listTasks(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.work.listTasks(companyId, projectId);
  }

  @Post('projects/:projectId/tasks')
  @RequirePermissions('work.write')
  createTask(
    @Param('companyId') companyId: string,
    @Param('projectId') projectId: string,
    @Body() body: CreateTaskBody,
  ) {
    return this.work.createTask({
      companyId,
      workProjectId: projectId,
      ...body,
    });
  }

  @Patch('tasks/:taskId/status')
  @RequirePermissions('work.write')
  updateTaskStatus(
    @Param('companyId') companyId: string,
    @Param('taskId') taskId: string,
    @Body() body: UpdateTaskStatusBody,
  ) {
    return this.work.updateTaskStatus(
      companyId,
      taskId,
      body.status,
      body.progressPercent,
    );
  }

  @Post('tasks/:taskId/comments')
  @RequirePermissions('work.write')
  addComment(
    @Param('companyId') companyId: string,
    @Param('taskId') taskId: string,
    @Body() body: AddCommentBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.work.addComment(companyId, taskId, user.userId, body.body);
  }
}
