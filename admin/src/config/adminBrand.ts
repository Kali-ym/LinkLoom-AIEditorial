import type { AdminUiLang } from '../utils/adminUiLocale';

export function adminDocumentTitle(lang: AdminUiLang): string {
  return lang === 'en' ? 'Linkloom · Admin' : 'Linkloom 链织 · 管理后台';
}

export function adminBrand(lang: AdminUiLang) {
  if (lang === 'en') {
    return {
      productTitle: 'Linkloom',
      tagline: 'Weave the open web into daily briefs.',
      copyrightFooter: '© 2026 Linkloom · Admin',
      loadingSelection: 'Gathering sources…',
      peerDeployHint:
        'These API keys authorize trusted systems — including a separately hosted Agent Console — to access this Linkloom instance (ingestion, tasks, skills, and console APIs). Revoking immediately removes all access.',
    };
  }
  return {
    productTitle: 'Linkloom 链织',
    tagline: '织汇全网资讯，凝练每日简报',
    copyrightFooter: '© 2026 Linkloom 链织 · 管理后台',
    loadingSelection: '正在织汇资讯，请稍候…',
    peerDeployHint:
      '这里的 API Key 供受信任的外部系统使用，也包括独立部署的 Agent Console：用实例地址 + Key 即可连接本机，访问数据抓取、任务、技能与控制台能力。撤销后对方将立即失去所有访问权限。',
  };
}

export function loginStrings(lang: AdminUiLang) {
  if (lang === 'en') {
    return {
      subtitle: 'Enter the access password to continue',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Enter password',
      submit: 'Sign in',
      errorLoginFailed: 'Login failed, try again',
      errorBadPassword: 'Wrong password',
      errorNetwork: 'Could not reach server',
    };
  }
  return {
    subtitle: '请输入访问密码以继续',
    passwordLabel: '访问密码',
    passwordPlaceholder: '请输入密码',
    submit: '进入系统',
    errorLoginFailed: '登录失败，请重试',
    errorBadPassword: '密码错误',
    errorNetwork: '连接服务器失败',
  };
}
