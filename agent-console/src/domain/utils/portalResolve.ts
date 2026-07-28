import type { PortalContentData } from '../types/portal';
import type { PortalViewPayload } from '../types/portalView';
import { normalizeToolPluginId } from './toolPortal';

export function resolveDocumentContent(
  payload: PortalViewPayload,
  defaults: PortalContentData['documentDefault'],
): { title: string; paragraphs: string[] } {
  const title = payload.title || defaults.title;
  if (payload.content) {
    return { title, paragraphs: [payload.content] };
  }
  return { title, paragraphs: [...defaults.paragraphs] };
}

export function getFilePreviewContent(
  portalContent: PortalContentData,
  path?: string,
  content?: string,
): string {
  if (content) return content;
  if (path && portalContent.filePreviewByPath[path]) {
    return portalContent.filePreviewByPath[path];
  }
  const fallbackPath = path || 'studio/src/App.tsx';
  return (
    portalContent.filePreviewByPath[fallbackPath] ??
    `// ${fallbackPath}\n${portalContent.filePreviewDefault}`
  );
}

export function resolveToolUIPayload(
  payload: PortalViewPayload,
): Required<Pick<PortalViewPayload, 'plugin' | 'api' | 'state' | 'args'>> & PortalViewPayload {
  const plugin = normalizeToolPluginId(payload.plugin);
  return {
    ...payload,
    plugin,
    api: payload.api || 'search',
    state: payload.state || 'success',
    args: payload.args || { url: payload.url, format: 'markdown' },
  };
}
