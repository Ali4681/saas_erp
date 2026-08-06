import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type App,
  cert,
  getApp,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

type ServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: App | null = null;
  private initError: string | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    try {
      this.app = this.bootstrap();
      if (this.app) {
        this.logger.log(
          `Firebase Admin ready (project=${this.app.options.projectId ?? 'unknown'})`,
        );
      } else {
        this.logger.warn(
          'Firebase Admin not configured — push will use LOCAL_STUB',
        );
      }
    } catch (error) {
      this.initError =
        error instanceof Error ? error.message : 'Firebase init failed';
      this.logger.error(this.initError);
    }
  }

  get isReady(): boolean {
    return this.app != null;
  }

  get status() {
    return {
      ready: this.isReady,
      dryRun: this.isDryRun,
      projectId: this.app?.options.projectId ?? null,
      error: this.initError,
    };
  }

  get isDryRun(): boolean {
    const raw = (this.config.get<string>('FCM_DRY_RUN') ?? 'false')
      .trim()
      .toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
  }

  messaging(): Messaging | null {
    return this.app ? getMessaging(this.app) : null;
  }

  private bootstrap(): App | null {
    if (getApps().length > 0) {
      return getApp();
    }

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID')?.trim();
    const clientEmail = this.config
      .get<string>('FIREBASE_CLIENT_EMAIL')
      ?.trim();
    const privateKey = this.config
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n')
      .replace(/^"|"$/g, '')
      .trim();
    if (projectId && clientEmail && privateKey) {
      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
    }

    const pathRaw = this.config
      .get<string>('FIREBASE_SERVICE_ACCOUNT_PATH')
      ?.trim();
    if (pathRaw) {
      const full = isAbsolute(pathRaw)
        ? pathRaw
        : resolve(process.cwd(), pathRaw);
      if (!existsSync(full)) {
        throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH not found: ${full}`);
      }
      const json = JSON.parse(
        readFileSync(full, 'utf8'),
      ) as ServiceAccountJson;
      return initializeApp({
        credential: cert({
          projectId: json.project_id,
          clientEmail: json.client_email,
          privateKey: json.private_key?.replace(/\\n/g, '\n'),
        }),
        projectId: json.project_id,
      });
    }

    return null;
  }
}
