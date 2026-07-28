function pickContent(content?: string | null): string {
  return content?.trim() || '';
}

function isEditToolResultJson(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return typeof parsed.path === 'string' && typeof parsed.replacements === 'number';
  } catch {
    return false;
  }
}

export function resolveEditFileDiff(
  args?: {
    file_path?: string;
    new_string?: string;
    old_string?: string;
    path?: string;
    search?: string;
    replace?: string;
  },
  content?: string | null,
): { filePath: string; oldContent: string; newContent: string } {
  const filePath = args?.file_path || args?.path || '';
  const oldContent = args?.old_string ?? args?.search ?? '';
  const newContent = args?.new_string ?? args?.replace ?? '';

  if (oldContent || newContent) {
    return { filePath, oldContent, newContent };
  }

  const body = pickContent(content);
  if (body && !isEditToolResultJson(body)) {
    return { filePath, oldContent: '', newContent: body };
  }

  return { filePath, oldContent: '', newContent: '' };
}
