import { Accordion, AccordionItem, Markdown, ScrollArea } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo, useEffect, useMemo, useState, type RefObject } from 'react';

import type { StaticReasoningBlock } from '../../domain/types/conversation';
import { ThinkingTitle } from './Thinking/ThinkingTitle';
import { useAutoScroll } from './useAutoScroll';

const styles = createStaticStyles(({ css }) => ({
  contentScroll: css`
    max-height: min(40vh, 320px);
    padding-block-end: 8px;
    padding-inline: 8px;
    color: ${cssVar.colorTextDescription};

    article * {
      color: ${cssVar.colorTextDescription};
    }
  `,
  scrollRoot: css`
    border-radius: 0;
    background: transparent;
  `,
}));

/** §C.3 Thinking — Accordion + ScrollArea + Markdown */
export const ReasoningBlock = memo(function ReasoningBlock({
  block,
}: {
  block: StaticReasoningBlock;
}) {
  const thinking = block.thinking ?? false;
  const [showDetail, setShowDetail] = useState(block.open || thinking);

  const content = useMemo(
    () => block.paragraphs.filter((p) => p.trim()).join('\n\n'),
    [block.paragraphs],
  );
  const hasBody = content.length > 0;

  const { ref, handleScroll } = useAutoScroll<HTMLDivElement>({
    deps: [content, showDetail],
    enabled: !!thinking && showDetail && hasBody,
    threshold: 120,
  });

  useEffect(() => {
    setShowDetail(thinking && hasBody);
  }, [thinking, hasBody]);

  const shouldRender = thinking || content.length > 0;
  if (!shouldRender) return null;

  return (
    <Accordion
      data-reasoning
      data-thinking={thinking ? 'true' : 'false'}
      data-type="reasoning"
      expandedKeys={showDetail && hasBody ? ['thinking'] : []}
      gap={8}
      id={block.id}
      onExpandedChange={(keys) => {
        if (thinking) return;
        setShowDetail(keys.length > 0);
      }}
    >
      <AccordionItem
        itemKey="thinking"
        paddingBlock={4}
        paddingInline={4}
        title={
          <ThinkingTitle
            label={block.label}
            showDetail={showDetail}
            thinking={thinking}
          />
        }
      >
        {hasBody ? (
          <ScrollArea
            disableContentFit
            scrollFade
            className={styles.scrollRoot}
            contentProps={{
              style: {
                color: 'inherit',
                display: 'block',
                fontSize: 'inherit',
                gap: 0,
                lineHeight: 'inherit',
              },
            }}
            viewportProps={{
              className: styles.contentScroll,
              ref: ref as RefObject<HTMLDivElement>,
              onScroll: handleScroll,
            }}
          >
            <Markdown animated={thinking} streamSmoothingPreset="realtime" variant="chat">
              {content}
            </Markdown>
          </ScrollArea>
        ) : null}
      </AccordionItem>
    </Accordion>
  );
});
