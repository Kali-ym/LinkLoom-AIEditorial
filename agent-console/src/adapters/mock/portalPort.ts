import { readStoredActiveAgentId } from '../api/activeAgentStorage';
import { portalTitle } from '../portalTitle';
import type { IPortalPort } from '../ports/IPortalPort';
import type { PortalViewPayload, PortalViewType } from '../../domain/types/portalView';
import { mockReadFileMeta } from './mockWorkspaceTree';

async function fetchWorkspaceDocumentPayload(
  payload: PortalViewPayload,
): Promise<PortalViewPayload> {
  const filePath = typeof payload.path === 'string' ? payload.path.trim() : '';
  if (!filePath) return payload;
  const agentId =
    (typeof payload.agentId === 'string' && payload.agentId.trim()) ||
    readStoredActiveAgentId() ||
    'mock-agent';
  try {
    const { content, updatedAt } = mockReadFileMeta(agentId, filePath);
    return {
      ...payload,
      content,
      updatedAt,
      title: payload.title ?? filePath.split('/').pop() ?? filePath,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load file';
    return { ...payload, error: message };
  }
}

export const mockPortalPort: IPortalPort = {
  async resolveView(type, payload) {
    switch (type) {
      case 'Document':
        return fetchWorkspaceDocumentPayload(payload);
      case 'FilePreview':
        if (payload.content) return payload;
        if (typeof payload.path === 'string' && payload.path.trim()) {
          return fetchWorkspaceDocumentPayload(payload);
        }
        return payload;
      default:
        return payload;
    }
  },

  async getTitle(type: PortalViewType, payload: PortalViewPayload) {
    return portalTitle(type, payload);
  },
};
