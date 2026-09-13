import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { EnvelopeInterceptor } from './common/envelope.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // 统一前缀 /api/v1（docs/技术设计文档.md §9.1）
  app.setGlobalPrefix('api/v1');

  // 请求 ID：贯穿日志与错误响应，便于排查
  app.use((req: Request & { requestId?: string }, _res: Response, next: NextFunction) => {
    req.requestId = randomUUID();
    next();
  });

  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // MVP：允许本地前端（5180）跨域访问；生产应配置白名单
  app.enableCors({ origin: true });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '127.0.0.1');
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://127.0.0.1:${port}/api/v1`);
}

void bootstrap();
