import { memo } from 'react';

import { ReferTopicView } from '../../../../shared/editor';
import type { MarkdownElementProps } from '../type';

interface ReferTopicNodeProps {
  id?: string;
  name?: string;
}

/** Render persisted `<refer_topic name="…" id="…" />` tags. */
export const ReferTopicRender = memo(function ReferTopicRender({
  node,
}: MarkdownElementProps<ReferTopicNodeProps>) {
  const topicId = typeof node?.properties?.id === 'string' ? node.properties.id : '';
  const fallbackTitle =
    typeof node?.properties?.name === 'string' ? node.properties.name : undefined;
  if (!topicId && !fallbackTitle) return null;

  return <ReferTopicView fallbackTitle={fallbackTitle} topicId={topicId} />;
});
