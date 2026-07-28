import { filterAgentsForConsole } from '../../domain/consoleAgentFilter';
import type { DocumentNode } from '../../domain/types';
import type { IWorkspacePort } from '../ports/IWorkspacePort';
import {
  EMPTY_PORTAL_CONTENT,
  EMPTY_SHOWCASE,
  EMPTY_STATIC_CONVERSATION,
} from '../emptyDomainDefaults';
import { readStoredActiveAgentId } from './activeAgentStorage';
import { readStoredActiveTopicId } from './activeTopicStorage';
import { resolveActiveAgentId } from './agentRun';
import {
  agentConsoleDelete,
  agentConsoleGetJson,
  agentConsolePatchJson,
  agentConsolePostFormData,
  agentConsolePostJson,
  agentConsolePutJson,
} from './http';
import {
  resolveBindingResourceTypeForFile,
  resolveBindingResourceTypeForKnowledge,
} from './mappers/agentBindings';
import {
  mapWorkspaceSkillCatalog,
  type BackendMcpConfigDto,
  type BackendSkillDto,
  type BackendToolDto,
} from './mappers/skillCatalog';
import { mapBackendAgentToDomain } from './mappers/agent';
import type { BackendAgentDto } from './types/agent';
import { topicIdToSessionId } from './mappers/sessionTopic';
import {
  mapBackendTodosToDomain,
  type BackendWorkspaceState,
} from './mappers/workspaceState';
import {
  mapKbCategoryDtoToBindingCategory,
  type KbCategoryDto,
} from './mappers/kbDocuments';

import {
  mapWorkspaceTreeToDocumentNodes,
  type WorkspaceTreeNodeDto,
} from './mappers/workspaceTree';

async function fetchBindingCategories(path: string) {
  const categories = await agentConsoleGetJson<KbCategoryDto[]>(path);
  return categories.map(mapKbCategoryDtoToBindingCategory);
}

async function fetchWorkspaceDocumentTree(agentId: string): Promise<DocumentNode[]> {
  if (!agentId) return [];
  const { entries } = await agentConsoleGetJson<{ entries: WorkspaceTreeNodeDto[] }>(
    `/api/agents/${encodeURIComponent(agentId)}/workspace/tree`,
  );
  return mapWorkspaceTreeToDocumentNodes(entries ?? []);
}

export const apiWorkspacePort: IWorkspacePort = {
  async getSkillCatalog() {
    const [skills, tools, agents, mcpConfigs] = await Promise.all([
      agentConsoleGetJson<BackendSkillDto[]>('/api/skills'),
      agentConsoleGetJson<BackendToolDto[]>('/api/tools'),
      agentConsoleGetJson<BackendAgentDto[]>('/api/agents'),
      agentConsoleGetJson<BackendMcpConfigDto[]>('/api/mcp-configs').catch(() => [] as BackendMcpConfigDto[]),
    ]);

    const domainAgents = filterAgentsForConsole(agents.map(mapBackendAgentToDomain));
    return mapWorkspaceSkillCatalog({ skills, tools, mcpConfigs, agents: domainAgents });
  },

  async getDocuments() {
    const agentId = readStoredActiveAgentId() ?? '';
    return fetchWorkspaceDocumentTree(agentId);
  },

  async getWorkspaceDocumentTree(agentId) {
    return fetchWorkspaceDocumentTree(agentId);
  },

  async readWorkspaceFile(agentId, filePath) {
    const query = new URLSearchParams({ path: filePath });
    const result = await agentConsoleGetJson<{ content: string }>(
      `/api/agents/${encodeURIComponent(agentId)}/workspace/files/content?${query.toString()}`,
    );
    return result.content;
  },

  async writeWorkspaceFile(agentId, filePath, content, options) {
    const result = await agentConsolePutJson<{ updatedAt: number }>(
      `/api/agents/${encodeURIComponent(agentId)}/workspace/files/content`,
      {
        path: filePath,
        content,
        ...(options?.expectedUpdatedAt !== undefined
          ? { expectedUpdatedAt: options.expectedUpdatedAt }
          : {}),
      },
    );
    return { updatedAt: result.updatedAt };
  },

  async createWorkspaceDirectory(agentId, dirPath) {
    await agentConsolePostJson(
      `/api/agents/${encodeURIComponent(agentId)}/workspace/directories`,
      { path: dirPath },
    );
  },

  async createWorkspaceFile(agentId, filePath, content) {
    await agentConsolePostJson(`/api/agents/${encodeURIComponent(agentId)}/workspace/files`, {
      path: filePath,
      content,
    });
  },

  async moveWorkspaceEntry(agentId, from, to) {
    await agentConsolePatchJson(`/api/agents/${encodeURIComponent(agentId)}/workspace/files`, {
      from,
      to,
    });
  },

  async deleteWorkspaceEntry(agentId, filePath) {
    const query = new URLSearchParams({ path: filePath });
    await agentConsoleDelete(
      `/api/agents/${encodeURIComponent(agentId)}/workspace/files?${query.toString()}`,
    );
  },

  async getWebPages() {
    return [];
  },

  async getFileTree() {
    return [];
  },

  async getReviewFiles() {
    return [];
  },

  async getWorkingDirectory() {
    return '';
  },

  async getPortalContent() {
    return EMPTY_PORTAL_CONTENT;
  },

  async getTodos() {
    const agentId = await resolveActiveAgentId();
    const topicId = readStoredActiveTopicId(agentId);
    if (!topicId) return [];
    try {
      const session = await agentConsoleGetJson<{ workspaceState?: BackendWorkspaceState | null }>(
        `/api/agent-sessions/${encodeURIComponent(topicIdToSessionId(topicId))}`,
      );
      return mapBackendTodosToDomain(session.workspaceState?.todos);
    } catch {
      return [];
    }
  },

  async getShowcase() {
    return EMPTY_SHOWCASE;
  },

  async getStaticConversation() {
    return EMPTY_STATIC_CONVERSATION;
  },

  async bindKnowledgeBase(agentId, kbId) {
    await agentConsolePostJson(`/api/agents/${encodeURIComponent(agentId)}/bindings`, {
      resourceType: resolveBindingResourceTypeForKnowledge(),
      resourceId: kbId,
    });
  },

  async unbindKnowledgeBase(agentId, kbId) {
    const query = new URLSearchParams({
      resourceType: resolveBindingResourceTypeForKnowledge(),
      resourceId: kbId,
    });
    await agentConsoleDelete(
      `/api/agents/${encodeURIComponent(agentId)}/bindings?${query.toString()}`,
    );
  },

  async bindFile(agentId, fileId) {
    await agentConsolePostJson(`/api/agents/${encodeURIComponent(agentId)}/bindings`, {
      resourceType: resolveBindingResourceTypeForFile(),
      resourceId: fileId,
    });
  },

  async unbindFile(agentId, fileId) {
    const query = new URLSearchParams({
      resourceType: resolveBindingResourceTypeForFile(),
      resourceId: fileId,
    });
    await agentConsoleDelete(
      `/api/agents/${encodeURIComponent(agentId)}/bindings?${query.toString()}`,
    );
  },

  async createKbCategory(name, description = '') {
    return agentConsolePostJson<{ id: string }>('/api/kb/categories', { name, description });
  },

  async createKbDocument(categoryId, fileName, content) {
    const form = new FormData();
    form.append('categoryId', categoryId);
    form.append('file', new Blob([content], { type: 'text/markdown' }), fileName);
    const result = await agentConsolePostFormData<{ id?: string; status?: string }>(
      '/api/kb/documents',
      form,
    );
    if (!result.id) {
      throw new Error('Create document response missing id');
    }
    return { id: result.id };
  },

  async listKnowledgeCategories() {
    return fetchBindingCategories('/api/kb/categories');
  },

  async listMemoryCategories() {
    return fetchBindingCategories('/api/memory/categories');
  },
};
