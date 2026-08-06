import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { AiService } from './ai.service';

class GenerateProductBody {
  @IsString()
  @MinLength(2)
  prompt!: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  targetCurrency?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryHints?: string[];
}

class ImproveTextBody {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsString()
  goal?: 'improve' | 'shorten' | 'marketing' | 'formal';

  @IsOptional()
  @IsString()
  language?: string;
}

class AskBody {
  @IsString()
  @MinLength(3)
  question!: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

class AnalyzeReportBody {
  @IsEnum(['sales', 'inventory', 'hr', 'executive'] as const)
  scope!: 'sales' | 'inventory' | 'hr' | 'executive';

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

class AnalyzeNoteBody {
  @IsOptional()
  @IsString()
  noteId?: string;

  @IsOptional()
  @IsString()
  text?: string;
}

class SearchNotesBody {
  @IsString()
  @MinLength(2)
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

class MarketingBody {
  @IsString()
  @MinLength(2)
  topic!: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  variants?: number;
}

@Controller('companies/:companyId/ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  @RequirePermissions('ai.read')
  status(@Param('companyId') companyId: string) {
    return this.ai.status(companyId);
  }

  @Post('products/generate')
  @RequirePermissions('ai.write')
  generateProduct(
    @Param('companyId') companyId: string,
    @Body() body: GenerateProductBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ai.generateProduct(companyId, user.userId, body);
  }

  @Post('products/improve-text')
  @RequirePermissions('ai.write')
  improveText(
    @Param('companyId') companyId: string,
    @Body() body: ImproveTextBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ai.improveText(companyId, user.userId, body);
  }

  @Post('assistant/ask')
  @RequirePermissions('ai.write')
  ask(
    @Param('companyId') companyId: string,
    @Body() body: AskBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ai.askAssistant(companyId, user.userId, body);
  }

  @Post('reports/analyze')
  @RequirePermissions('ai.write')
  analyzeReport(
    @Param('companyId') companyId: string,
    @Body() body: AnalyzeReportBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ai.analyzeReport(companyId, user.userId, body);
  }

  @Post('notes/analyze')
  @RequirePermissions('ai.write')
  analyzeNote(
    @Param('companyId') companyId: string,
    @Body() body: AnalyzeNoteBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ai.analyzeNote(companyId, user.userId, body);
  }

  @Post('notes/search')
  @RequirePermissions('ai.write')
  searchNotes(
    @Param('companyId') companyId: string,
    @Body() body: SearchNotesBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ai.searchNotes(companyId, user.userId, body);
  }

  @Post('marketing/generate')
  @RequirePermissions('ai.write')
  marketing(
    @Param('companyId') companyId: string,
    @Body() body: MarketingBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ai.generateMarketing(companyId, user.userId, body);
  }
}
