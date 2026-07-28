import { Flexbox, Markdown, PreviewGroup } from '@lobehub/ui';
import { Image } from 'antd';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';

import type { GroundingData } from '../../../domain/types';
import type { StaticReasoningBlock } from '../../../domain/types/conversation';
import type { StreamImage } from '../../../domain/types';
import { useConversationMarkdown } from '../User/useConversationMarkdown';
import { GroundingMessage } from '../GroundingMessage';
import { ReasoningBlock } from '../ReasoningBlock';
import { useStreamingContentBuffer } from '../useStreamingContentBuffer';

const styles = createStaticStyles(({ css }) => ({
  imageGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
    width: 100%;
  `,
}));

/** §C.11 content order: Grounding → Reasoning → body → images */
export const AssistantMessageContent = memo(function AssistantMessageContent({
  messageId = 'assistant',
  grounding,
  reasoning,
  content,
  images,
  streaming,
}: {
  messageId?: string;
  grounding?: GroundingData;
  reasoning?: StaticReasoningBlock;
  content?: string;
  images?: StreamImage[];
  streaming?: boolean;
}) {
  const markdownProps = useConversationMarkdown(messageId, 'assistant', { animated: streaming });
  // Let @lobehub/ui's StreamdownRender handle stream smoothing itself — it has
  // block-level memoization and an adaptive CPS smoother (useSmoothStreamContent)
  // that is far cheaper than re-parsing the full growing Markdown each frame.
  // We only buffer when NOT streaming so finalized content commits immediately.
  const markdown = useStreamingContentBuffer(content, streaming);
  const hasContent = Boolean(markdown?.trim());
  // Syntax highlighting (fullFeaturedCodeBlock) is the single most expensive
  // part of Markdown rendering and is wasted during streaming since the code
  // block is still incomplete. Disable it while streaming and re-enable on
  // finalize so long answers stop getting slower as code grows.
  const fullFeaturedCodeBlock = !streaming;

  return (
    <Flexbox gap={8} style={{ width: '100%' }}>
      {grounding && <GroundingMessage data={grounding} />}
      {reasoning && <ReasoningBlock block={reasoning} />}
      {hasContent ? (
        <div className="markdown-body">
          <Markdown
            key={streaming ? `${messageId}-stream` : `${messageId}-final`}
            {...markdownProps}
            animated={streaming}
            enableStream={Boolean(streaming)}
            fullFeaturedCodeBlock={fullFeaturedCodeBlock}
            streamSmoothingPreset="balanced"
            variant="chat"
          >
            {markdown}
          </Markdown>
        </div>
      ) : null}
      {images && images.length > 0 && (
        <PreviewGroup>
          <div className={styles.imageGrid}>
            {images.map((img, index) => (
              <Image
                key={`${img.src}-${index}`}
                alt={img.alt ?? '生成图片'}
                src={img.src}
                style={{ width: '100%', display: 'block', borderRadius: 8 }}
              />
            ))}
          </div>
        </PreviewGroup>
      )}
    </Flexbox>
  );
});
