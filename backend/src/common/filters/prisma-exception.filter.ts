import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { Prisma } from '../../generated/prisma/client';
import { localizedFromHttpException } from '../i18n/localized-exception';

/**
 * Maps Prisma / driver-adapter failures to stable HTTP statuses,
 * and translates LocalizedException / i18nKey payloads.
 */
@Catch()
@Injectable()
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const localized = localizedFromHttpException(exception);
      if (localized) {
        response.status(status).json(this.translateBody(localized));
        return;
      }
      const body = exception.getResponse();
      response
        .status(status)
        .json(
          typeof body === 'string'
            ? { statusCode: status, message: body }
            : body,
        );
      return;
    }

    const mapped = this.mapPrisma(exception);
    if (mapped) {
      const status = mapped.getStatus();
      const localized = localizedFromHttpException(mapped);
      if (localized) {
        response.status(status).json(this.translateBody(localized));
        return;
      }
      const body = mapped.getResponse();
      response
        .status(status)
        .json(
          typeof body === 'string'
            ? { statusCode: status, message: body, error: mapped.name }
            : body,
        );
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: this.t('errors.internal'),
      i18nKey: 'errors.internal',
    });
  }

  private translateBody(body: {
    statusCode: number;
    message: string;
    i18nKey: string;
    args?: Record<string, unknown>;
    error?: string;
    details?: string[];
  }) {
    return {
      statusCode: body.statusCode,
      message: this.t(body.i18nKey, body.args),
      i18nKey: body.i18nKey,
      ...(body.error ? { error: body.error } : {}),
      ...(body.args ? { args: body.args } : {}),
      ...(body.details?.length ? { details: body.details } : {}),
    };
  }

  private t(key: string, args?: Record<string, unknown>) {
    try {
      return this.i18n.t(key, { args: args ?? {} });
    } catch {
      return key;
    }
  }

  private mapPrisma(exception: unknown): HttpException | null {
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'errors.prisma.invalidQuery',
        i18nKey: 'errors.prisma.invalidQuery',
        detail: this.shortMessage(exception.message),
        error: 'Bad Request',
      });
    }

    if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) {
      const name =
        exception && typeof exception === 'object' && 'name' in exception
          ? String((exception as { name: string }).name)
          : '';
      const message =
        exception instanceof Error ? exception.message : String(exception);

      if (
        name.includes('UniqueConstraint') ||
        message.includes('UniqueConstraintViolation')
      ) {
        return new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          message: 'errors.prisma.duplicate',
          i18nKey: 'errors.prisma.duplicate',
          error: 'Conflict',
        });
      }
      if (
        name.includes('ForeignKeyConstraint') ||
        message.includes('ForeignKeyConstraintViolation')
      ) {
        return new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'errors.prisma.invalidReference',
          i18nKey: 'errors.prisma.invalidReference',
          error: 'Bad Request',
        });
      }
      if (
        name.includes('LengthMismatch') ||
        message.includes('LengthMismatch')
      ) {
        return new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'errors.prisma.tooLong',
          i18nKey: 'errors.prisma.tooLong',
          error: 'Bad Request',
        });
      }
      return null;
    }

    const err = exception;
    const target = this.formatTarget(err.meta);
    const model = this.formatModel(err.meta);

    switch (err.code) {
      case 'P2025':
        return new NotFoundException({
          statusCode: HttpStatus.NOT_FOUND,
          message: model
            ? 'errors.prisma.modelNotFound'
            : 'errors.prisma.notFound',
          i18nKey: model
            ? 'errors.prisma.modelNotFound'
            : 'errors.prisma.notFound',
          args: model ? { model } : undefined,
          error: 'Not Found',
        });
      case 'P2002':
        return new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          message: target
            ? 'errors.prisma.duplicateField'
            : 'errors.prisma.duplicate',
          i18nKey: target
            ? 'errors.prisma.duplicateField'
            : 'errors.prisma.duplicate',
          args: target ? { fields: target } : undefined,
          fields: target ? target.split(', ') : undefined,
          error: 'Conflict',
        });
      case 'P2003':
        return new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: target
            ? 'errors.prisma.invalidReferenceField'
            : 'errors.prisma.invalidReference',
          i18nKey: target
            ? 'errors.prisma.invalidReferenceField'
            : 'errors.prisma.invalidReference',
          args: target ? { fields: target } : undefined,
          error: 'Bad Request',
        });
      case 'P2000':
        return new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'errors.prisma.tooLong',
          i18nKey: 'errors.prisma.tooLong',
          error: 'Bad Request',
        });
      case 'P2011':
      case 'P2012':
        return new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'errors.prisma.requiredNull',
          i18nKey: 'errors.prisma.requiredNull',
          error: 'Bad Request',
        });
      case 'P2014':
        return new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'errors.prisma.relationBreak',
          i18nKey: 'errors.prisma.relationBreak',
          error: 'Bad Request',
        });
      default: {
        const nested = String(
          (
            err.meta as {
              driverAdapterError?: { name?: string; message?: string };
            }
          )?.driverAdapterError?.name ??
            (err.meta as { driverAdapterError?: { message?: string } })
              ?.driverAdapterError?.message ??
            '',
        );
        if (nested.includes('UniqueConstraint')) {
          return new ConflictException({
            statusCode: HttpStatus.CONFLICT,
            message: target
              ? 'errors.prisma.duplicateField'
              : 'errors.prisma.duplicate',
            i18nKey: target
              ? 'errors.prisma.duplicateField'
              : 'errors.prisma.duplicate',
            args: target ? { fields: target } : undefined,
            error: 'Conflict',
          });
        }
        if (nested.includes('ForeignKeyConstraint')) {
          return new BadRequestException({
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'errors.prisma.invalidReference',
            i18nKey: 'errors.prisma.invalidReference',
            error: 'Bad Request',
          });
        }
        if (nested.includes('LengthMismatch')) {
          return new BadRequestException({
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'errors.prisma.tooLong',
            i18nKey: 'errors.prisma.tooLong',
            error: 'Bad Request',
          });
        }
        this.logger.warn(`Unmapped Prisma code ${err.code}: ${err.message}`);
        return null;
      }
    }
  }

  private formatTarget(
    meta: Record<string, unknown> | undefined,
  ): string | null {
    if (!meta) return null;
    const target = meta.target;
    if (Array.isArray(target)) return target.map(String).join(', ');
    if (typeof target === 'string') return target;
    const field = meta.field_name ?? meta.fieldName ?? meta.constraint;
    if (field != null) return String(field);
    return null;
  }

  private formatModel(
    meta: Record<string, unknown> | undefined,
  ): string | null {
    if (!meta) return null;
    const model = meta.modelName ?? meta.model;
    return model != null ? String(model) : null;
  }

  private shortMessage(message: string): string {
    return (
      message
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)[0] ?? message
    );
  }
}
