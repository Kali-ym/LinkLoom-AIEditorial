import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { WriteWorkspaceFileTool } from '../src/plugins/builtin/tools/WriteWorkspaceFileTool.js';
import {
  createPlatformPermissionPolicy,
  inferActionKind,
  previewPermissionEffect,
} from '../src/services/agents/engine/PermissionEngine.js';

describe('workspace file tool HITL', () => {
  it('infers write action kind for write_workspace_file', () => {
    expect(inferActionKind('write_workspace_file')).toBe('write');
    expect(inferActionKind('read_workspace_file')).toBe('read');
    expect(inferActionKind('edit_workspace_file')).toBe('write');
  });

  it('requires human approval for write_workspace_file via platform policy', () => {
    const result = previewPermissionEffect(createPlatformPermissionPolicy(), {
      toolName: 'write_workspace_file',
    });

    expect(result.decision.effect).toBe('ask');
    expect(result.request.subject.actionKind).toBe('write');
  });

  it('requires human approval for edit_workspace_file', () => {
    const edit = previewPermissionEffect(createPlatformPermissionPolicy(), {
      toolName: 'edit_workspace_file',
    });

    expect(edit.decision.effect).toBe('ask');
    expect(edit.request.subject.actionKind).toBe('write');
  });

  it('allows read_workspace_file without approval', () => {
    const result = previewPermissionEffect(createPlatformPermissionPolicy(), {
      toolName: 'read_workspace_file',
    });

    expect(result.decision.effect).toBe('allow');
    expect(result.request.subject.actionKind).toBe('read');
  });

  it('executes write_workspace_file handler locally after approval path', async () => {
    const tool = new WriteWorkspaceFileTool();
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'linkloom-write-hitl-'));
    const result = await tool.handler(
      { path: 'approved.txt', content: 'approved' },
      {
        workspace: {
          workspaceId: 'local_ws',
          mode: 'local',
          rootDir: root,
          createdAt: new Date().toISOString(),
        },
      } as never
    );

    expect(result.bytesWritten).toBe(8);
  });
});
