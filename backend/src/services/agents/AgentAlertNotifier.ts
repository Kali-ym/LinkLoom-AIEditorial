import { LogService } from '../LogService.js';
import type { AgentRunAlert } from './AgentRunObservability.js';

const DEDUP_TTL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

export interface AlertWebhookStatus {
  enabled: boolean;
  webhookUrl?: string;
  lastSentAt?: string;
  lastError?: string;
  lastSentCount?: number;
}

export class AgentAlertNotifier {
  private readonly sentAt = new Map<string, number>();
  private status: AlertWebhookStatus = { enabled: false };

  getStatus(): AlertWebhookStatus {
    return { ...this.status, webhookUrl: maskWebhookUrl(this.status.webhookUrl) };
  }

  async dispatch(alerts: AgentRunAlert[], webhookUrl?: string): Promise<void> {
    const url = (webhookUrl || '').trim();
    if (!url) {
      this.status = { enabled: false };
      return;
    }

    this.status = { ...this.status, enabled: true, webhookUrl: url };

    const deliverable = alerts.filter(
      (alert) => alert.severity === 'critical' || alert.severity === 'warning'
    );
    const fresh = deliverable.filter((alert) => !this.isRecentlySent(alert.id));
    if (fresh.length === 0) return;

    try {
      await postWebhook(url, {
        source: 'linkloom-agent-platform',
        sentAt: new Date().toISOString(),
        alertCount: fresh.length,
        alerts: fresh.map((alert) => ({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          runId: alert.runId,
          agentId: alert.agentId,
          createdAt: alert.createdAt,
          metadata: alert.metadata
        }))
      });

      const now = Date.now();
      for (const alert of fresh) {
        this.sentAt.set(alert.id, now);
      }
      this.status = {
        enabled: true,
        webhookUrl: url,
        lastSentAt: new Date().toISOString(),
        lastSentCount: fresh.length,
        lastError: undefined
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      LogService.warn(`AgentAlertNotifier webhook failed: ${message}`);
      this.status = {
        enabled: true,
        webhookUrl: url,
        lastSentAt: this.status.lastSentAt,
        lastSentCount: this.status.lastSentCount,
        lastError: message
      };
    }
  }

  private isRecentlySent(alertId: string): boolean {
    const sent = this.sentAt.get(alertId);
    if (!sent) return false;
    if (Date.now() - sent > DEDUP_TTL_MS) {
      this.sentAt.delete(alertId);
      return false;
    }
    return true;
  }
}

async function postWebhook(url: string, body: unknown): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Webhook responded ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

function maskWebhookUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/.(?=.{0,4}$)/g, '*')}`;
  } catch {
    return '***';
  }
}

export function resolveAlertWebhookUrl(settings?: Record<string, unknown>): string | undefined {
  const fromEnv = process.env.PLATFORM_ALERT_WEBHOOK_URL?.trim();
  if (fromEnv) return fromEnv;
  const fromSettings = settings?.PLATFORM_ALERT_WEBHOOK_URL;
  return typeof fromSettings === 'string' && fromSettings.trim() ? fromSettings.trim() : undefined;
}
