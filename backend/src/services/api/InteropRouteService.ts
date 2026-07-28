import crypto from 'crypto';
import type { IncomingHttpHeaders } from 'http';
import { AppError } from '../../domain/errors.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';

const VERIFY_PAGE_CSS = `
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; -webkit-font-smoothing: antialiased; }
    .card { background: white; padding: 2.5rem; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); text-align: center; max-width: 440px; width: 90%; border: 1px solid rgba(226, 232, 240, 0.8); }
    .icon-circle { width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; font-size: 2rem; }
    .icon-success { background: #ecfdf5; color: #10b981; }
    .icon-error { background: #fef2f2; color: #ef4444; }
    .icon-info { background: #eff6ff; color: #3b82f6; }
    h1 { font-size: 1.5rem; font-weight: 800; margin: 0 0 0.75rem; color: #0f172a; letter-spacing: -0.025em; }
    p { color: #64748b; line-height: 1.6; font-size: 0.95rem; margin: 0 0 1.5rem; }
    .btn { display: inline-flex; align-items: center; justify-content: center; width: 100%; padding: 0.875rem 1.5rem; font-size: 1rem; font-weight: 600; border-radius: 12px; border: none; cursor: pointer; transition: all 0.2s; text-decoration: none; box-sizing: border-box; }
    .btn-primary { background: #0cafcf; color: white; box-shadow: 0 4px 6px -1px rgba(12, 175, 207, 0.3); }
    .btn-primary:hover { background: #099bb8; transform: translateY(-1px); box-shadow: 0 10px 15px -3px rgba(12, 175, 207, 0.4); }
    .btn-secondary { background: #f1f5f9; color: #475569; }
    .btn-secondary:hover { background: #e2e8f0; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.25rem; text-align: left; margin-bottom: 2rem; font-size: 0.875rem; }
    .meta-item { display: flex; justify-content: space-between; margin-bottom: 0.75rem; }
    .meta-item:last-child { margin-bottom: 0; }
    .meta-label { color: #94a3b8; font-weight: 500; }
    .meta-value { color: #334155; font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .animate-success { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes scaleIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  </style>
`;

export class InteropRouteService {
  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {}

  async registerPendingKey(name: string | undefined, headers: IncomingHttpHeaders, ip: string) {
    const userAgent = headers['user-agent'] || 'unknown';
    const fingerprint = crypto.createHash('sha256').update(`${ip}-${userAgent}`).digest('hex');
    const result = await this.context.interopService.registerPendingKey(name || '', fingerprint);
    const host = headers.host || 'localhost';
    const protocol = (headers['x-forwarded-proto'] as string) || 'http';
    const fullVerificationUrl = `${protocol}://${host}${result.verificationUrl}`;

    return {
      status: 'pending',
      apiKey: result.key,
      verificationUrl: fullVerificationUrl,
      message:
        'Your API Key has been generated but is currently PENDING. A human must visit the verificationUrl to approve your access.'
    };
  }

  async renderVerifyPage(token: string) {
    const record = await this.store.getApiKeyByVerificationToken(token);
    if (!record) {
      return this.page(
        '验证失败',
        `
        <div class="card">
          <div class="icon-circle icon-error">❌</div>
          <h1>验证链接无效</h1>
          <p>该验证令牌不存在或已过期，请检查链接是否完整。</p>
          <a href="/" class="btn btn-secondary">返回首页</a>
        </div>
      `
      );
    }

    if (record.status === 'active') {
      return this.page(
        '权限已激活',
        `
        <div class="card">
          <div class="icon-circle icon-success animate-success">✅</div>
          <h1>权限已激活</h1>
          <p>该 API Key 已经是激活状态，无需重复验证。您可以直接开始使用，现在可以安全地关闭此页面。</p>
        </div>
      `
      );
    }

    return this.page(
      '确认接入申请',
      `
      <div class="card">
        <div class="icon-circle icon-info">🔑</div>
        <h1>确认 AI 接入申请</h1>
        <p>系统收到一个新的接入申请，请核对来源信息后手动批准。</p>
        <div class="meta-box">
          <div class="meta-item">
            <span class="meta-label">申请名称</span>
            <span class="meta-value">${record.name}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">来源指纹</span>
            <span class="meta-value">${record.prefix}...</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">申请时间</span>
            <span class="meta-value">${new Date(record.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</span>
          </div>
        </div>
        <form method="POST">
          <button type="submit" class="btn btn-primary">确认并批准接入</button>
        </form>
        <p style="margin-top: 1.5rem; font-size: 0.8rem; color: #94a3b8; margin-bottom: 0;">批准后，该 AI 系统将获得访问 API 接口的权限。</p>
      </div>
    `
    );
  }

  async approveKey(token: string) {
    const success = await this.context.interopService.approveKey(token);
    if (success) {
      return this.page(
        '验证成功',
        `
        <div class="card">
          <div class="icon-circle icon-success animate-success">✅</div>
          <h1>验证成功</h1>
          <p>该 AI 系统的访问权限已成功激活。</p>
        </div>
      `
      );
    }

    return this.page(
      '批准失败',
      `
      <div class="card">
        <div class="icon-circle icon-error">❌</div>
        <h1>批准失败</h1>
        <p>无法完成批准操作。这可能是由于网络原因或令牌已失效。</p>
        <button onclick="location.reload()" class="btn btn-primary">刷新重试</button>
      </div>
    `
    );
  }

  async updateSettings(settings: any) {
    await this.context.interopService.updateSettings(settings);
    await this.context.reload();
    return { status: 'success' };
  }

  async saveSchedule(schedule: any) {
    await this.context.interopService.saveSchedule(schedule);
    return { status: 'success' };
  }

  async deleteSchedule(id: string) {
    await this.context.interopService.deleteSchedule(id);
    return { status: 'success' };
  }

  async saveAgent(agent: any) {
    await this.context.interopService.saveAgent(agent);
    await this.context.reload();
    return { status: 'success' };
  }

  async deleteAgent(id: string) {
    await this.context.interopService.deleteAgent(id);
    await this.context.reload();
    return { status: 'success' };
  }

  async saveWorkflow(workflow: any) {
    await this.context.interopService.saveWorkflow(workflow);
    await this.context.reload();
    return { status: 'success' };
  }

  async deleteWorkflow(id: string) {
    await this.context.interopService.deleteWorkflow(id);
    await this.context.reload();
    return { status: 'success' };
  }

  assertStreamingAction(body: any) {
    if (body.action !== 'agent') {
      throw new AppError(400, 'Streaming is only supported for agent action');
    }
  }

  private page(title: string, body: string) {
    return `
      <html>
        <head><meta charset="UTF-8"><title>${title}</title>${VERIFY_PAGE_CSS}</head>
        <body>${body}</body>
      </html>
    `;
  }
}
