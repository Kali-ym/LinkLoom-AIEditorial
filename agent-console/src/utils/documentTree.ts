import type { DocumentNode } from '../domain/types';

export function resolveDocumentParentPath(path: string): string | null {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) return null;
  return path.slice(0, lastSlash);
}

export function isDocumentFolder(node: DocumentNode): boolean {
  return Array.isArray(node.children);
}

export function isDescendantPath(ancestor: string, path: string): boolean {
  return path === ancestor || path.startsWith(`${ancestor}/`);
}

/** Drop child paths when an ancestor is also selected (recursive delete handles the subtree). */
export function pruneDescendantWorkspacePaths(paths: string[]): string[] {
  const unique = [...new Set(paths)];
  return unique.filter(
    (path) => !unique.some((other) => other !== path && path.startsWith(`${other}/`)),
  );
}

export function findDocumentNodeByPath(
  documents: DocumentNode[],
  pathOrId: string,
): DocumentNode | null {
  for (const node of documents) {
    const nodePath = node.path ?? node.id;
    if (nodePath === pathOrId || node.id === pathOrId) return node;
    if (node.children?.length) {
      const found = findDocumentNodeByPath(node.children, pathOrId);
      if (found) return found;
    }
  }
  return null;
}

export function resolveDocumentFolderPath(
  documents: DocumentNode[],
  selectedId: string | null,
): string | null {
  if (!selectedId) return null;
  const node = findDocumentNodeByPath(documents, selectedId);
  if (!node) return null;
  const nodePath = node.path ?? node.id;
  if (isDocumentFolder(node)) return nodePath;
  return resolveDocumentParentPath(nodePath);
}

export function countWorkspaceDocumentFiles(nodes: DocumentNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (isDocumentFolder(node)) {
      count += countWorkspaceDocumentFiles(node.children ?? []);
    } else {
      count += 1;
    }
  }
  return count;
}

export function flattenVisibleDocumentPaths(
  nodes: DocumentNode[],
  expanded: Record<string, boolean>,
): string[] {
  const paths: string[] = [];

  function walk(list: DocumentNode[]): void {
    for (const node of list) {
      const nodePath = node.path ?? node.id;
      paths.push(nodePath);
      if (isDocumentFolder(node) && expanded[node.id] && node.children?.length) {
        walk(node.children);
      }
    }
  }

  walk(nodes);
  return paths;
}

export function resolveDocumentCategoryId(
  documents: DocumentNode[],
  selectedId: string | null,
): string | null {
  if (!documents.length) return null;

  if (selectedId) {
    for (const category of documents) {
      if (category.id === selectedId) return category.id;
      if (category.children?.some((child) => child.id === selectedId)) {
        return category.id;
      }
    }
  }

  return documents[0]?.id ?? null;
}

export function findDocumentNode(
  documents: DocumentNode[],
  documentId: string,
): { category: DocumentNode; document: DocumentNode } | null {
  for (const category of documents) {
    const document = category.children?.find((child) => child.id === documentId);
    if (document) {
      return { category, document };
    }
  }
  return null;
}
