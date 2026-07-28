import type { ServiceContext } from '../ServiceContext.js';
import { verifyPassword } from '../settingsSecurity.js';

/**
 * 鉴权服务。
 *
 * 之前 `authRoutes.ts` 把口令比对与 JWT 签发逻辑直接内联在 route handler 里，
 * 抽出 `AuthService` 后：
 * - 路由只负责拿请求体、调用本服务、返回响应；
 * - 默认口令、过期时间等策略集中到一处便于审计；
 * - JWT 签发依赖通过函数参数注入，避免与 fastify 实例耦合。
 */
export class AuthService {
  constructor(private context: ServiceContext) {}

  verifyPassword(password: string): boolean {
    const currentPassword = this.context.settings.SYSTEM_PASSWORD || 'admin123';
    return verifyPassword(password, currentPassword);
  }

  /**
   * 校验口令并签发 admin JWT。失败返回 null（由调用方决定响应 status code）。
   */
  signAdminToken(
    password: string,
    sign: (payload: Record<string, unknown>, options?: { expiresIn: string }) => string
  ): string | null {
    if (!this.verifyPassword(password)) return null;
    const expiresIn = this.context.settings.AUTH_EXPIRE_TIME || '7d';
    return sign({ role: 'admin' }, { expiresIn });
  }
}
