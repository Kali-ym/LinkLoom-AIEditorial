import { memo } from 'react';

import { ReferTopicView, type ReferTopicNode } from '../../../shared/editor';

interface ReferTopicProps {
  node: ReferTopicNode;
}

const ReferTopic = memo<ReferTopicProps>(({ node }) => {
  return <ReferTopicView fallbackTitle={node.topicTitle} topicId={node.topicId} />;
});

ReferTopic.displayName = 'ReferTopic';

export default ReferTopic;
