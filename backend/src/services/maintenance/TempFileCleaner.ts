import fs from 'fs';
import os from 'os';
import path from 'path';
import { LogService } from '../LogService.js';

const TEMP_PREFIXES = ['ai_cover_', 'wechat_upload_', 'wechat-video-'];

/**
 * 清理系统临时目录中由本应用生成的过期文件。
 * 之前嵌在 TaskService 内，独立到这里便于复用与单测。
 *
 * @param maxAgeMs 超过此时间的文件将被清理，默认 24 小时
 */
export async function cleanupAppTempFiles(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
  const tempDir = os.tmpdir();
  try {
    const files = await fs.promises.readdir(tempDir);
    const now = Date.now();
    let count = 0;

    for (const file of files) {
      if (!TEMP_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;
      const filePath = path.join(tempDir, file);
      try {
        const stats = await fs.promises.stat(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          await fs.promises.rm(filePath, { recursive: true, force: true });
          count++;
        }
      } catch {
        // 忽略：文件可能被其他进程删除或权限问题
      }
    }

    if (count > 0) {
      LogService.info(`Cleaned up ${count} expired temp files/dirs from ${tempDir}`);
    }
    return count;
  } catch (err: any) {
    LogService.warn(`Failed to scan temp directory for cleanup: ${err.message}`);
    return 0;
  }
}
