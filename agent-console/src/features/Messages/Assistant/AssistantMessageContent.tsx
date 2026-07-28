import { Flexbox, Markdown, PreviewGroup } from '@lobehub/ui';
import { Image } from 'antd';
import { createStaticStyles } from 'antd-style';
import { memo, useEffect, useRef, useState, type RefObject } from 'react';

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

/** Enable expensive shiki highlighting only when the message is near the viewport. */
function useNearViewport(deferUntilVisible: boolean): [RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(!deferUntilVisible);

  useEffect(() => {
    if (!deferUntilVisible) {
      setNear(true);
      return;
    }
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { root: null, rootMargin: '200px 0px', threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [deferUntilVisible]);

  return [ref, near];
}

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
  const markdown = useStreamingContentBuffer(content, streaming);
  const hasContent = Boolean(markdown?.trim());
  const [rootRef, nearViewport] = useNearViewport(!streaming);
  // Syntax highlighting is expensive; keep it off while streaming and until near viewport.
  const fullFeaturedCodeBlock = !streaming && nearViewport;

  return (
    <Flexbox ref={rootRef} gap={8} style={{ width: '100%' }}>
      {grounding && <GroundingMessage data={grounding} />}
      {reasoning && <ReasoningBlock block={reasoning} />}
      {hasContent ? (
        <div className="markdown-body">
          <Markdown
            key={
              streaming
                ? `${messageId}-stream`
                : fullFeaturedCodeBlock
                  ? `${messageId}-final-hl`
                  : `${messageId}-final`
            }
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
