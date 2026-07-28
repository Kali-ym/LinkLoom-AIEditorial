import React, { useState, useEffect, useCallback } from 'react';
import { agentService } from '../../../../../services/agentService';
import { getOpsErrorMessage, OpsErrorBanner } from '../../../opsUiPrimitives';
import { useOpsConfirm } from '../../../useOpsConfirm';
import type { Agent, RegressionRunRecord, RegressionSample } from '../../../../../services/agentService';
import { RegressionManagePanel } from './RegressionManagePanel';
import { RegressionSummary } from './RegressionSummary';

interface RegressionTabProps {
  agents: Agent[];
}

export const RegressionTab: React.FC<RegressionTabProps> = ({ agents }) => {
  const { confirm } = useOpsConfirm();
  const [samples, setSamples] = useState<RegressionSample[]>([]);
  const [runs, setRuns] = useState<RegressionRunRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [expected, setExpected] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [runningSampleIds, setRunningSampleIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextSamples, nextRuns] = await Promise.all([
        agentService.listRegressionSamples(),
        agentService.listRegressionRuns(20)
      ]);
      setSamples(nextSamples);
      setRuns(nextRuns);
      if (!agentId && nextSamples[0]?.agentId) setAgentId(nextSamples[0].agentId);
      else if (!agentId && agents[0]?.id) setAgentId(agents[0].id);
      setError(null);
    } catch (err) {
      setError(getOpsErrorMessage(err, '无法加载回归样本'));
    }
  }, [agentId, agents]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setName('');
    setPrompt('');
    setExpected('');
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!name.trim() || !agentId || !prompt.trim()) return;
    setBusy(true);
    try {
      if (editingId) {
        await agentService.saveRegressionSample({
          id: editingId,
          name: name.trim(),
          agentId,
          prompt: prompt.trim(),
          expectedContains: expected
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
        });
      } else {
        await agentService.saveRegressionSample({
          name: name.trim(),
          agentId,
          prompt: prompt.trim(),
          expectedContains: expected
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
        });
      }
      resetForm();
      await load();
    } catch (err) {
      setActionError(getOpsErrorMessage(err, '保存回归样本失败'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (sample: RegressionSample) => {
    const ok = await confirm({
      title: '删除回归样本',
      message: `确定删除「${sample.name}」？删除后无法恢复。`,
      confirmLabel: '删除',
      tone: 'danger'
    });
    if (!ok) return;
    setBusy(true);
    try {
      await agentService.deleteRegressionSample(sample.id);
      await load();
    } catch (err) {
      setActionError(getOpsErrorMessage(err, '删除失败'));
    } finally {
      setBusy(false);
    }
  };

  const handleRunSingle = async (sample: RegressionSample) => {
    const ok = await confirm({
      title: `运行「${sample.name}」`,
      message: `将使用 ${agents.find((a) => a.id === sample.agentId)?.name || sample.agentId} 执行此样本的 prompt。`,
      confirmLabel: '运行'
    });
    if (!ok) return;
    setRunningSampleIds((prev) => new Set([...prev, sample.id]));
    try {
      await agentService.runRegressionSamples([sample.id]);
      await load();
    } catch (err) {
      setActionError(getOpsErrorMessage(err, '运行失败'));
    } finally {
      setRunningSampleIds((prev) => {
        const next = new Set(prev);
        next.delete(sample.id);
        return next;
      });
    }
  };

  const handleEdit = (sample: RegressionSample) => {
    setEditingId(sample.id);
    setName(sample.name);
    setAgentId(sample.agentId);
    setPrompt(sample.prompt);
    setExpected((sample.expectedContains ?? []).join('\n'));
  };

  const runAll = async () => {
    const agentIds = [...new Set(samples.map((sample) => sample.agentId).filter(Boolean))];
    const agentSummary =
      agentIds.length === 0
        ? '多个智能体'
        : agentIds
            .map((id) => agents.find((agent) => agent.id === id)?.name || id)
            .join('、');
    const ok = await confirm({
      title: '运行全部回归样本',
      message: `将批量运行 ${samples.length} 个样本（涉及：${agentSummary}），可能产生较多模型调用。`,
      confirmLabel: '开始运行'
    });
    if (!ok) return;

    setBusy(true);
    setActionError(null);
    try {
      await agentService.runRegressionSamples();
      await load();
    } catch (err) {
      setActionError(getOpsErrorMessage(err, '运行回归样本失败'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <OpsErrorBanner message={error} onRetry={load} />}
      {actionError && (
        <OpsErrorBanner message={actionError} onRetry={() => setActionError(null)} retryLabel="关闭" />
      )}

      <RegressionSummary
        agents={agents}
        samples={samples}
        runs={runs}
        busy={busy}
        runningSampleIds={runningSampleIds}
        onRunAll={runAll}
        onRunSingle={handleRunSingle}
      />

      <RegressionManagePanel
        agents={agents}
        samples={samples}
        runs={runs}
        busy={busy}
        name={name}
        agentId={agentId}
        prompt={prompt}
        expected={expected}
        editingId={editingId}
        runningSampleIds={runningSampleIds}
        onNameChange={setName}
        onAgentIdChange={setAgentId}
        onPromptChange={setPrompt}
        onExpectedChange={setExpected}
        onSave={handleSave}
        onResetForm={resetForm}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRunSingle={handleRunSingle}
      />
    </div>
  );
};
