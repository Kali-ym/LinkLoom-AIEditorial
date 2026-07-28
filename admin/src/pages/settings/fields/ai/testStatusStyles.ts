import type { ProviderTestResult } from './aiProviderUtils';

export function getTestStatusStyles(isTesting: boolean, testResult?: ProviderTestResult) {
  if (isTesting || testResult?.status === 'testing') {
    return {
      box: 'border-amber-200/80 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/5',
      text: 'text-amber-800 dark:text-amber-200'
    };
  }
  if (testResult?.status === 'healthy') {
    return {
      box: 'border-teal-200/80 bg-teal-light/40 dark:border-emerald-500/20 dark:bg-emerald-500/5',
      text: 'text-moss-dark dark:text-emerald-300'
    };
  }
  if (testResult?.status === 'error') {
    return {
      box: 'border-coral-light bg-coral-light/30 dark:border-red-500/20 dark:bg-red-500/5',
      text: 'text-coral-dark dark:text-red-300'
    };
  }
  return {
    box: 'border-hairline-soft bg-surface-soft/60 dark:border-white/5 dark:bg-white/[0.02]',
    text: 'text-text-slate dark:text-text-secondary'
  };
}

export function getTestStatusLabel(isTesting: boolean, testResult?: ProviderTestResult): string {
  if (isTesting || testResult?.status === 'testing') return '测试中...';
  if (testResult?.status === 'healthy') return testResult.message || 'AI 服务连接正常';
  if (testResult?.status === 'error') return testResult.message || '连接失败';
  return '尚未测试';
}
