import { Block, Flexbox, Highlighter } from '@lobehub/ui';
import { memo } from 'react';

export interface CommandBlockProps {
  animated?: boolean;
  command?: string;
  commandMaxHeight?: number;
  exitCode?: number;
  output?: string;
  outputMaxHeight?: number;
  stderr?: string;
  stderrMaxHeight?: number;
}

export const CommandBlock = memo(function CommandBlock({
  animated = false,
  command,
  commandMaxHeight = 200,
  exitCode,
  output,
  outputMaxHeight = 240,
  stderr,
  stderrMaxHeight = 120,
}: CommandBlockProps) {
  if (!command && !output && !stderr && exitCode == null) return null;

  return (
    <Flexbox gap={8} style={{ overflow: 'hidden', paddingInline: '8px 0' }}>
      <Block gap={8} padding={8} variant="outlined">
        {command ? (
          <Highlighter
            animated={animated}
            language="sh"
            showLanguage={false}
            style={{ maxHeight: commandMaxHeight, overflow: 'auto', paddingInline: 8 }}
            variant="borderless"
            wrap
          >
            {command}
          </Highlighter>
        ) : null}
        {output ? (
          <Highlighter
            animated={animated}
            language="text"
            showLanguage={false}
            style={{ maxHeight: outputMaxHeight, overflow: 'auto' }}
            variant="borderless"
            wrap
          >
            {output}
          </Highlighter>
        ) : null}
        {stderr ? (
          <Highlighter
            animated={animated}
            language="text"
            showLanguage={false}
            style={{ maxHeight: stderrMaxHeight, overflow: 'auto' }}
            variant="borderless"
            wrap
          >
            {stderr}
          </Highlighter>
        ) : null}
        {exitCode != null ? (
          <Flexbox style={{ fontSize: 12, opacity: 0.7 }}>exit code: {exitCode}</Flexbox>
        ) : null}
      </Block>
    </Flexbox>
  );
});
