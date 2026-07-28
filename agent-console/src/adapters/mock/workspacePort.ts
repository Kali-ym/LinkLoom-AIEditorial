import { AgentConsoleApiError } from '../api/http';
import type { BindingCategory } from '../../domain/types';
import {
  bindFileToAgent,
  bindKnowledgeBaseToAgent,
  unbindFileFromAgent,
  unbindKnowledgeBaseFromAgent,
} from '../knowledgeBindAdapter';
import type { IWorkspacePort } from '../ports/IWorkspacePort';
import {
  mockCreateDirectory,
  mockCreateFile,
  mockDeleteEntry,
  mockMoveEntry,
  mockReadFile,
  mockWriteFile,
} from './mockWorkspaceTree';
import { getMockStaticConversation } from './seeds/chatSeed';
import { getMockShowcase } from './seeds/catalogSeed';
import {
  getMockDocuments,
  getMockFileTree,
  getMockPortalContent,
  getMockReviewFiles,
  getMockSkillCatalog,
  getMockTodos,
  getMockWebPages,
  getMockWorkingDirectory,
} from './seeds/workspaceSeed';

const MOCK_KNOWLEDGE_CATEGORIES: BindingCategory[] = [
  { id: 'mock-kb-1', name: '产品文档', description: '产品相关资料' },
  { id: 'mock-kb-2', name: '技术规范' },
  { id: 'mock-kb-3', name: 'FAQ' },
];

const MOCK_MEMORY_CATEGORIES: BindingCategory[] = [
  { id: 'mock-mem-1', name: '用户偏好', description: '长期记忆' },
  { id: 'mock-mem-2', name: '会话摘要' },
];

export const mockWorkspacePort: IWorkspacePort = {
  async getSkillCatalog() {
    return getMockSkillCatalog();
  },

  async getDocuments() {
    return getMockDocuments();
  },

  async getWorkspaceDocumentTree(_agentId) {
    return getMockDocuments();
  },

  async readWorkspaceFile(agentId, path) {
    return mockReadFile(agentId, path);
  },

  async writeWorkspaceFile(agentId, path, content, options) {
    try {
      const updatedAt = mockWriteFile(agentId, path, content, options?.expectedUpdatedAt);
      return { updatedAt };
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 409) {
        throw new AgentConsoleApiError('File changed on disk', {
          code: 'HTTP_ERROR',
          status: 409,
        });
      }
      throw error;
    }
  },

  async createWorkspaceDirectory(agentId, path) {
    mockCreateDirectory(agentId, path);
  },

  async createWorkspaceFile(agentId, path, content) {
    mockCreateFile(agentId, path, content);
  },

  async moveWorkspaceEntry(agentId, from, to) {
    mockMoveEntry(agentId, from, to);
  },

  async deleteWorkspaceEntry(agentId, path) {
    mockDeleteEntry(agentId, path);
  },

  async getWebPages() {
    return getMockWebPages();
  },

  async getFileTree() {
    return getMockFileTree();
  },

  async getReviewFiles() {
    return getMockReviewFiles();
  },

  async getWorkingDirectory() {
    return getMockWorkingDirectory();
  },

  async getPortalContent() {
    return getMockPortalContent();
  },

  async getTodos() {
    return getMockTodos();
  },

  async getShowcase() {
    return getMockShowcase();
  },

  async getStaticConversation() {
    return getMockStaticConversation();
  },

  bindKnowledgeBase: bindKnowledgeBaseToAgent,
  unbindKnowledgeBase: unbindKnowledgeBaseFromAgent,
  bindFile: bindFileToAgent,
  unbindFile: unbindFileFromAgent,

  async createKbCategory(_name) {
    await new Promise((r) => window.setTimeout(r, 80));
    return { id: `mock-cat-${Date.now()}` };
  },

  async createKbDocument(_categoryId, fileName, _content) {
    await new Promise((r) => window.setTimeout(r, 80));
    return { id: `mock-doc-${fileName}-${Date.now()}` };
  },

  async listKnowledgeCategories() {
    return MOCK_KNOWLEDGE_CATEGORIES;
  },

  async listMemoryCategories() {
    return MOCK_MEMORY_CATEGORIES;
  },
};
