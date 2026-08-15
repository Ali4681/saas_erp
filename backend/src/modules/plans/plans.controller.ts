import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { PlansService } from './plans.service';

class CreatePlanBody {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsEnum({ MONTHLY: 'MONTHLY', QUARTERLY: 'QUARTERLY', YEARLY: 'YEARLY' })
  billingInterval?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

  @Type(() => Number)
  @IsNumber()
  price!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;
}

class UpdatePlanBody {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEnum({ MONTHLY: 'MONTHLY', QUARTERLY: 'QUARTERLY', YEARLY: 'YEARLY' })
  billingInterval?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;
}

class ListPlansQuery {
  @IsOptional()
  @IsString()
  includeInactive?: string;
}

@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @RequirePermissions('plans.read')
  list(@Query() query: ListPlansQuery) {
    const includeInactive =
      query.includeInactive === '1' || query.includeInactive === 'true';
    return this.plans.list(includeInactive);
  }

  @Get(':code')
  @RequirePermissions('plans.read')
  getByCode(@Param('code') code: string) {
    return this.plans.getByCode(code);
  }

  @Post()
  @RequirePermissions('plans.write')
  create(@Body() body: CreatePlanBody) {
    return this.plans.create(body);
  }

  @Patch(':code')
  @RequirePermissions('plans.write')
  update(@Param('code') code: string, @Body() body: UpdatePlanBody) {
    return this.plans.update(code, body);
  }

  @Delete(':code')
  @RequirePermissions('plans.write')
  remove(@Param('code') code: string) {
    return this.plans.remove(code);
  }
}
