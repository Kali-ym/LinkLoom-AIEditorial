import { createRemarkSelfClosingTagPlugin } from '../remarkPlugins/createRemarkSelfClosingTagPlugin';
import type { MarkdownElement } from './type';
import { LocalFileRender } from './LocalFile/Render';
import { MentionRender } from './Mention/Render';
import { ReferTopicRender } from './ReferTopic/Render';
import { SkillRender } from './Skill/Render';
import { ToolRender } from './Tool/Render';

export const SKILL_TAG = 'skill';
export const TOOL_TAG = 'tool';
export const MENTION_TAG = 'mention';
export const LOCAL_FILE_TAG = 'localFile';
export const REFER_TOPIC_TAG = 'refer_topic';

export const userMarkdownElements: MarkdownElement[] = [
  {
    Component: MentionRender,
    remarkPlugin: createRemarkSelfClosingTagPlugin(MENTION_TAG),
    scope: 'user',
    tag: MENTION_TAG,
  },
  {
    Component: LocalFileRender,
    remarkPlugin: createRemarkSelfClosingTagPlugin(LOCAL_FILE_TAG),
    scope: 'user',
    tag: LOCAL_FILE_TAG,
  },
  {
    Component: ReferTopicRender,
    remarkPlugin: createRemarkSelfClosingTagPlugin(REFER_TOPIC_TAG),
    scope: 'user',
    tag: REFER_TOPIC_TAG,
  },
  {
    Component: SkillRender,
    remarkPlugin: createRemarkSelfClosingTagPlugin(SKILL_TAG),
    scope: 'user',
    tag: SKILL_TAG,
  },
  {
    Component: ToolRender,
    remarkPlugin: createRemarkSelfClosingTagPlugin(TOOL_TAG),
    scope: 'user',
    tag: TOOL_TAG,
  },
];
