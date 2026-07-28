import { describe, expect, it } from 'vitest';
import {
  mergeWorkflowRuntimeOptions,
  previewWorkflowToolPermission,
  shouldGateWorkflowTool
} from '../src/services/agents/WorkflowStepApproval.js';

describe('workflow step approval gate', () => {
  it('requires approval for publish tools', () => {
    const preview = previewWorkflowToolPermission('publish_to_wechat');
    expect(preview.effect).toBe('ask');
    expect(shouldGateWorkflowTool('publish_to_wechat')).toBe(true);
  });

  it('requires approval for daily report assembly tool', () => {
    const preview = previewWorkflowToolPermission('build_daily_report_json');
    expect(preview.effect).toBe('ask');
    expect(shouldGateWorkflowTool('build_daily_report_json')).toBe(true);
  });

  it('allows read-only query tools', () => {
    const preview = previewWorkflowToolPermission('query_knowledge');
    expect(preview.effect).toBe('allow');
    expect(shouldGateWorkflowTool('query_knowledge')).toBe(false);
  });

  it('skips gate when workflow runtime skips approval', () => {
    expect(shouldGateWorkflowTool('build_daily_report_json', { skipWorkflowApproval: true })).toBe(
      false
    );
  });

  it('defaults workflow runtime to skip tool approval gates', () => {
    expect(mergeWorkflowRuntimeOptions({}).skipWorkflowApproval).toBe(true);
    expect(mergeWorkflowRuntimeOptions({ workflowRunId: 'wr_1' }).skipWorkflowApproval).toBe(true);
    expect(mergeWorkflowRuntimeOptions({ skipWorkflowApproval: false }).skipWorkflowApproval).toBe(
      false
    );
  });

  it('requires approval for kv-write publish keys', () => {
    const preview = previewWorkflowToolPermission('kv-write');
    expect(preview.effect).toBe('ask');
    expect(shouldGateWorkflowTool('kv-write')).toBe(true);
  });
});
