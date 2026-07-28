import type { StructuredPrompt } from '../../../domain/types/structuredPrompt';

/** Backend agent DTO — mirrors `admin/src/services/agentService.Agent`. */
export interface BackendAgentDto {
  id: string;
  name: string;
  description: string;
  /** 后端可为字符串(旧)或结构化对象(新) */
  systemPrompt: string | StructuredPrompt;
  providerId: string;
  model: string;
  temperature: number;
  toolIds: string[];
  skillIds: string[];
  mcpServerIds: string[];
  streaming?: boolean;
  isHidden?: boolean;
  category?: string;
  knowledgeCategoryIds?: string[];
  knowledgeSaveCategoryIds?: string[];
  memoryCategoryIds?: string[];
  memorySaveCategoryIds?: string[];
  runtime?: {
    mode?: string;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
}
