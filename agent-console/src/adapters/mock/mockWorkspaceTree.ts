import type { DocumentNode } from '../../domain/types';

const trees = new Map<string, DocumentNode[]>();

const DEFAULT_TREE: DocumentNode[] = [
  {
    id: 'docs',
    name: 'docs',
    path: 'docs',
    badge: '1',
    children: [
      { id: 'docs/welcome.md', name: 'welcome.md', path: 'docs/welcome.md' },
    ],
  },
];

export function getMockWorkspaceTree(agentId: string): DocumentNode[] {
  if (!trees.has(agentId)) {
    trees.set(agentId, structuredClone(DEFAULT_TREE));
    fileContents.set(
      contentKey(agentId, 'docs/welcome.md'),
      `---
title: Welcome
status: draft
tags: agent, portal
---
# Welcome

沙箱工作区示例文档。
`,
    );
    touchFileMeta(contentKey(agentId, 'docs/welcome.md'));
  }
  return trees.get(agentId)!;
}

export function setMockWorkspaceTree(agentId: string, nodes: DocumentNode[]): void {
  trees.set(agentId, nodes);
}

const fileContents = new Map<string, string>();
const fileUpdatedAt = new Map<string, number>();

function touchFileMeta(key: string): number {
  const next = Date.now();
  fileUpdatedAt.set(key, next);
  return next;
}

function contentKey(agentId: string, path: string): string {
  return `${agentId}:${path}`;
}

function parsePath(path: string): { parentPath: string | null; name: string } {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) {
    return { parentPath: null, name: path };
  }
  return { parentPath: path.slice(0, lastSlash), name: path.slice(lastSlash + 1) };
}

function findNodeByPath(
  nodes: DocumentNode[],
  path: string,
  parent: DocumentNode | null = null,
): { node: DocumentNode; parent: DocumentNode | null; siblings: DocumentNode[]; index: number } | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const nodePath = node.path ?? node.id;
    if (nodePath === path) {
      return { node, parent, siblings: nodes, index };
    }
    if (node.children?.length) {
      const found = findNodeByPath(node.children, path, node);
      if (found) return found;
    }
  }
  return null;
}

function findParent(
  tree: DocumentNode[],
  path: string,
): { parent: DocumentNode | null; siblings: DocumentNode[]; name: string } | null {
  const { parentPath, name } = parsePath(path);
  if (parentPath === null) {
    return { parent: null, siblings: tree, name };
  }

  const found = findNodeByPath(tree, parentPath);
  if (!found) return null;

  if (!found.node.children) {
    found.node.children = [];
  }

  return { parent: found.node, siblings: found.node.children, name };
}

function updateDirectoryBadge(node: DocumentNode): void {
  if (node.children) {
    node.badge = String(node.children.length);
  }
}

function insertNode(
  tree: DocumentNode[],
  path: string,
  node: DocumentNode,
): void {
  const parentInfo = findParent(tree, path);
  if (!parentInfo) {
    throw new Error(`Parent directory not found for path: ${path}`);
  }

  const existing = findNodeByPath(tree, path);
  if (existing) {
    throw new Error(`Entry already exists: ${path}`);
  }

  parentInfo.siblings.push(node);

  if (parentInfo.parent) {
    updateDirectoryBadge(parentInfo.parent);
  }
}

function removeNode(tree: DocumentNode[], path: string): DocumentNode {
  const found = findNodeByPath(tree, path);
  if (!found) {
    throw new Error(`Entry not found: ${path}`);
  }

  const [removed] = found.siblings.splice(found.index, 1);

  if (found.parent) {
    updateDirectoryBadge(found.parent);
  }

  return removed;
}

function deleteFileContentsUnder(agentId: string, dirPath: string): void {
  const prefix = contentKey(agentId, '');
  for (const key of [...fileContents.keys()]) {
    if (!key.startsWith(prefix)) continue;
    const filePath = key.slice(prefix.length);
    if (filePath === dirPath || filePath.startsWith(`${dirPath}/`)) {
      fileContents.delete(key);
    }
  }
}

function moveFileContents(agentId: string, fromPrefix: string, toPrefix: string): void {
  const prefix = contentKey(agentId, '');
  const moves: Array<[string, string]> = [];

  for (const key of fileContents.keys()) {
    if (!key.startsWith(prefix)) continue;
    const filePath = key.slice(prefix.length);
    if (filePath === fromPrefix || filePath.startsWith(`${fromPrefix}/`)) {
      const suffix = filePath === fromPrefix ? '' : filePath.slice(fromPrefix.length);
      moves.push([key, contentKey(agentId, `${toPrefix}${suffix}`)]);
    }
  }

  for (const [oldKey, newKey] of moves) {
    const content = fileContents.get(oldKey);
    if (content !== undefined) {
      fileContents.set(newKey, content);
      fileContents.delete(oldKey);
    }
    const updatedAt = fileUpdatedAt.get(oldKey);
    if (updatedAt !== undefined) {
      fileUpdatedAt.set(newKey, updatedAt);
      fileUpdatedAt.delete(oldKey);
    }
  }
}

function remapNodePaths(node: DocumentNode, newPath: string): DocumentNode {
  const { name } = parsePath(newPath);
  const remapped: DocumentNode = {
    ...node,
    id: newPath,
    name,
    path: newPath,
  };

  if (node.children?.length) {
    remapped.children = node.children.map((child) =>
      remapNodePaths(child, `${newPath}/${child.name}`),
    );
    remapped.badge = String(remapped.children.length);
  }

  return remapped;
}

export function mockReadFile(agentId: string, path: string): string {
  return mockReadFileMeta(agentId, path).content;
}

export function mockReadFileMeta(
  agentId: string,
  path: string,
): { content: string; updatedAt: number } {
  const key = contentKey(agentId, path);
  const content = fileContents.get(key) ?? `# ${path}\n`;
  const updatedAt = fileUpdatedAt.get(key) ?? touchFileMeta(key);
  return { content, updatedAt };
}

export function mockWriteFile(
  agentId: string,
  path: string,
  content: string,
  expectedUpdatedAt?: number,
): number {
  const key = contentKey(agentId, path);
  const current = fileUpdatedAt.get(key);
  if (current !== undefined && expectedUpdatedAt !== undefined && current !== expectedUpdatedAt) {
    const error = new Error('File changed on disk');
    (error as Error & { status: number }).status = 409;
    throw error;
  }
  fileContents.set(key, content);
  return touchFileMeta(key);
}

export function mockCreateDirectory(agentId: string, path: string): void {
  const tree = getMockWorkspaceTree(agentId);
  const { name } = parsePath(path);

  insertNode(tree, path, {
    id: path,
    name,
    path,
    badge: '0',
    children: [],
  });
}

export function mockCreateFile(agentId: string, path: string, content?: string): void {
  const tree = getMockWorkspaceTree(agentId);
  const { name } = parsePath(path);

  insertNode(tree, path, {
    id: path,
    name,
    path,
  });

  fileContents.set(contentKey(agentId, path), content ?? `# ${path}\n`);
  touchFileMeta(contentKey(agentId, path));
}

export function mockMoveEntry(agentId: string, from: string, to: string): void {
  const tree = getMockWorkspaceTree(agentId);
  const removed = removeNode(tree, from);
  const moved = remapNodePaths(removed, to);
  insertNode(tree, to, moved);
  moveFileContents(agentId, from, to);
}

export function mockDeleteEntry(agentId: string, path: string): void {
  const tree = getMockWorkspaceTree(agentId);
  const removed = removeNode(tree, path);

  if (removed.children?.length) {
    deleteFileContentsUnder(agentId, path);
  } else {
    fileContents.delete(contentKey(agentId, path));
    fileUpdatedAt.delete(contentKey(agentId, path));
  }
}
