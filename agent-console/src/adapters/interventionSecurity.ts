const DANGEROUS_PATTERNS = [/rm\s+-rf/i, /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/];

export function checkSecurityBlacklist(args: Record<string, unknown>): {
  blocked: boolean;
  reason?: string;
} {
  const text = JSON.stringify(args);
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: '检测到高风险命令模式，已阻止自动执行。' };
    }
  }
  return { blocked: false };
}
