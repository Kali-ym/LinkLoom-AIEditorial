import type { MessageFileItem, MessageImageItem } from '../../domain/types';

/** Build mock/store fields from raw user input. */
export function createUserMessageFields(
  raw: string,
  id: string,
  createdAt: string,
  extras?: {
    editorData?: unknown;
    fileList?: MessageFileItem[];
    imageList?: MessageImageItem[];
  },
) {
  const text = raw.trim();
  return {
    id,
    role: 'user' as const,
    content: text,
    createdAt,
    text,
    ...extras,
  };
}
