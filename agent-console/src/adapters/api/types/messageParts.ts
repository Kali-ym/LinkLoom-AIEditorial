export interface AgentMessageContentPart {
  kind: 'text' | 'image' | 'artifact' | 'tool_call' | 'tool_result' | 'reasoning';
  text?: string;
  artifactId?: string;
  mimeType?: string;
  data?: unknown;
  metadata?: Record<string, unknown>;
}
