import type { FileTreeNode, ReviewFile } from '../domain/types';

export function countFiles(nodes: FileTreeNode[]): number {
  return nodes.reduce((sum, node) => {
    if (node.type === 'file') return sum + 1;
    if (node.children?.length) return sum + countFiles(node.children);
    return sum;
  }, 0);
}

export function toUnifiedPatch(file: ReviewFile): string {
  return [
    `diff --git a/${file.path} b/${file.path}`,
    `--- a/${file.path}`,
    `+++ b/${file.path}`,
    ...file.diff,
  ].join('\n');
}

export type PreviewFileKind = 'code' | 'markdown' | 'html' | 'text';

export function inferPreviewKind(path: string): PreviewFileKind {
  if (/\.(html?|htm)$/i.test(path)) return 'html';
  if (/\.(md|markdown)$/i.test(path)) return 'markdown';
  if (/\.(tsx?|jsx?|json|css|scss|yaml|yml|sh|py|rs|go)$/i.test(path)) return 'code';
  return 'text';
}

export function inferLanguage(path: string): string {
  if (path.endsWith('.html') || path.endsWith('.htm')) return 'html';
  if (path.endsWith('.tsx')) return 'tsx';
  if (path.endsWith('.ts')) return 'typescript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.md')) return 'markdown';
  return 'text';
}
