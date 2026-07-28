import type { DocumentNode, FileTreeNode, TodoItem, WebPage } from '../domain/types';

const EMPTY_TODOS: TodoItem[] = [];
const EMPTY_DOCUMENTS: DocumentNode[] = [];
const EMPTY_WEB_PAGES: WebPage[] = [];
const EMPTY_FILE_TREE: FileTreeNode[] = [];

export function selectTodosForTopic(topicId: string | null | undefined) {
  return (s: { todosByTopicId: Record<string, TodoItem[]> }) => {
    if (!topicId) return EMPTY_TODOS;
    return s.todosByTopicId[topicId] ?? EMPTY_TODOS;
  };
}

export function selectWorkspaceDocumentsForAgent(agentId: string | null | undefined) {
  return (s: { documentsByAgentId: Record<string, DocumentNode[]> }) => {
    if (!agentId) return EMPTY_DOCUMENTS;
    return s.documentsByAgentId[agentId] ?? EMPTY_DOCUMENTS;
  };
}

export function selectWebPagesForTopic(topicId: string | null | undefined) {
  return (s: { webPagesByTopicId: Record<string, WebPage[]> }) => {
    if (!topicId) return EMPTY_WEB_PAGES;
    return s.webPagesByTopicId[topicId] ?? EMPTY_WEB_PAGES;
  };
}

export function selectFileTreeForTopic(topicId: string | null | undefined) {
  return (s: { fileTreeByTopicId: Record<string, FileTreeNode[]> }) => {
    if (!topicId) return EMPTY_FILE_TREE;
    return s.fileTreeByTopicId[topicId] ?? EMPTY_FILE_TREE;
  };
}
