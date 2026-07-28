import type { DocumentNode } from '../../../domain/types';

export interface WorkspaceTreeNodeDto {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  updatedAt?: number;
  children?: WorkspaceTreeNodeDto[];
}

export function mapWorkspaceTreeToDocumentNodes(entries: WorkspaceTreeNodeDto[]): DocumentNode[] {
  return entries.map(mapNode);
}

function mapNode(node: WorkspaceTreeNodeDto): DocumentNode {
  if (node.type === 'directory') {
    const children = (node.children ?? []).map(mapNode);
    return {
      id: node.path,
      name: node.name,
      path: node.path,
      badge: String(children.length),
      children,
    };
  }
  return { id: node.path, name: node.name, path: node.path };
}
