import { Markdown, ScrollArea } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';

const styles = createStaticStyles(({ css }) => ({
  container: css`
    padding-block: 12px;
    padding-inline: 16px;
    border-radius: 8px;
    font-size: 14px;
  `,
  scrollRoot: css`
    border-radius: 0;
    background: transparent;
  `,
}));

interface StreamingMarkdownProps {
  children?: string;
  maxHeight?: number;
}

/** §C.43*/
export const StreamingMarkdown = memo(function StreamingMarkdown({
  children,
  maxHeight = 400,
}: StreamingMarkdownProps) {
  if (!children) return null;

  return (
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
        className: styles.container,
        style: { maxHeight },
      }}
    >
      <Markdown animated style={{ overflow: 'unset' }} variant="chat">
        {children}
      </Markdown>
    </ScrollArea>
  );
});
