import type { GroundingData } from './grounding';
import type { ToolPayload } from './tool';
import type { ActionTagPayload } from './actionTag';
import type { PortalShowcaseEntry, PortalViewPayload } from './portalView';

export interface ReasoningShowcaseBlock {
  id?: string;
  label: string;
  thinking: boolean;
  open: boolean;
  duration?: string;
  content: string;
  streamChunks?: string[];
}

export interface WorkflowShowcaseBundle {
  tools: ToolPayload[];
  opts: { open?: boolean; duration?: string; streaming?: boolean };
}

export interface ShowcaseData {
  reasoning: {
    title: string;
    demoFullText: string;
    blocks: ReasoningShowcaseBlock[];
  };
  tools: {
    title: string;
    accordions: ToolPayload[];
    workflowCompleted: WorkflowShowcaseBundle;
    workflowStreaming: WorkflowShowcaseBundle;
  };
  grounding: {
    title: string;
    web: GroundingData;
    images: GroundingData;
  };
  portal: {
    title: string;
    entries: PortalShowcaseEntry[];
    verifyResult: PortalViewPayload;
  };
  skills: {
    title: string;
    hint: string;
    tagDemos: ActionTagPayload[];
  };
  msgTypes: {
    title: string;
  };
}
