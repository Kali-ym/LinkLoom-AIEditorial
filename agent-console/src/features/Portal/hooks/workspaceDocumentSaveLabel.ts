export type WorkspaceDocumentSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

export function formatWorkspaceDocumentSaveLabel(
  status: WorkspaceDocumentSaveStatus,
  editable: boolean,
): string {
  if (!editable) return '只读预览';
  if (status === 'saving') return '保存中…';
  if (status === 'error') return '保存失败';
  if (status === 'conflict') return '磁盘已更新，请重新加载';
  if (status === 'saved') return '已自动保存 · 刚刚';
  return '编辑中…';
}
