import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import {
  BankAccountType,
  ExpenseStatus,
  FinancialDirection,
  FinancialTransactionType,
} from '../../generated/prisma/client';
import {
  CurrentUser,
  RequirePermissions,
} from '../../common/auth/auth.decorators';
import type { AuthUser } from '../../common/auth/auth.decorators';
import { FinanceService } from './finance.service';

class CreateBankAccountBody {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(BankAccountType)
  accountType!: BankAccountType;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  iban?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

class CreateCategoryBody {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;
}

class CreateExpenseBody {
  @IsString()
  expenseCategoryId!: string;

  @IsString()
  @MinLength(2)
  description!: string;

  @IsNumberString()
  amount!: string;

  @IsString()
  expenseDate!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  connectedProjectId?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;
}

class UpdateExpenseStatusBody {
  @IsEnum(ExpenseStatus)
  status!: ExpenseStatus;
}

class CreateTransactionBody {
  @IsEnum(FinancialTransactionType)
  transactionType!: FinancialTransactionType;

  @IsEnum(FinancialDirection)
  direction!: FinancialDirection;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  connectedProjectId?: string;

  @IsOptional()
  @IsString()
  externalOrderId?: string;

  @IsOptional()
  @IsString()
  installmentTransactionId?: string;

  @IsOptional()
  @IsString()
  externalSettlementId?: string;

  @IsOptional()
  @IsString()
  expenseId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class DashboardQuery {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

class ListTxQuery {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}

class PostOrderBody {
  @IsString()
  externalOrderId!: string;
}

@Controller('companies/:companyId/finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('dashboard')
  @RequirePermissions('finance.read')
  dashboard(
    @Param('companyId') companyId: string,
    @Query() query: DashboardQuery,
  ) {
    return this.finance.dashboard(companyId, query);
  }

  @Get('bank-accounts')
  @RequirePermissions('finance.read')
  listBankAccounts(@Param('companyId') companyId: string) {
    return this.finance.listBankAccounts(companyId);
  }

  @Post('bank-accounts')
  @RequirePermissions('finance.write')
  createBankAccount(
    @Param('companyId') companyId: string,
    @Body() body: CreateBankAccountBody,
  ) {
    return this.finance.createBankAccount({ companyId, ...body });
  }

  @Get('expense-categories')
  @RequirePermissions('finance.read')
  listCategories(@Param('companyId') companyId: string) {
    return this.finance.listExpenseCategories(companyId);
  }

  @Post('expense-categories')
  @RequirePermissions('finance.write')
  createCategory(
    @Param('companyId') companyId: string,
    @Body() body: CreateCategoryBody,
  ) {
    return this.finance.createExpenseCategory({ companyId, ...body });
  }

  @Get('expenses')
  @RequirePermissions('finance.read')
  listExpenses(@Param('companyId') companyId: string) {
    return this.finance.listExpenses(companyId);
  }

  @Post('expenses')
  @RequirePermissions('finance.write')
  createExpense(
    @Param('companyId') companyId: string,
    @Body() body: CreateExpenseBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.finance.createExpense({
      companyId,
      createdById: user.userId,
      ...body,
    });
  }

  @Patch('expenses/:expenseId/status')
  @RequirePermissions('finance.write')
  updateExpenseStatus(
    @Param('companyId') companyId: string,
    @Param('expenseId') expenseId: string,
    @Body() body: UpdateExpenseStatusBody,
  ) {
    return this.finance.updateExpenseStatus(companyId, expenseId, body.status);
  }

  @Get('transactions')
  @RequirePermissions('finance.read')
  listTransactions(
    @Param('companyId') companyId: string,
    @Query() query: ListTxQuery,
  ) {
    return this.finance.listTransactions(companyId, query);
  }

  @Post('transactions')
  @RequirePermissions('finance.write')
  createTransaction(
    @Param('companyId') companyId: string,
    @Body() body: CreateTransactionBody,
  ) {
    return this.finance.createTransaction({ companyId, ...body });
  }

  @Post('transactions/from-order')
  @RequirePermissions('finance.write')
  postFromOrder(
    @Param('companyId') companyId: string,
    @Body() body: PostOrderBody,
  ) {
    return this.finance.postExternalOrder(companyId, body.externalOrderId);
  }
}
