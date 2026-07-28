import { portalTitle } from '../portalTitle';
import type { IPortalPort } from '../ports/IPortalPort';
import type { PortalViewPayload } from '../../domain/types/portalView';
import { readStoredActiveAgentId } from './activeAgentStorage';
import { agentConsoleGetJson } from './http';
import {
  mapArtifactResponseToPortalPayload,
  type BackendArtifactResponseDto,
} from './mappers/portalArtifact';
import {
  mapKbContentToDocumentPayload,
  resolveKbDocumentId,
  type KbDocumentContentResponse,
} from './mappers/portalKbDocument';

function resolveArtifactId(payload: PortalViewPayload): string | undefined {
  if (typeof payload.artifactId === 'string' && payload.artifactId.trim()) {
    return payload.artifactId.trim();
  }
  if (typeof payload.id === 'string' && payload.id.startsWith('art_')) {
    return payload.id;
  }
  return undefined;
}

async function fetchArtifactPayload(payload: PortalViewPayload): Promise<PortalViewPayload> {
  const artifactId = resolveArtifactId(payload);
  if (!artifactId) return payload;

  const runId = typeof payload.runId === 'string' ? payload.runId : undefined;
  const response = runId
    ? await agentConsoleGetJson<BackendArtifactResponseDto>(
        `/api/agent-runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifactId)}`,
      )
    : await agentConsoleGetJson<BackendArtifactResponseDto>(
        `/api/agent-artifacts/${encodeURIComponent(artifactId)}`,
      );

  return mapArtifactResponseToPortalPayload(payload, response);
}

async function fetchKbDocumentPayload(payload: PortalViewPayload): Promise<PortalViewPayload> {
  const documentId = resolveKbDocumentId(payload);
  if (!documentId) return payload;

  const response = await agentConsoleGetJson<KbDocumentContentResponse>(
    `/api/kb/documents/${encodeURIComponent(documentId)}/content`,
  );
  return mapKbContentToDocumentPayload(payload, response);
}

async function fetchWorkspaceDocumentPayload(
  payload: PortalViewPayload,
): Promise<PortalViewPayload> {
  const filePath = typeof payload.path === 'string' ? payload.path.trim() : '';
  if (!filePath) return payload;
  const agentId =
    (typeof payload.agentId === 'string' && payload.agentId.trim()) ||
    readStoredActiveAgentId() ||
    '';
  if (!agentId) return { ...payload, error: 'No active agent' };
  try {
    const response = await agentConsoleGetJson<{ content: string; updatedAt: number }>(
      `/api/agents/${encodeURIComponent(agentId)}/workspace/files/content?path=${encodeURIComponent(filePath)}`,
    );
    return {
      ...payload,
      content: response.content,
      updatedAt: response.updatedAt,
      title: payload.title ?? filePath.split('/').pop() ?? filePath,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load file';
    return { ...payload, error: message };
  }
}

export const apiPortalPort: IPortalPort = {
  async resolveView(type, payload) {
    switch (type) {
      case 'Artifact':
        return fetchArtifactPayload(payload);
      case 'Document':
        return fetchWorkspaceDocumentPayload(payload);
      case 'Notebook':
        return fetchKbDocumentPayload(payload);
      case 'FilePreview':
        if (payload.content) return payload;
        if (typeof payload.path === 'string' && payload.path.trim()) {
          return fetchWorkspaceDocumentPayload(payload);
        }
        if (resolveKbDocumentId(payload)) return fetchKbDocumentPayload(payload);
        return payload;
      default:
        return payload;
    }
  },

  async getTitle(type, payload) {
    return portalTitle(type, payload);
  },
};
