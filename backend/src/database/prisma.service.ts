import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  applyTenantExtension,
  ExtendedPrismaClient,
  TenantContextService,
} from '../common/tenant/tenant-context.service';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  /** Unscoped client for auth / cross-tenant identity lookups. */
  private readonly root: PrismaClient;
  private readonly client: ExtendedPrismaClient;

  constructor(config: ConfigService, tenant: TenantContextService) {
    let host = config.getOrThrow<string>('DATABASE_HOST');
    // Linux/Plesk: prefer unix socket user (localhost) over TCP (127.0.0.1).
    if (process.platform !== 'win32' && host === '127.0.0.1') {
      host = 'localhost';
    }

    const adapter = new PrismaMariaDb({
      host,
      port: Number(config.get('DATABASE_PORT') ?? 3306),
      user: config.getOrThrow<string>('DATABASE_USER'),
      password: config.getOrThrow<string>('DATABASE_PASSWORD'),
      database: config.getOrThrow<string>('DATABASE_NAME'),
      connectionLimit: Number(config.get('DATABASE_CONNECTION_LIMIT') ?? 10),
      connectTimeout: Number(config.get('DATABASE_CONNECT_TIMEOUT') ?? 10000),
      allowPublicKeyRetrieval: true,
    });

    this.root = new PrismaClient({ adapter });
    this.client = applyTenantExtension(this.root, tenant);

    return new Proxy(this, {
      get(target, property, receiver) {
        if (property in target) {
          return Reflect.get(target, property, receiver);
        }

        const value = Reflect.get(
          target.client as object,
          property,
          target.client,
        );
        return typeof value === 'function'
          ? value.bind(target.client)
          : value;
      },
    }) as unknown as PrismaService;
  }

  /** Prisma client without tenant extension (auth, platform admin). */
  withoutTenant(): PrismaClient {
    return this.root;
  }

  async onModuleInit(): Promise<void> {
    await this.root.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.root.$disconnect();
  }

  async isHealthy(): Promise<boolean> {
    await this.client.$queryRaw`SELECT 1 AS ok`;
    return true;
  }
}

export interface PrismaService extends ExtendedPrismaClient {}
