import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

export type LocalizedBody = {
  statusCode: number;
  message: string;
  i18nKey: string;
  args?: Record<string, unknown>;
  error?: string;
};

export function isLocalizedBody(body: unknown): body is LocalizedBody {
  return (
    typeof body === 'object' &&
    body != null &&
    'i18nKey' in body &&
    typeof (body as { i18nKey: unknown }).i18nKey === 'string'
  );
}

function make(
  status: HttpStatus,
  errorName: string,
  i18nKey: string,
  args?: Record<string, unknown>,
): LocalizedBody {
  return {
    statusCode: status,
    message: i18nKey,
    i18nKey,
    args,
    error: errorName,
  };
}

export function i18nBadRequest(key: string, args?: Record<string, unknown>) {
  return new BadRequestException(
    make(HttpStatus.BAD_REQUEST, 'Bad Request', key, args),
  );
}

export function i18nNotFound(key: string, args?: Record<string, unknown>) {
  return new NotFoundException(
    make(HttpStatus.NOT_FOUND, 'Not Found', key, args),
  );
}

export function i18nForbidden(key: string, args?: Record<string, unknown>) {
  return new ForbiddenException(
    make(HttpStatus.FORBIDDEN, 'Forbidden', key, args),
  );
}

export function i18nUnauthorized(key: string, args?: Record<string, unknown>) {
  return new UnauthorizedException(
    make(HttpStatus.UNAUTHORIZED, 'Unauthorized', key, args),
  );
}

export function i18nConflict(key: string, args?: Record<string, unknown>) {
  return new ConflictException(
    make(HttpStatus.CONFLICT, 'Conflict', key, args),
  );
}

/** Detect plain message strings that are already i18n keys (errors.*, common.*). */
export function looksLikeI18nKey(message: unknown): message is string {
  return (
    typeof message === 'string' &&
    /^(errors|common|prisma|auth|users|roles|plans|automation)\.[a-zA-Z0-9_.]+$/.test(
      message,
    )
  );
}

export function localizedFromHttpException(
  exception: HttpException,
): LocalizedBody | null {
  const body = exception.getResponse();
  if (isLocalizedBody(body)) return body;
  if (typeof body === 'string' && looksLikeI18nKey(body)) {
    return {
      statusCode: exception.getStatus(),
      message: body,
      i18nKey: body,
    };
  }
  if (
    typeof body === 'object' &&
    body != null &&
    'message' in body &&
    looksLikeI18nKey((body as { message: unknown }).message)
  ) {
    return {
      statusCode: exception.getStatus(),
      message: (body as { message: string }).message,
      i18nKey: (body as { message: string }).message,
      error:
        typeof (body as { error?: unknown }).error === 'string'
          ? ((body as unknown as { error: string }).error)
          : undefined,
    };
  }
  return null;
}
