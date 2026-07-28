import type { AgentMiddleware } from './AgentMiddleware.js';
import type { AgentRunOutput } from './AgentRunSpec.js';

const EXTERNAL_MARKERS = [
  /https?:\/\//i,
  /<html[\s>]/i,
  /ignore\s+(all\s+)?(previous|above)\s+instructions/i,
  /system\s*:\s*/i
];

const OUTPUT_RISK_PATTERNS = [
  /rm\s+-rf\s+\//i,
  /curl\s+.+\|\s*bash/i,
  /eval\s*\(/i
];

export function createPlatformGovernanceMiddleware(): AgentMiddleware {
  return {
    name: 'platform-governance',
    beforeModelCall: async (ctx) => {
      const hits = scanMessages(ctx.messages);
      if (hits.length === 0) return;
      ctx.metadata.externalContentGuard = {
        detected: true,
        hitCount: hits.length,
        samples: hits.slice(0, 3)
      };
      await ctx.emit({
        id: `${ctx.spec.runId}:governance:external_content`,
        type: 'custom',
        runId: ctx.spec.runId,
        sessionId: ctx.spec.sessionId,
        timestamp: new Date().toISOString(),
        payload: {
          name: 'external_content_marked',
          data: {
            hitCount: hits.length,
            message: '检测到外部/不可信内容特征，已标记供模型审慎处理'
          }
        }
      });
    },
    beforeFinish: async (ctx) => {
      const risks = scanOutput(ctx.output);
      if (risks.length === 0) return;
      ctx.metadata.outputValidation = {
        passed: false,
        risks
      };
      ctx.output.metadata = {
        ...ctx.output.metadata,
        governanceWarning: '输出包含高风险模式，请人工复核',
        governanceRisks: risks
      };
    }
  };
}

function scanMessages(messages: unknown[]): string[] {
  const hits: string[] = [];
  for (const message of messages) {
    const text = extractText(message);
    if (!text) continue;
    for (const pattern of EXTERNAL_MARKERS) {
      if (pattern.test(text)) {
        hits.push(pattern.source);
        break;
      }
    }
  }
  return hits;
}

function scanOutput(output: AgentRunOutput): string[] {
  const text = output.content || '';
  return OUTPUT_RISK_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

function extractText(message: unknown): string {
  if (!message || typeof message !== 'object') return '';
  const record = message as Record<string, unknown>;
  if (typeof record.content === 'string') return record.content;
  if (Array.isArray(record.content)) {
    return record.content
      .map((part) => {
        if (!part || typeof part !== 'object') return '';
        const item = part as Record<string, unknown>;
        return typeof item.text === 'string' ? item.text : '';
      })
      .join('\n');
  }
  return '';
}
