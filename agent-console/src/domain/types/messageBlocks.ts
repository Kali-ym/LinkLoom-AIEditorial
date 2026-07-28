import type { StaticReasoningBlock } from './conversation';
import type { GroundingData } from './grounding';
import type { StreamImage } from './message';
import type { ToolPayload } from './tool';

/** §C.37*/
export interface AssistantContentBlock {
  id: string;
  content?: string;
  reasoning?: StaticReasoningBlock;
  tools?: ToolPayload[];
  grounding?: GroundingData;
  images?: StreamImage[];
  error?: string;
}

export type CompressedGroupTab = 'summary' | 'history';

export type VerifyPhase = 'pending' | 'running' | 'passed' | 'failed';

export interface VerifyCheckItem {
  id: string;
  label: string;
  status: 'pending' | 'passed' | 'failed';
}

export interface VerifyOperationState {
  verifyStatus: VerifyPhase;
  verifyRound?: number;
  verifyPlan: VerifyCheckItem[];
}
