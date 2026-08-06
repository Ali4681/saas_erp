import {
  BadRequestException,
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
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { RolesService } from './roles.service';

class RolesQuery {
  @IsOptional()
  @IsIn(['TENANT', 'PLATFORM'])
  scope?: 'TENANT' | 'PLATFORM';
}

class PermissionsQuery {
  @IsOptional()
  @IsString()
  module?: string;
}

class CreateRoleBody {
  @IsString()
  @MinLength(3)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[];
}

class UpdateRoleBody {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[];
}

class UpdateRolePermissionsBody {
  @IsArray()
  @IsString({ each: true })
  permissionCodes!: string[];
}

@Controller()
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get('roles')
  @RequirePermissions('users.read')
  listRoles(@Query() query: RolesQuery) {
    return this.roles.listRoles(query.scope ?? 'TENANT');
  }

  @Get('permissions')
  @RequirePermissions('users.read')
  listPermissions(@Query() query: PermissionsQuery) {
    return this.roles.listPermissions(query.module, true);
  }

  @Get('companies/:companyId/permissions')
  @RequirePermissions('users.read')
  listCompanyPermissions(
    @Param('companyId') _companyId: string,
    @Query() query: PermissionsQuery,
  ) {
    return this.roles.listPermissions(query.module, true);
  }

  @Get('companies/:companyId/roles')
  @RequirePermissions('users.read')
  listCompanyRoles(@Param('companyId') companyId: string) {
    return this.roles.listCompanyRoles(companyId);
  }

  @Post('companies/:companyId/roles')
  @RequirePermissions('users.write')
  createCompanyRole(
    @Param('companyId') companyId: string,
    @Body() body: CreateRoleBody,
  ) {
    return this.roles.createCompanyRole(companyId, body);
  }

  @Patch('companies/:companyId/roles/:roleId')
  @RequirePermissions('users.write')
  updateCompanyRole(
    @Param('companyId') companyId: string,
    @Param('roleId') roleId: string,
    @Body() body: UpdateRoleBody,
  ) {
    return this.roles.updateCompanyRole(companyId, roleId, body);
  }

  @Delete('companies/:companyId/roles/:roleId')
  @RequirePermissions('users.write')
  deleteCompanyRole(
    @Param('companyId') companyId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.roles.deleteCompanyRole(companyId, roleId);
  }

  @Post('roles')
  @RequirePermissions('users.write')
  createRoleLegacy() {
    throw new BadRequestException('Use POST /companies/:companyId/roles');
  }

  @Patch('roles/:roleId/permissions')
  @RequirePermissions('users.write')
  updatePermissions(
    @Param('roleId') roleId: string,
    @Body() body: UpdateRolePermissionsBody,
  ) {
    return this.roles.updateRolePermissions(roleId, body.permissionCodes);
  }
}
