/**
 * 领域异常：业务错误一律用本类抛出，由 AllExceptionsFilter 统一转成错误包络。
 * 错误码全集见 docs/技术设计文档.md §9.1。
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const notFound = (code: string, message: string): DomainError =>
  new DomainError(code, message, 404);

export const conflict = (code: string, message: string, details?: unknown): DomainError =>
  new DomainError(code, message, 409, details);

export const badRequest = (code: string, message: string, details?: unknown): DomainError =>
  new DomainError(code, message, 400, details);

export const unprocessable = (code: string, message: string, details?: unknown): DomainError =>
  new DomainError(code, message, 422, details);
