import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Agent, Workflow } from '../../../services/agentService';
import { RunsListTab } from './RunsListTab';
import { WorkflowRunsSection } from './WorkflowRunsSection';

type RunsView = 'agents' | 'workflows';

interface RunsTabProps {
  agents: Agent[];
  workflows: Workflow[];
  onSelectRun?: (run: import('../../../services/agentService').AgentRun) => void;
  initialQuickFilter?: 'all' | 'active' | 'pendingPermission' | 'failed' | 'paused';
  initialAgentFilter?: string;
}

export const RunsTab: React.FC<RunsTabProps> = ({
  agents,
  workflows,
  onSelectRun,
  initialQuickFilter,
  initialAgentFilter
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const view: RunsView = searchParams.get('runsView') === 'workflows' ? 'workflows' : 'agents';

  const views = useMemo(
    () => [
      { id: 'agents' as const, label: '智能体运行' },
      { id: 'workflows' as const, label: '工作流编排' }
    ],
    []
  );

  const setView = (next: RunsView) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'runs');
    if (next === 'agents') params.delete('runsView');
    else params.set('runsView', next);
    setSearchParams(params, { replace: true });
  };

  const clearUrlFilters = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('agentId');
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {views.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              view === item.id
                ? 'bg-ink text-white dark:bg-white dark:text-ink'
                : 'bg-surface-soft text-text-charcoal hover:text-ink dark:bg-white/[0.04] dark:text-text-secondary dark:hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {view === 'agents' ? (
        <RunsListTab
          agents={agents}
          onSelectRun={onSelectRun}
          initialQuickFilter={initialQuickFilter}
          initialAgentFilter={initialAgentFilter}
          onClearUrlFilters={clearUrlFilters}
        />
      ) : (
        <WorkflowRunsSection agents={agents} workflows={workflows} />
      )}
    </div>
  );
};
