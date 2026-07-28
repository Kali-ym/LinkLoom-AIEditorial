import type { PortalViewPayload } from '../../../domain/types/portalView';

export interface BackendArtifactRefDto {
  artifactId: string;
  kind?: string;
  uri?: string;
  preview?: string;
  metadata?: Record<string, unknown>;
}

export interface BackendArtifactResponseDto {
  runId?: string;
  artifact: BackendArtifactRefDto;
  content?: string | null;
}

export function mapArtifactResponseToPortalPayload(
  payload: PortalViewPayload,
  response: BackendArtifactResponseDto,
): PortalViewPayload {
  const { artifact, content } = response;
  const code = content ?? artifact.preview ?? '';
  const metaTitle =
    typeof artifact.metadata?.title === 'string' ? artifact.metadata.title : undefined;

  return {
    ...payload,
    id: artifact.artifactId,
    title: payload.title ?? metaTitle ?? artifact.artifactId,
    artifactCode: code,
    artifactDescription: payload.artifactDescription ?? artifact.preview ?? '',
    content: code,
    runId: response.runId ?? payload.runId,
  };
}
