import type {
  BindingCategory,
  DocumentNode,
  FileTreeNode,
  PortalContentData,
  ReviewFile,
  ShowcaseData,
  SkillCatalog,
  StaticConversation,
  TodoItem,
  WebPage,
} from '../../domain/types';

export interface WorkspaceFileWriteOptions {
  expectedUpdatedAt?: number;
}

export interface WorkspaceFileWriteResult {
  updatedAt: number;
}

export interface IWorkspacePort {
  getSkillCatalog(): Promise<SkillCatalog>;
  getDocuments(): Promise<DocumentNode[]>;
  getWorkspaceDocumentTree(agentId: string): Promise<DocumentNode[]>;
  readWorkspaceFile(agentId: string, path: string): Promise<string>;
  writeWorkspaceFile(
    agentId: string,
    path: string,
    content: string,
    options?: WorkspaceFileWriteOptions,
  ): Promise<WorkspaceFileWriteResult>;
  createWorkspaceDirectory(agentId: string, path: string): Promise<void>;
  createWorkspaceFile(agentId: string, path: string, content?: string): Promise<void>;
  moveWorkspaceEntry(agentId: string, from: string, to: string): Promise<void>;
  deleteWorkspaceEntry(agentId: string, path: string): Promise<void>;
  getWebPages(): Promise<WebPage[]>;
  getFileTree(): Promise<FileTreeNode[]>;
  getReviewFiles(): Promise<ReviewFile[]>;
  getWorkingDirectory(): Promise<string>;
  getPortalContent(): Promise<PortalContentData>;
  getTodos(): Promise<TodoItem[]>;
  getShowcase(): Promise<ShowcaseData>;
  getStaticConversation(): Promise<StaticConversation>;
  bindKnowledgeBase(agentId: string, kbId: string): Promise<void>;
  unbindKnowledgeBase(agentId: string, kbId: string): Promise<void>;
  bindFile(agentId: string, fileId: string): Promise<void>;
  unbindFile(agentId: string, fileId: string): Promise<void>;
  createKbCategory(name: string, description?: string): Promise<{ id: string }>;
  createKbDocument(
    categoryId: string,
    fileName: string,
    content: string,
  ): Promise<{ id: string }>;
  listKnowledgeCategories(): Promise<BindingCategory[]>;
  listMemoryCategories(): Promise<BindingCategory[]>;
}
