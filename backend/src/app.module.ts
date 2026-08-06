import { Module, BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ClsModule } from 'nestjs-cls';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditInterceptor } from './common/audit/audit.interceptor';
import {
  JwtAuthGuard,
  PermissionsGuard,
} from './common/auth/auth.decorators';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { TenantInterceptor } from './common/tenant/tenant.interceptor';
import { EncryptionModule } from './common/encryption/encryption.module';
import { AuditModule } from './common/audit/audit.module';
import { StorageModule } from './common/storage/storage.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { HealthModule } from './modules/health/health.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { DocumentsModule } from './common/documents/documents.module';
import { AutomationModule } from './modules/automation/automation.module';
import { CompanyIntegrationsModule } from './modules/company-integrations/company-integrations.module';
import { CrmModule } from './modules/crm/crm.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HrModule } from './modules/hr/hr.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { NotebookModule } from './modules/notebook/notebook.module';
import { PlansModule } from './modules/plans/plans.module';
import { PlatformModule } from './modules/platform/platform.module';
import { PurchasingModule } from './modules/purchasing/purchasing.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RetentionModule } from './modules/retention/retention.module';
import { SalesModule } from './modules/sales/sales.module';
import { SandboxModule } from './modules/sandbox/sandbox.module';
import { UsersModule } from './modules/users/users.module';
import { WorkModule } from './modules/work/work.module';
import { AiModule } from './modules/ai/ai.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { LookupsModule } from './modules/lookups/lookups.module';
import { AppI18nModule } from './common/i18n/app-i18n.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AppI18nModule,
    ScheduleModule.forRoot(),
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (cls, req: { headers: Record<string, string | string[] | undefined> }) => {
          const companyHeader = req.headers['x-company-id'];
          const userHeader = req.headers['x-user-id'];
          if (typeof companyHeader === 'string' && companyHeader.length > 0) {
            cls.set('companyId', companyHeader);
          }
          if (typeof userHeader === 'string' && userHeader.length > 0) {
            cls.set('userId', userHeader);
          }
        },
      },
    }),
    EncryptionModule,
    StorageModule,
    AuditModule,
    DocumentsModule,
    DatabaseModule,
    AuthModule,
    LookupsModule,
    PlansModule,
    CompaniesModule,
    UsersModule,
    IntegrationsModule,
    FinanceModule,
    CrmModule,
    SalesModule,
    PurchasingModule,
    InventoryModule,
    HrModule,
    WorkModule,
    AutomationModule,
    PlatformModule,
    NotebookModule,
    CompanyIntegrationsModule,
    MessagingModule,
    NotificationsModule,
    ReportsModule,
    AiModule,
    RetentionModule,
    HealthModule,
    SandboxModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        exceptionFactory: (errors) => {
          const details = errors.flatMap((err) => {
            const constraints = err.constraints
              ? Object.values(err.constraints)
              : [];
            return constraints.map((msg) =>
              err.property ? `${err.property}: ${msg}` : msg,
            );
          });
          return new BadRequestException({
            statusCode: 400,
            message: 'errors.validationFailed',
            i18nKey: 'errors.validationFailed',
            error: 'Bad Request',
            details,
          });
        },
      }),
    },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
