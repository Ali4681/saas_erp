import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  IsBooleanString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { GlService } from './gl.service';

class ListAccountsQuery {
  @IsOptional()
  @IsBooleanString()
  postableOnly?: string;
}

class UpsertMappingBody {
  @IsOptional()
  @IsString()
  @MinLength(1)
  salesRevenueCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  salesVatPayableCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  salesCashPosCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  salesCardBankCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  inventoryGoodsCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  inventoryInTransitCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  inventoryShrinkageCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  apLocalCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  apInternationalCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  importLandingCostCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  cogsCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  corporateWalletCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  employeeAdvanceCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  pettyCashExpenseCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  mainTreasuryCode?: string;
}

class TrialBalanceQuery {
  @IsOptional()
  @IsString()
  asOf?: string;
}

class IncomeStatementQuery {
  @IsString()
  from!: string;

  @IsString()
  to!: string;
}

class BalanceSheetQuery {
  @IsString()
  asOf!: string;
}

@Controller('companies/:companyId/finance')
export class GlController {
  constructor(private readonly gl: GlService) {}

  @Post('chart-of-accounts/ensure')
  @RequirePermissions('finance.write')
  ensureChartOfAccounts(@Param('companyId') companyId: string) {
    return this.gl.ensureChartOfAccounts(companyId);
  }

  @Get('chart-of-accounts')
  @RequirePermissions('finance.read')
  listAccounts(
    @Param('companyId') companyId: string,
    @Query() query: ListAccountsQuery,
  ) {
    return this.gl.listAccounts(companyId, {
      postableOnly: query.postableOnly === 'true',
    });
  }

  @Get('account-mapping')
  @RequirePermissions('finance.read')
  getMapping(@Param('companyId') companyId: string) {
    return this.gl.getMapping(companyId);
  }

  @Put('account-mapping')
  @RequirePermissions('finance.write')
  upsertMapping(
    @Param('companyId') companyId: string,
    @Body() body: UpsertMappingBody,
  ) {
    return this.gl.upsertMapping(companyId, body);
  }

  @Get('journals')
  @RequirePermissions('finance.read')
  listJournals(@Param('companyId') companyId: string) {
    return this.gl.listJournals(companyId);
  }

  @Get('reports/trial-balance')
  @RequirePermissions('finance.read')
  trialBalance(
    @Param('companyId') companyId: string,
    @Query() query: TrialBalanceQuery,
  ) {
    return this.gl.trialBalance(companyId, query.asOf);
  }

  @Get('reports/income-statement')
  @RequirePermissions('finance.read')
  incomeStatement(
    @Param('companyId') companyId: string,
    @Query() query: IncomeStatementQuery,
  ) {
    return this.gl.incomeStatement(companyId, query.from, query.to);
  }

  @Get('reports/balance-sheet')
  @RequirePermissions('finance.read')
  balanceSheet(
    @Param('companyId') companyId: string,
    @Query() query: BalanceSheetQuery,
  ) {
    return this.gl.balanceSheet(companyId, query.asOf);
  }
}
