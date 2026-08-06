import { Global, Module } from '@nestjs/common';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, TenantContextService],
  exports: [PrismaService, TenantContextService],
})
export class DatabaseModule {}
