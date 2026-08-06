import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import {
  NotebookNoteStatus,
  TaskPriority,
} from '../../generated/prisma/client';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { NotebookService } from './notebook.service';

class CreateCategoryBody {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;
}

class CreateNoteBody {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsEnum(NotebookNoteStatus)
  status?: NotebookNoteStatus;

  @IsOptional()
  @IsString()
  workProjectId?: string;

  @IsOptional()
  @IsString()
  crmContactId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;
}

class UpdateNoteBody {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsEnum(NotebookNoteStatus)
  status?: NotebookNoteStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  workProjectId?: string;

  @IsOptional()
  @IsString()
  crmContactId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;
}

class AddCommentBody {
  @IsString()
  @MinLength(1)
  body!: string;
}

class NotesQuery {
  @IsOptional()
  @IsString()
  q?: string;
}

@Controller('companies/:companyId/notebook')
export class NotebookController {
  constructor(private readonly notebook: NotebookService) {}

  @Get('categories')
  @RequirePermissions('notebook.read')
  listCategories(@Param('companyId') companyId: string) {
    return this.notebook.listCategories(companyId);
  }

  @Post('categories')
  @RequirePermissions('notebook.write')
  createCategory(
    @Param('companyId') companyId: string,
    @Body() body: CreateCategoryBody,
  ) {
    return this.notebook.createCategory({ companyId, ...body });
  }

  @Get('notes')
  @RequirePermissions('notebook.read')
  listNotes(
    @Param('companyId') companyId: string,
    @Query() query: NotesQuery,
  ) {
    return this.notebook.listNotes(companyId, query.q);
  }

  @Post('notes')
  @RequirePermissions('notebook.write')
  createNote(
    @Param('companyId') companyId: string,
    @Body() body: CreateNoteBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notebook.createNote({
      companyId,
      createdById: user.userId,
      ...body,
    });
  }

  @Patch('notes/:noteId')
  @RequirePermissions('notebook.write')
  updateNote(
    @Param('companyId') companyId: string,
    @Param('noteId') noteId: string,
    @Body() body: UpdateNoteBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notebook.updateNote(companyId, noteId, user.userId, body);
  }

  @Post('notes/:noteId/comments')
  @RequirePermissions('notebook.write')
  addComment(
    @Param('companyId') companyId: string,
    @Param('noteId') noteId: string,
    @Body() body: AddCommentBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notebook.addComment(
      companyId,
      noteId,
      user.userId,
      body.body,
    );
  }

  @Get('notes/:noteId/revisions')
  @RequirePermissions('notebook.read')
  listRevisions(
    @Param('companyId') companyId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.notebook.listRevisions(companyId, noteId);
  }
}
