import { Block, Markdown } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';

import { CommandBlock } from '../shared/CommandBlock';

const instructionStyles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    padding: 12px;
    border-radius: 8px;
    background: ${cssVar.colorFillQuaternary};
  `,
  instruction: css`
    font-size: 13px;
    color: ${cssVar.colorTextSecondary};
  `,
}));

/** §C.43 — broadcast/speak/callSubAgent instruction box */
export const InstructionMarkdown = memo(function InstructionMarkdown({
  instruction,
}: {
  instruction?: string;
}) {
  if (!instruction) return null;
  return (
    <div className={instructionStyles.container}>
      <div className={instructionStyles.instruction}>
        <Markdown animated variant="chat">
          {instruction}
        </Markdown>
      </div>
    </div>
  );
});

/** §C.43 — updatePrompt / updateAgentPrompt / updateGroupPrompt */
export const MarkdownPromptBlock = memo(function MarkdownPromptBlock({ prompt }: { prompt?: string }) {
  if (!prompt) return null;
  return (
    <Block paddingBlock={8} paddingInline={12} variant="outlined" width="100%">
      <Markdown animated variant="chat">
        {prompt}
      </Markdown>
    </Block>
  );
});

/** §C.43 — runCommand / Bash streaming */
export const RunCommandView = memo(function RunCommandView({
  command,
  animated = true,
  maxHeight = 200,
}: {
  animated?: boolean;
  command?: string;
  maxHeight?: number;
}) {
  return <CommandBlock animated={animated} command={command} commandMaxHeight={maxHeight} />;
});

export const promptBoxStyles = createStaticStyles(({ css, cssVar }) => ({
  promptBox: css`
    padding-block: 8px;
    padding-inline: 12px;
    border-radius: ${cssVar.borderRadiusLG};
    background: ${cssVar.colorFillTertiary};
  `,
  label: css`
    padding-inline-start: 4px;
    font-size: 12px;
    color: ${cssVar.colorTextTertiary};
  `,
}));
