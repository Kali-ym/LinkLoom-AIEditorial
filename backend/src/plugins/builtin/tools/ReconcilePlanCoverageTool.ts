import { reconcileEditorialPlanCoverage } from '../../../utils/editorialUtils.js';
import { parseJsonLenient } from '../../../utils/helpers.js';
import { BaseTool } from '../../base/BaseTool.js';

function parseMaybeJson<T = unknown>(value: unknown): T {
  if (typeof value === 'string') return parseJsonLenient(value);
  return value as T;
}

export class ReconcilePlanCoverageTool extends BaseTool {
  readonly id = 'reconcile_plan_coverage';
  readonly name = 'reconcile_plan_coverage';
  readonly displayName = '策划补全';
  readonly scope = 'workflow' as const;
  readonly description =
    '校验并补全结构化策划方案，确保覆盖所有输入素材条目。日报策划工作流中 plan 生成后调用。' +
    '必填：plan（对象或 JSON 字符串）；可选 inputItems/items、routeItems、materialItems、dedupLog。';
  readonly parameters = {
    type: 'object',
    properties: {
      plan: { description: 'Plan object or JSON string' },
      inputItems: { type: 'array', description: 'Source input items' },
      items: { type: 'array', description: 'Alias for inputItems' },
      sourceItems: { type: 'array' },
      routeItems: { type: 'array', description: 'Per-item routing results keyed by index' },
      materialItems: {
        type: 'array',
        description: 'Per-item material brief results keyed by index'
      },
      dedupLog: { type: 'object' }
    },
    required: ['plan']
  };

  async handler(args: {
    plan: unknown;
    inputItems?: Record<string, unknown>[];
    items?: Record<string, unknown>[];
    sourceItems?: Record<string, unknown>[];
    routeItems?: Record<string, unknown>[];
    materialItems?: Record<string, unknown>[];
    dedupLog?: Record<string, unknown>;
  }) {
    const plan = parseMaybeJson<any>(args.plan);
    const items = args.inputItems || args.items || args.sourceItems || [];
    const reconciled = reconcileEditorialPlanCoverage(plan, Array.isArray(items) ? items : [], {
      routeItems: Array.isArray(args.routeItems) ? args.routeItems : [],
      materialItems: Array.isArray(args.materialItems) ? args.materialItems : []
    });
    if (args.dedupLog) {
      reconciled.editorial_log = {
        ...(reconciled.editorial_log || {}),
        dedup_log: args.dedupLog
      } as any;
    }
    return {
      success: true,
      content: JSON.stringify(reconciled),
      plan: reconciled
    };
  }
}
