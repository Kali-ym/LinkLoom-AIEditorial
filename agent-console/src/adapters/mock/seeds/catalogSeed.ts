import {
  PORTAL_SHOWCASE_ENTRIES,
  PORTAL_SHOWCASE_TITLE,
  PORTAL_VERIFY_RESULT_2,
} from '../../../fixtures/showcasePortal';
import {
  GROUNDING_SHOWCASE_IMAGES,
  GROUNDING_SHOWCASE_TITLE,
  GROUNDING_SHOWCASE_WEB,
} from '../../../fixtures/showcaseGrounding';
import {
  REASONING_DEMO_FULL_TEXT,
  REASONING_SHOWCASE_BLOCKS,
  REASONING_SHOWCASE_TITLE,
} from '../../../fixtures/showcaseReasoning';
import {
  SKILL_SHOWCASE_HINT,
  SKILL_SHOWCASE_TITLE,
  SKILL_TAG_DEMOS,
} from '../../../fixtures/showcaseSkills';
import {
  TOOL_SHOWCASE_ACCORDIONS,
  TOOL_SHOWCASE_TITLE,
  WORKFLOW_SHOWCASE_COMPLETED,
  WORKFLOW_SHOWCASE_STREAMING,
} from '../../../fixtures/showcaseTools';
import type { InputMenuData, ShowcaseData } from '../../../domain/types';
import { enrichToolPayloads } from '../pluginSettingsSchema';

export function getMockShowcase(): ShowcaseData {
  return {
    reasoning: {
      title: REASONING_SHOWCASE_TITLE,
      demoFullText: REASONING_DEMO_FULL_TEXT,
      blocks: REASONING_SHOWCASE_BLOCKS,
    },
    tools: {
      title: TOOL_SHOWCASE_TITLE,
      accordions: enrichToolPayloads(TOOL_SHOWCASE_ACCORDIONS),
      workflowCompleted: {
        ...WORKFLOW_SHOWCASE_COMPLETED,
        tools: enrichToolPayloads(WORKFLOW_SHOWCASE_COMPLETED.tools),
      },
      workflowStreaming: {
        ...WORKFLOW_SHOWCASE_STREAMING,
        tools: enrichToolPayloads(WORKFLOW_SHOWCASE_STREAMING.tools),
      },
    },
    grounding: {
      title: GROUNDING_SHOWCASE_TITLE,
      web: GROUNDING_SHOWCASE_WEB,
      images: GROUNDING_SHOWCASE_IMAGES,
    },
    portal: {
      title: PORTAL_SHOWCASE_TITLE,
      entries: PORTAL_SHOWCASE_ENTRIES,
      verifyResult: PORTAL_VERIFY_RESULT_2,
    },
    skills: {
      title: SKILL_SHOWCASE_TITLE,
      hint: SKILL_SHOWCASE_HINT,
      tagDemos: SKILL_TAG_DEMOS,
    },
    msgTypes: {
      title: '消息类型示例（supervisor / task / verify / tool / compressedGroup）',
    },
  };
}

export function getMockInputMenu(): InputMenuData {
  return {
    mentionTopics: [
      { kind: 'topic', label: 'Agent 有哪些技能', type: 'topic-skills' },
      { kind: 'topic', label: '看一下这个项目', type: 'topic-changelog' },
      { kind: 'topic', label: '帮我写一个斐波那契数列函数', type: 'topic-fib' },
      { kind: 'topic', label: 'LinkLoom 接入方案', type: 'topic-linkloom' },
    ],
    mentionFiles: [
      { kind: 'file', label: 'studio/src/App.tsx', type: 'file-1', path: 'studio/src/App.tsx' },
      { kind: 'file', label: 'component-mapping.md', type: 'file-2', path: 'component-mapping.md' },
      {
        kind: 'file',
        label: 'docs/superpowers/specs/2026-06-16-studio-full-mock-design.md',
        type: 'file-3',
        path: 'docs/superpowers/specs/2026-06-16-studio-full-mock-design.md',
      },
    ],
    mentionRecent: [
      {
        kind: 'agent',
        label: '收件箱助手',
        type: 'inbox',
        gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6,#ec4899)',
      },
      { kind: 'tag', category: 'skill', label: '网页读取', type: 'linkloom-skills-web-browsing' },
      { kind: 'tag', category: 'tool', label: 'web-browsing', type: 'web-browsing' },
    ],
  };
}
