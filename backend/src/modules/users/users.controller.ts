import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { UsersService } from './users.service';

class InviteUserBody {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  roleCode!: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}

class UpdateMembershipRoleBody {
  @IsString()
  roleCode!: string;
}

@Controller('companies/:companyId/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('users.read')
  list(@Param('companyId') companyId: string) {
    return this.users.listCompanyUsers(companyId);
  }

  @Post()
  @RequirePermissions('users.write')
  invite(@Param('companyId') companyId: string, @Body() body: InviteUserBody) {
    return this.users.inviteToCompany({ companyId, ...body });
  }

  @Patch(':membershipId/role')
  @RequirePermissions('users.write')
  updateRole(
    @Param('companyId') companyId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateMembershipRoleBody,
  ) {
    return this.users.updateMembershipRole(
      companyId,
      membershipId,
      body.roleCode,
    );
  }
}
