import { Controller, Get, Param, Query } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { CatalogService } from './catalog.service';

class ListProvidersQuery {
  @IsOptional()
  @IsString()
  category?: string;
}

@Controller('integrations')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  @RequirePermissions('integrations.read')
  listCategories() {
    return this.catalog.listCategories();
  }

  @Get('providers')
  @RequirePermissions('integrations.read')
  listProviders(@Query() query: ListProvidersQuery) {
    return this.catalog.listProviders(query.category);
  }

  @Get('providers/:code')
  @RequirePermissions('integrations.read')
  getProvider(@Param('code') code: string) {
    return this.catalog.getProvider(code);
  }

  @Get('capabilities')
  @RequirePermissions('integrations.read')
  listCapabilities() {
    return this.catalog.listCapabilities();
  }
}
