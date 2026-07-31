import {
  requireToolContext,
  type ToolExecutionContext
} from '../../../../services/ToolExecutionContext.js';
import type { ToolExecutionPolicy } from '../../../../types/agent.js';
import type { HotMergeMode } from '../../../../types/config.js';
import { HotStoryMergeService } from '../../../../services/feed/HotStoryMergeService.js';
import { BaseTool } from '../../../base/BaseTool.js';

const MEDIUM: ToolExecutionPolicy = { readonly: false, riskLevel: 'medium' };

class RebuildHotSnapshotTool extends BaseTool {
  readonly id = 'rebuild_hot_snapshot';
  readonly name = 'rebuild_hot_snapshot';
  readonly displayName = '重建热搜快照';
  readonly scope = 'both' as const;
  readonly isBuiltin = true;
  readonly execution = MEDIUM;
  readonly description =
    '增量合并近窗已评分素材为事件团并物化 hot_event_snapshot：' +
    '已有 evt_* 成员粘在原簇，仅将未分配条目匹配进簇或新建。' +
    '合并模式默认读 HOT_CONFIG；可选参数覆盖单次运行。' +
    '失败应返回 ok:false 而不抛错。';
  readonly parameters = {
    type: 'object',
    properties: {
      mergeMode: {
        type: 'string',
        enum: ['rules', 'semantic', 'hybrid', 'llm'],
        description: '覆盖 HOT_CONFIG.mergeMode'
      },
      embeddingServiceId: {
        type: 'string',
        description: '覆盖 HOT_CONFIG.embeddingServiceId；空字符串表示用全局 ACTIVE embedding'
      },
      similarityMin: {
        type: 'number',
        description: '覆盖 HOT_CONFIG.similarityMin（0.5～0.99）'
      },
      fullRebuild: {
        type: 'boolean',
        description: 'true 时清空近窗 evt_* 分配与簇指纹，从头全量合并（非增量）'
      }
    },
    additionalProperties: false
  };

  async handler(
    args: {
      mergeMode?: HotMergeMode;
      embeddingServiceId?: string;
      similarityMin?: number;
      fullRebuild?: boolean;
    },
    toolCtx?: ToolExecutionContext
  ) {
    const { store } = requireToolContext(toolCtx, this.id);
    try {
      const overrides = {
        mergeMode: args?.mergeMode,
        embeddingServiceId: args?.embeddingServiceId,
        similarityMin:
          typeof args?.similarityMin === 'number' && Number.isFinite(args.similarityMin)
            ? args.similarityMin
            : undefined,
        fullRebuild: args?.fullRebuild === true
      };
      const result = await new HotStoryMergeService(store).runMergeAndSnapshot(
        new Date(),
        overrides
      );
      return { ok: true, ...result };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        errorCode: 'REBUILD_HOT_SNAPSHOT_FAILED',
        message,
        hint: '可稍后手动 POST /api/feed/admin/hot/rebuild；热搜将保留上一份快照或降级现算'
      };
    }
  }
}

export const hotSnapshotTools: BaseTool[] = [new RebuildHotSnapshotTool()];
