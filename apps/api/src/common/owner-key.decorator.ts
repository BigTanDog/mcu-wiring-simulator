import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * 匿名项目标识（MVP 无账号体系）：
 * 取自 `X-Owner-Key` 请求头，缺失时回退 `anonymous`。
 * 所有项目读写都带该键做数据隔离（§13.1 越权缓解）。
 */
export const OwnerKey = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const header = request.header('x-owner-key');
  return header && header.trim().length > 0 ? header.trim() : 'anonymous';
});
