import { describe, expect, it } from 'vitest';

import {
  resolveLinkLoomToolIdentity,
  isMappedLinkLoomTool,
  listLinkLoomToolMappings,
  parseMcpCombinedToolName,
  TOOLSET_IDS,
} from './toolIdentityMapper';

describe('resolveLinkLoomToolIdentity', () => {
  it('maps query_knowledge to linkloom-knowledge-base searchKnowledgeBase', () => {
    expect(resolveLinkLoomToolIdentity({ toolName: 'query_knowledge' })).toEqual({
      identifier: 'linkloom-knowledge-base',
      apiName: 'searchKnowledgeBase',
      plugin: 'linkloom-knowledge-base',
      linkloomToolId: 'query_knowledge',
    });
  });

  it('maps readUpload alias to linkloom-local-system readFile', () => {
    expect(resolveLinkLoomToolIdentity({ toolName: 'readUpload' })).toMatchObject({
      identifier: 'linkloom-local-system',
      apiName: 'readFile',
      linkloomToolId: 'read_upload',
    });
  });

  it('maps read_workspace_file to linkloom-local-system readFile', () => {
    expect(resolveLinkLoomToolIdentity({ toolName: 'read_workspace_file' })).toMatchObject({
      identifier: 'linkloom-local-system',
      apiName: 'readFile',
      linkloomToolId: 'read_workspace_file',
    });
  });

  it('maps edit_workspace_file and delete_workspace_file to local-system file tools', () => {
    expect(resolveLinkLoomToolIdentity({ toolName: 'edit_workspace_file' })).toMatchObject({
      identifier: 'linkloom-local-system',
      apiName: 'editFile',
      linkloomToolId: 'edit_workspace_file',
    });
    expect(resolveLinkLoomToolIdentity({ toolName: 'deleteFile' })).toMatchObject({
      identifier: 'linkloom-local-system',
      apiName: 'deleteFile',
      linkloomToolId: 'delete_workspace_file',
    });
  });

  it('maps create_todos to linkloom-agent createTodos', () => {
    expect(resolveLinkLoomToolIdentity({ toolName: 'create_todos' })).toMatchObject({
      identifier: 'linkloom-agent',
      apiName: 'createTodos',
      linkloomToolId: 'create_todos',
    });
  });

  it('maps ask_user_question to linkloom-user-interaction askUserQuestion', () => {
    expect(resolveLinkLoomToolIdentity({ toolName: 'ask_user_question' })).toEqual({
      identifier: 'linkloom-user-interaction',
      apiName: 'askUserQuestion',
      plugin: 'linkloom-user-interaction',
      linkloomToolId: 'ask_user_question',
    });
  });

  it('prefers exposedName when toolName is empty', () => {
    expect(resolveLinkLoomToolIdentity({ toolName: '', exposedName: 'query_memory' })).toMatchObject({
      identifier: 'linkloom-user-memory',
      apiName: 'searchUserMemory',
    });
  });

  it('maps MCP tools to linkloom-mcp with concrete apiName', () => {
    expect(
      resolveLinkLoomToolIdentity({
        toolName: 'my_server__search_docs',
        mcpServerId: 'srv-1',
      }),
    ).toEqual({
      identifier: 'linkloom-mcp',
      apiName: 'search_docs',
      plugin: 'mcp:srv-1',
      linkloomToolId: 'mcp:srv-1:search_docs',
    });
  });

  it('falls back to linkloom-generic for unknown tools', () => {
    expect(resolveLinkLoomToolIdentity({ toolName: 'unknown_custom_tool' })).toEqual({
      identifier: 'linkloom-generic',
      apiName: 'unknownCustomTool',
      plugin: 'unknown_custom_tool',
      linkloomToolId: 'unknown_custom_tool',
    });
  });

  it('maps workflow tools to linkloom-workflow', () => {
    expect(resolveLinkLoomToolIdentity({ toolName: 'fetch_data' })).toMatchObject({
      identifier: 'linkloom-workflow',
      apiName: 'fetchData',
    });
  });
});

describe('parseMcpCombinedToolName', () => {
  it('parses server__tool pattern', () => {
    expect(parseMcpCombinedToolName('github_mcp__create_issue')).toEqual({
      serverKey: 'github_mcp',
      mcpApiName: 'create_issue',
    });
  });

  it('returns null for non-mcp names', () => {
    expect(parseMcpCombinedToolName('query_knowledge')).toBeNull();
  });
});

describe('isMappedLinkLoomTool', () => {
  it('returns true for mapped builtin tools', () => {
    expect(isMappedLinkLoomTool('execute_command')).toBe(true);
  });

  it('returns false for unmapped tools', () => {
    expect(isMappedLinkLoomTool('totally_new_tool')).toBe(false);
  });
});

describe('listLinkLoomToolMappings', () => {
  it('includes query_knowledge and planned read_skill entries', () => {
    const mappings = listLinkLoomToolMappings();
    expect(mappings.some((m) => m.linkloomToolId === 'query_knowledge')).toBe(true);
    expect(mappings.some((m) => m.linkloomToolId === 'read_skill')).toBe(true);
    expect(mappings.some((m) => m.linkloomToolId === 'create_todos')).toBe(true);
  });
});

describe('TOOLSET_IDS', () => {
  it('uses linkloom prefix without lobe branding', () => {
    expect(TOOLSET_IDS.KNOWLEDGE_BASE).toBe('linkloom-knowledge-base');
    expect(TOOLSET_IDS.AGENT).toBe('linkloom-agent');
    expect(TOOLSET_IDS.KNOWLEDGE_BASE.includes('lobe')).toBe(false);
  });
});
