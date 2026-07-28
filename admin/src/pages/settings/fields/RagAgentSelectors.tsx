import React from 'react';

export type RagAgentOption = {
  id: string;
  name: string;
  model?: string;
  providerId?: string;
};

type Props = {
  ragConfig: Record<string, unknown>;
  agents: RagAgentOption[];
  onPatch: (patch: Record<string, unknown>) => void;
  synthesisStatus?: {
    configured?: boolean;
    found?: boolean;
    name?: string;
  };
  plannerStatus?: {
    configured?: boolean;
    found?: boolean;
    name?: string;
  };
};

function formatAgentLabel(agent: RagAgentOption): string {
  const model = agent.model ? ` · ${agent.model}` : '';
  return `${agent.name || agent.id} (${agent.id})${model}`;
}

export const RagAgentSelectors: React.FC<Props> = ({
  ragConfig,
  agents,
  onPatch,
  synthesisStatus,
  plannerStatus
}) => {
  const synthesisValue = String(ragConfig.synthesisAgentId || '');
  const plannerValue = String(ragConfig.plannerAgentId || '');

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-2">
        <label className="space-y-1 text-xs text-text-slate dark:text-text-secondary">
          <span>Synthesis Agent</span>
          <select
            className="w-full rounded-xl border border-hairline-soft bg-canvas px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            value={synthesisValue}
            onChange={(event) => onPatch({ synthesisAgentId: event.target.value })}
          >
            <option value="">未配置（仅返回检索片段）</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {formatAgentLabel(agent)}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-text-stone">
            答案合成与文档摘要；需选用已配置提供商/模型的智能体。
          </p>
          {synthesisStatus?.configured && !synthesisStatus.found && (
            <p className="text-[11px] text-amber-700 dark:text-amber-200">
              已保存的智能体不存在，请重新选择。
            </p>
          )}
        </label>

        <label className="space-y-1 text-xs text-text-slate dark:text-text-secondary">
          <span>Planner Agent</span>
          <select
            className="w-full rounded-xl border border-hairline-soft bg-canvas px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            value={plannerValue}
            onChange={(event) => onPatch({ plannerAgentId: event.target.value })}
          >
            <option value="">复用 Synthesis Agent</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {formatAgentLabel(agent)}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-text-stone">
            仅在开启 Query Planner 时使用；留空则与 Synthesis Agent 相同。
          </p>
          {plannerStatus?.configured && !plannerStatus.found && (
            <p className="text-[11px] text-amber-700 dark:text-amber-200">
              已保存的 Planner 智能体不存在，请重新选择。
            </p>
          )}
        </label>
      </div>
    </div>
  );
};
