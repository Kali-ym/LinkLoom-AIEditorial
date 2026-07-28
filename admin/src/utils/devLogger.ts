/**
 * 管理端日志：生产构建中仍输出 warn/error（便于排障）；log/info/debug 仅在 Vite 开发模式写入控制台。
 */
const IS_DEV = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

type LogArgs = Parameters<typeof console.log>;

export const devLogger = {
  log: (...args: LogArgs) => {
    if (IS_DEV) console.log(...args);
  },
  info: (...args: LogArgs) => {
    if (IS_DEV) console.info(...args);
  },
  warn: (...args: LogArgs) => {
    console.warn(...args);
  },
  error: (...args: LogArgs) => {
    console.error(...args);
  },
  debug: (...args: LogArgs) => {
    if (IS_DEV) console.debug(...args);
  }
};
