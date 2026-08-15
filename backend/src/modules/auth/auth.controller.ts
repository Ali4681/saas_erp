import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import {
  CurrentUser,
  Public,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { i18nForbidden } from '../../common/i18n/localized-exception';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthService } from './auth.service';

class LoginBody {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  companySlug?: string;
}

class RefreshBody {
  @IsString()
  refreshToken!: string;
}

class RegisterFcmBody {
  @IsString()
  @MinLength(20)
  token!: string;

  @IsString()
  platform!: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}

class UpdateLocaleBody {
  @IsString()
  @IsIn(['ar', 'en'])
  locale!: 'ar' | 'en';
}

class UpdateThemeBody {
  @IsString()
  @IsIn(['light', 'dark'])
  theme!: 'light' | 'dark';
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  login(@Body() body: LoginBody) {
    return this.auth.login(body);
  }

  /**
   * Platform-admin login. Same credentials flow as /auth/login, but rejects
   * non–platform-admin users. Browser apps use the Next BFF at
   * POST /bff/auth/admin-login (sets httpOnly cookies). This Nest route is for
   * API clients / proxies that hit Nest under `/api/*` directly.
   */
  @Public()
  @Post('admin-login')
  async adminLogin(@Body() body: LoginBody) {
    const data = await this.auth.login(body);
    if (!data.user.isPlatformAdmin) {
      throw i18nForbidden('errors.auth.notPlatformAdmin');
    }
    return data;
  }

  @Public()
  @Post('refresh')
  refresh(@Body() body: RefreshBody) {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  logout(@Body() body: RefreshBody) {
    return this.auth.logout(body.refreshToken);
  }

  @Public()
  @Get('fcm/config')
  fcmConfig() {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID')?.trim();
    const apiKey = this.config.get<string>('FIREBASE_WEB_API_KEY')?.trim();
    const messagingSenderId = this.config
      .get<string>('FIREBASE_MESSAGING_SENDER_ID')
      ?.trim();
    const appId = this.config.get<string>('FIREBASE_APP_ID')?.trim();
    const vapidKey = this.config.get<string>('FIREBASE_VAPID_KEY')?.trim();
    const enabled = Boolean(
      projectId && apiKey && messagingSenderId && appId && vapidKey,
    );

    return {
      enabled,
      vapidKey: enabled ? vapidKey : null,
      firebase: enabled
        ? {
            apiKey,
            authDomain: `${projectId}.firebaseapp.com`,
            projectId,
            messagingSenderId,
            appId,
          }
        : null,
    };
  }

  @Post('fcm/register')
  registerFcm(@CurrentUser() user: AuthUser, @Body() body: RegisterFcmBody) {
    return this.notifications.registerForAuthenticatedUser(user, body);
  }

  @Patch('me/locale')
  updateLocale(@CurrentUser() user: AuthUser, @Body() body: UpdateLocaleBody) {
    return this.auth.updateLocale(user.userId, body.locale);
  }

  @Patch('me/theme')
  updateTheme(@CurrentUser() user: AuthUser, @Body() body: UpdateThemeBody) {
    return this.auth.updateTheme(user.userId, body.theme);
  }
}
