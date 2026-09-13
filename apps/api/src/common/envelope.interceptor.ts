import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { map, type Observable } from 'rxjs';

/** 成功响应统一包络：{ data, meta: { requestId } }（§9.1） */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { requestId?: string }>();
    return next.handle().pipe(
      map((data: unknown) => ({
        data: data ?? null,
        meta: { requestId: request.requestId ?? 'unknown' },
      })),
    );
  }
}
