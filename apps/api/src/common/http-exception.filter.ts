import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError } from './domain-errors';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
  422: 'VALIDATION_FAILED',
};

/** 失败响应统一包络：{ error: { code, message, details?, requestId } }（§9.1） */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId ?? 'unknown';

    if (exception instanceof DomainError) {
      response.status(exception.httpStatus).json({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
          requestId,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message);
      response.status(status).json({
        error: {
          code: CODE_BY_STATUS[status] ?? 'HTTP_ERROR',
          message: Array.isArray(message) ? message.join('; ') : message,
          requestId,
        },
      });
      return;
    }

    // 未预期异常：只返回 requestId，不泄露内部细节
    this.logger.error(
      `[${requestId}] 未处理异常: ${exception instanceof Error ? exception.message : String(exception)}`,
      exception instanceof Error ? exception.stack : undefined,
    );
    response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', requestId },
    });
  }
}
