import { describe, expect, it } from 'vitest';

import type { ToolPayload } from '../../domain/types/tool';
import { upsertToolSegments, appendReasoningChunk } from './streamSegments';
import type { StreamTurnSegment } from '../../stores/types';

function firstToolFromSegments(segments: StreamTurnSegment[]): ToolPayload | undefined {
  for (const seg of segments) {
    if (seg.kind === 'tool') return seg.tool;
    if (seg.kind === 'tools' && seg.tools[0]) return seg.tools[0];
  }
  return undefined;
}

function findToolInSegments(
  segments: StreamTurnSegment[],
  predicate: (tool: ToolPayload) => boolean,
): ToolPayload | undefined {
  for (const seg of segments) {
    if (seg.kind === 'tool' && predicate(seg.tool)) return seg.tool;
    if (seg.kind === 'tools') {
      const found = seg.tools.find(predicate);
      if (found) return found;
    }
  }
  return undefined;
}

describe('streamSegments linear flow', () => {
  it('keeps sequential tools in separate segments when separated by reasoning', () => {
    let segments: StreamTurnSegment[] = [];

    segments = appendReasoningChunk(segments, '先思考', { block: 1 });
    segments = upsertToolSegments(segments, [
      {
        id: 'tc-1',
        toolCallId: 'tc-1',
        identifier: 'skill',
        apiName: 'searchSkill',
        state: 'executing',
      },
    ], 1);
    segments = upsertToolSegments(segments, [
      {
        id: 'tc-1',
        toolCallId: 'tc-1',
        identifier: 'skill',
        apiName: 'searchSkill',
        state: 'success',
      },
    ], 1);
    segments = appendReasoningChunk(segments, '再思考', { block: 2 });
    segments = upsertToolSegments(segments, [
      {
        id: 'tc-2',
        toolCallId: 'tc-2',
        identifier: 'skill',
        apiName: 'readReference',
        state: 'executing',
      },
    ], 2);

    expect(segments.map((segment) => segment.kind)).toEqual([
      'reasoning',
      'tool',
      'reasoning',
      'tool',
    ]);
    expect(segments[1]?.kind === 'tool' ? segments[1].tool.apiName : '').toBe('searchSkill');
    expect(segments[3]?.kind === 'tool' ? segments[3].tool.apiName : '').toBe('readReference');
  });

  it('groups parallel executing tools into one tools segment', () => {
    let segments: StreamTurnSegment[] = [];

    segments = upsertToolSegments(segments, [
      {
        id: 'tc-1',
        toolCallId: 'tc-1',
        identifier: 'a',
        apiName: 'a',
        state: 'executing',
      },
    ], 1);
    segments = upsertToolSegments(segments, [
      {
        id: 'tc-2',
        toolCallId: 'tc-2',
        identifier: 'b',
        apiName: 'b',
        state: 'executing',
      },
    ], 1);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.kind).toBe('tools');
    if (segments[0]?.kind === 'tools') {
      expect(segments[0].tools).toHaveLength(2);
    }
  });

  it('drops identity-less orphan tools instead of showing plugin › api', () => {
    let segments: StreamTurnSegment[] = [];

    segments = upsertToolSegments(segments, [
      {
        id: 'call_real',
        toolCallId: 'call_real',
        identifier: 'linkloom-skill-store',
        apiName: 'searchSkill',
        plugin: 'linkloom-skill-store',
        state: 'executing',
      },
    ], 1);
    segments = upsertToolSegments(
      segments,
      [{ id: 'evt_orphan', toolCallId: 'evt_orphan', state: 'executing' }],
      1,
    );

    expect(segments).toHaveLength(1);
    expect(segments[0]?.kind).toBe('tool');
  });

  it('does not duplicate a tool when tool_started would use a different event id', () => {
    let segments: StreamTurnSegment[] = [];

    segments = upsertToolSegments(segments, [
      {
        id: 'call_real',
        toolCallId: 'call_real',
        identifier: 'linkloom-skill-store',
        apiName: 'searchSkill',
        plugin: 'linkloom-skill-store',
        state: 'executing',
        arguments: { limit: 50 },
      },
    ], 1);
    segments = upsertToolSegments(
      segments,
      [
        {
          id: 'evt_started_uuid',
          toolCallId: 'evt_started_uuid',
          identifier: 'linkloom-skill-store',
          apiName: 'searchSkill',
          plugin: 'linkloom-skill-store',
          state: 'executing',
        },
      ],
      1,
    );
    segments = upsertToolSegments(
      segments,
      [{ id: 'call_real', toolCallId: 'call_real', state: 'success', duration: '1.0s' }],
      1,
    );

    expect(segments).toHaveLength(1);
    const tool = firstToolFromSegments(segments);
    expect(tool?.toolCallId).toBe('call_real');
    expect(tool?.state).toBe('success');
  });

  it('preserves tool identity when a partial update omits identifier fields', () => {
    let segments: StreamTurnSegment[] = [];
    segments = upsertToolSegments(
      segments,
      [
        {
          id: 'tc-1',
          toolCallId: 'tc-1',
          identifier: 'linkloom-skill-store',
          apiName: 'searchSkill',
          plugin: 'linkloom-skill-store',
          state: 'executing',
          arguments: { q: 'daily' },
        },
      ],
      1,
    );
    segments = upsertToolSegments(
      segments,
      [{ id: 'tc-1', toolCallId: 'tc-1', state: 'success', duration: '1.4s' }],
      1,
    );
    const toolSeg = segments.find((segment) => segment.kind === 'tool');
    expect(toolSeg?.kind === 'tool' ? toolSeg.tool.apiName : undefined).toBe('searchSkill');
    expect(toolSeg?.kind === 'tool' ? toolSeg.tool.duration : undefined).toBe('1.4s');
  });

  it('merges permission_required into the in-flight tool call without replacing toolCallId', () => {
    let segments: StreamTurnSegment[] = [];

    segments = upsertToolSegments(segments, [
      {
        id: 'call_wsM0',
        toolCallId: 'call_wsM0',
        identifier: 'linkloom-local-system',
        apiName: 'runCommand',
        plugin: 'linkloom-local-system',
        state: 'executing',
        arguments: { command: 'ls' },
      },
    ], 1);
    segments = upsertToolSegments(segments, [
      {
        permissionId: 'perm-exec-1',
        id: 'perm-exec-1',
        toolCallId: 'perm-exec-1',
        identifier: 'linkloom-local-system',
        apiName: 'runCommand',
        plugin: 'linkloom-local-system',
        state: 'executing',
        intervention: { status: 'pending' },
        arguments: { command: 'ls' },
        customTitle: '等待批准：execute_command',
      },
    ], 1);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.kind).toBe('tools');
    if (segments[0]?.kind === 'tools') {
      expect(segments[0].tools).toHaveLength(2);
      expect(segments[0].tools[0]?.toolCallId).toBe('call_wsM0');
      expect(segments[0].tools[1]?.permissionId).toBe('perm-exec-1');
      expect(segments[0].tools[1]?.intervention).toEqual({ status: 'pending' });
    }
  });

  it('inserts late pre-tool reasoning before the trailing tool when block is 1', () => {
    let segments: StreamTurnSegment[] = [];

    segments = upsertToolSegments(segments, [
      {
        id: 'call_ls',
        toolCallId: 'call_ls',
        identifier: 'linkloom-local-system',
        apiName: 'runCommand',
        state: 'success',
      },
    ], 1);

    segments = appendReasoningChunk(segments, 'Done. Let me verify the directory is clean.', {
      block: 1,
    });

    expect(segments.map((segment) => segment.kind)).toEqual(['reasoning', 'tool']);
    if (segments[0]?.kind === 'reasoning') {
      expect(segments[0].block.text).toContain('verify the directory');
    }
  });

  it('settles abandoned in-flight tools when a new sequential tool starts', () => {
    let segments: StreamTurnSegment[] = [];

    segments = upsertToolSegments(segments, [
      {
        id: 'call_write',
        toolCallId: 'call_write',
        identifier: 'linkloom-local-system',
        apiName: 'writeFile',
        state: 'executing',
        intervention: { status: 'resolved' },
      },
    ], 1);
    segments = appendReasoningChunk(segments, '改用 shell', { block: 1 });
    expect(findToolInSegments(segments, (t) => t.toolCallId === 'call_write')?.state).toBe(
      'executing',
    );
    segments = upsertToolSegments(segments, [
      {
        id: 'call_cmd',
        toolCallId: 'call_cmd',
        identifier: 'linkloom-local-system',
        apiName: 'runCommand',
        state: 'executing',
      },
    ], 2);

    expect(findToolInSegments(segments, (t) => t.toolCallId === 'call_write')?.state).toBe(
      'executing',
    );
    expect(findToolInSegments(segments, (t) => t.toolCallId === 'call_cmd')?.state).toBe(
      'executing',
    );
  });

  it('keeps success when abandoned tool already has result output', () => {
    let segments: StreamTurnSegment[] = [];

    segments = upsertToolSegments(segments, [
      {
        id: 'call_cmd_1',
        toolCallId: 'call_cmd_1',
        identifier: 'linkloom-local-system',
        apiName: 'runCommand',
        state: 'executing',
        intervention: { status: 'resolved' },
        resultText: 'ok',
      },
    ], 1);
    segments = upsertToolSegments(segments, [
      {
        id: 'call_cmd_2',
        toolCallId: 'call_cmd_2',
        identifier: 'linkloom-local-system',
        apiName: 'runCommand',
        state: 'executing',
      },
    ], 2);

    const tool = findToolInSegments(segments, (t) => t.toolCallId === 'call_cmd_1');
    expect(tool?.state).toBe('executing');
    expect(tool?.resultText).toBe('ok');
  });

  it('keeps parallel readFile tools executing when bundling into one workflow group', () => {
    let segments: StreamTurnSegment[] = [];

    segments = upsertToolSegments(segments, [
      {
        id: 'call_read_1',
        toolCallId: 'call_read_1',
        identifier: 'linkloom-local-system',
        apiName: 'readFile',
        plugin: 'linkloom-local-system',
        state: 'executing',
      },
    ], 1);
    segments = upsertToolSegments(segments, [
      {
        id: 'call_read_2',
        toolCallId: 'call_read_2',
        identifier: 'linkloom-local-system',
        apiName: 'readFile',
        plugin: 'linkloom-local-system',
        state: 'executing',
      },
    ], 1);
    segments = upsertToolSegments(segments, [
      {
        id: 'call_read_3',
        toolCallId: 'call_read_3',
        identifier: 'linkloom-local-system',
        apiName: 'readFile',
        plugin: 'linkloom-local-system',
        state: 'executing',
      },
    ], 1);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.kind).toBe('tools');
    if (segments[0]?.kind === 'tools') {
      expect(segments[0].tools.map((tool) => tool.state)).toEqual(['executing', 'executing', 'executing']);
    }
  });

  it('keeps approved runCommand executing when bundling a second runCommand', () => {
    let segments: StreamTurnSegment[] = [];

    segments = upsertToolSegments(segments, [
      {
        id: 'call_cmd_1',
        toolCallId: 'call_cmd_1',
        identifier: 'linkloom-local-system',
        apiName: 'runCommand',
        state: 'executing',
        intervention: { status: 'resolved' },
      },
    ], 1);
    segments = upsertToolSegments(segments, [
      {
        id: 'call_cmd_2',
        toolCallId: 'call_cmd_2',
        identifier: 'linkloom-local-system',
        apiName: 'runCommand',
        state: 'executing',
      },
    ], 2);

    expect(segments[0]?.kind).toBe('tools');
    if (segments[0]?.kind === 'tools') {
      expect(segments[0].tools[0]?.state).toBe('executing');
      expect(segments[0].tools[1]?.state).toBe('executing');
    }
  });

  it('keeps approved runCommand executing when a second runCommand round starts', () => {
    let segments: StreamTurnSegment[] = [];

    segments = upsertToolSegments(segments, [
      {
        id: 'call_cmd_1',
        toolCallId: 'call_cmd_1',
        identifier: 'linkloom-local-system',
        apiName: 'runCommand',
        state: 'executing',
        intervention: { status: 'resolved' },
      },
    ], 1);
    segments = upsertToolSegments(segments, [
      {
        id: 'call_cmd_2',
        toolCallId: 'call_cmd_2',
        identifier: 'linkloom-local-system',
        apiName: 'runCommand',
        state: 'executing',
      },
    ], 2);

    expect(segments[0]?.kind).toBe('tools');
    if (segments[0]?.kind === 'tools') {
      expect(segments[0].tools[0]?.state).toBe('executing');
      expect(segments[0].tools[1]?.state).toBe('executing');
    }
  });

  it('applies permission_required for a second runCommand while the first is still executing', () => {
    let segments: StreamTurnSegment[] = [];

    segments = upsertToolSegments(segments, [
      {
        id: 'call_cmd_1',
        toolCallId: 'call_cmd_1',
        identifier: 'linkloom-local-system',
        apiName: 'runCommand',
        state: 'executing',
        intervention: { status: 'resolved' },
      },
    ], 1);
    segments = upsertToolSegments(segments, [
      {
        id: 'call_cmd_2',
        toolCallId: 'call_cmd_2',
        identifier: 'linkloom-local-system',
        apiName: 'runCommand',
        state: 'pending',
        permissionId: 'perm_cmd_2',
        intervention: { status: 'pending' },
        arguments: { command: 'rm -rf /workspace/*' },
      },
    ], 2);

    expect(segments[0]?.kind).toBe('tools');
    if (segments[0]?.kind === 'tools') {
      expect(segments[0].tools[0]?.toolCallId).toBe('call_cmd_1');
      expect(segments[0].tools[0]?.state).toBe('executing');
      expect(segments[0].tools[1]?.toolCallId).toBe('call_cmd_2');
      expect(segments[0].tools[1]?.state).toBe('pending');
      expect(segments[0].tools[1]?.intervention).toEqual({ status: 'pending' });
    }
  });

  it('applies permission error after intervention was resolved', () => {
    let segments: StreamTurnSegment[] = [];

    segments = upsertToolSegments(segments, [
      {
        id: 'call_cmd',
        toolCallId: 'call_cmd',
        identifier: 'linkloom-local-system',
        apiName: 'runCommand',
        state: 'executing',
        intervention: { status: 'resolved' },
      },
    ], 1);
    segments = upsertToolSegments(segments, [
      {
        id: 'call_cmd',
        toolCallId: 'call_cmd',
        state: 'error',
        error: "Permission required for tool 'execute_command'",
      },
    ], 1);

    expect(segments[0]?.kind === 'tool' ? segments[0].tool.state : undefined).toBe('error');
  });

  it('overrides optimistic approval success when definitive tool result is error', () => {
    let segments: StreamTurnSegment[] = [];

    segments = upsertToolSegments(segments, [
      {
        id: 'call_write',
        toolCallId: 'call_write',
        identifier: 'linkloom-local-system',
        apiName: 'writeFile',
        state: 'success',
        customTitle: '已批准',
        intervention: { status: 'resolved' },
      },
    ], 1);
    segments = upsertToolSegments(
      segments,
      [
        {
          id: 'call_write',
          toolCallId: 'call_write',
          identifier: 'linkloom-local-system',
          apiName: 'writeFile',
          state: 'error',
          error: '502 Bad Gateway',
        },
      ],
      1,
    );

    const tool = segments[0]?.kind === 'tool' ? segments[0].tool : undefined;
    expect(tool?.state).toBe('error');
    expect(tool?.error).toContain('502');
  });

  it('keeps executing on orphan permission_resolved until definitive tool_finished', () => {
    let segments: StreamTurnSegment[] = [];

    segments = upsertToolSegments(segments, [
      {
        id: 'call_write',
        toolCallId: 'call_write',
        identifier: 'linkloom-local-system',
        apiName: 'writeFile',
        state: 'executing',
        intervention: { status: 'resolved' },
        arguments: { path: 'prime.py', content: 'print(1)' },
      },
    ], 1);
    segments = upsertToolSegments(
      segments,
      [
        {
          id: 'call_write',
          toolCallId: 'call_write',
          state: 'executing',
          intervention: { status: 'resolved' },
        },
      ],
      1,
    );

    const afterApproval = segments[0]?.kind === 'tool' ? segments[0].tool : undefined;
    expect(afterApproval?.state).toBe('executing');
    expect(afterApproval?.arguments).toEqual({ path: 'prime.py', content: 'print(1)' });

    segments = upsertToolSegments(
      segments,
      [
        {
          id: 'call_write',
          toolCallId: 'call_write',
          identifier: 'linkloom-local-system',
          apiName: 'writeFile',
          state: 'success',
          resultText: 'wrote prime.py',
        },
      ],
      1,
    );

    const afterFinish = segments[0]?.kind === 'tool' ? segments[0].tool : undefined;
    expect(afterFinish?.state).toBe('success');
    expect(afterFinish?.resultText).toBe('wrote prime.py');
  });

  it('keeps rejected state when definitive error tool_finished follows deny', () => {
    let segments: StreamTurnSegment[] = [];

    segments = upsertToolSegments(segments, [
      {
        id: 'call_cmd',
        toolCallId: 'call_cmd',
        identifier: 'linkloom-local-system',
        apiName: 'runCommand',
        state: 'rejected',
        intervention: { status: 'resolved' },
        rejectedReason: '用户拒绝了此工具调用',
        arguments: { command: 'ls' },
      },
    ], 1);
    segments = upsertToolSegments(
      segments,
      [
        {
          id: 'call_cmd',
          toolCallId: 'call_cmd',
          apiName: 'runCommand',
          state: 'error',
          error: "Permission denied for tool: 'execute_command'",
        },
      ],
      1,
    );

    const tool = segments[0]?.kind === 'tool' ? segments[0].tool : undefined;
    expect(tool?.state).toBe('rejected');
    expect(tool?.rejectedReason).toContain('拒绝');
  });

  it('clears transient 执行中 customTitle when tool_finished succeeds', () => {
    let segments: StreamTurnSegment[] = [];

    segments = upsertToolSegments(segments, [
      {
        id: 'call_cmd',
        toolCallId: 'call_cmd',
        identifier: 'linkloom-local-system',
        apiName: 'runCommand',
        plugin: 'linkloom-local-system',
        state: 'executing',
        intervention: { status: 'resolved' },
        customTitle: '执行中…',
        arguments: { command: 'python prime.py' },
      },
    ], 1);
    segments = upsertToolSegments(
      segments,
      [
        {
          id: 'call_cmd',
          toolCallId: 'call_cmd',
          apiName: 'runCommand',
          state: 'success',
          resultText: 'ok',
        },
      ],
      1,
    );

    const tool = segments[0]?.kind === 'tool' ? segments[0].tool : undefined;
    expect(tool?.state).toBe('success');
    expect(tool?.customTitle).toBeUndefined();
  });

  it('ignores orphan permission_resolved on terminal tools', () => {
    let segments: StreamTurnSegment[] = [];

    segments = upsertToolSegments(segments, [
      {
        id: 'call_write',
        toolCallId: 'call_write',
        identifier: 'linkloom-local-system',
        apiName: 'writeFile',
        state: 'error',
        error: 'Permission denied',
        intervention: { status: 'pending' },
      },
    ], 1);
    segments = upsertToolSegments(
      segments,
      [
        {
          id: 'call_write',
          toolCallId: 'call_write',
          state: 'executing',
          intervention: { status: 'resolved' },
        },
      ],
      1,
    );

    const tool = findToolInSegments(segments, (t) => t.toolCallId === 'call_write');
    expect(tool?.state).toBe('executing');
    expect(tool?.intervention).toEqual({ status: 'resolved' });
  });
});
