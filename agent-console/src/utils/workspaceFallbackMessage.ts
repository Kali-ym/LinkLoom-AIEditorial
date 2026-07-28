export function formatWorkspaceFallbackToast(
  fallback: string,
  fallbackReason?: string,
): string {
  const reason = fallbackReason?.trim();
  switch (fallback) {
    case 'docker-unreachable':
      return reason
        ? `沙箱不可用（Docker 未就绪：${reason}），已回退到本机执行`
        : '沙箱不可用（Docker 未就绪），已回退到本机执行';
    case 'sandbox-pool-unconfigured':
      return '沙箱运行时未配置，已回退到本机执行';
    case 'docker-image-missing':
      return reason
        ? `沙箱镜像不可用（${reason}），已回退到本机执行`
        : '沙箱镜像不可用，已回退到本机执行';
    default:
      if (fallback.startsWith('docker-')) {
        return reason
          ? `沙箱启动失败（${reason}），已回退到本机执行`
          : '沙箱启动失败，已回退到本机执行';
      }
      return reason
        ? `沙箱不可用（${reason}），已回退到本机执行`
        : '沙箱不可用，已回退到本机执行';
  }
}
