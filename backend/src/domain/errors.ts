/**
 * 领域层错误基类。
 *
 * - `AppError` 表示「业务可预期的错误」，会被 HTTP 适配层映射为对应 status code。
 *   services / domain 代码应抛出这种错误而不是直接 `new Error()`，以便上层做语义化处理。
 * - `DomainError` 表示「违反领域不变量」的硬错误，对应 HTTP 422，不应包含 HTTP 细节。
 *
 * 该文件被特意放在 `domain/` 下，使 services 层无需反向依赖 `api/http.ts`。
 * HTTP 层负责把这些异常转换成 reply.send(...)（见 `api/http.ts#httpErrorHandler`）。
 */

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class DomainError extends AppError {
  constructor(message: string, code?: string) {
    super(422, message, code);
    this.name = 'DomainError';
  }
}
