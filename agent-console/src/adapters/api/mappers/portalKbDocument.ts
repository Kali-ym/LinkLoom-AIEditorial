import type { PortalViewPayload } from '../../../domain/types/portalView';

export interface KbDocumentContentResponse {
  content?: string;
}

export function mapKbContentToDocumentPayload(
  payload: PortalViewPayload,
  response: KbDocumentContentResponse,
): PortalViewPayload {
  const content = response.content ?? '';
  return {
    ...payload,
    content,
    title: payload.title ?? payload.documentId ?? String(payload.id ?? '文档'),
  };
}

export function resolveKbDocumentId(payload: PortalViewPayload): string | undefined {
  if (typeof payload.documentId === 'string' && payload.documentId.trim()) {
    return payload.documentId.trim();
  }
  if (typeof payload.id === 'string' && payload.id.startsWith('kb_')) {
    return payload.id;
  }
  return undefined;
}
