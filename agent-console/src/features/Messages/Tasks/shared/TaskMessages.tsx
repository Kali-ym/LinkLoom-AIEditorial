import { Accordion, AccordionItem, Block, Flexbox, Icon, Markdown, ScrollArea, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { ScrollText, Workflow } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';

import { AnimatedNumber } from '../../../../components/AnimatedNumber';
import { NeuralNetworkLoading } from '../../../../components/NeuralNetworkLoading';
import type { AssistantContentBlock } from '../../../../domain/types';
import type { TaskThreadMessage } from '../../../../domain/types/taskMessage';
import { ToolAccordion } from '../../ToolAccordion';
import { countToolCalls, extractTaskBlocks } from './taskBlockUtils';
import { formatDuration, formatElapsedTime } from './utils';

const styles = createStaticStyles(({ css }) => ({
  instructionContent: css`
    overflow: auto;
    max-height: 300px;
  `,
  blocksScroll: css`
    max-height: min(50vh, 300px);
  `,
}));

const InstructionAccordion = memo(function InstructionAccordion({
  childrenCount,
  instruction,
}: {
  childrenCount: number;
  instruction: string;
}) {
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['instruction']);

  useEffect(() => {
    if (childrenCount > 1) setExpandedKeys([]);
  }, [childrenCount]);

  return (
    <Accordion expandedKeys={expandedKeys} gap={8} onExpandedChange={(keys) => setExpandedKeys(keys as string[])}>
      <AccordionItem
        itemKey="instruction"
        paddingBlock={4}
        paddingInline={4}
        title={
          <Flexbox horizontal align="center" gap={8}>
            <Block
              horizontal
              align="center"
              flex="none"
              height={24}
              justify="center"
              variant="outlined"
              width={24}
            >
              <Icon color={cssVar.colorTextSecondary} icon={ScrollText} size={12} />
            </Block>
            <Text type="secondary">任务说明</Text>
          </Flexbox>
        }
      >
        <Block className={styles.instructionContent} padding={12} style={{ marginBlock: 8 }} variant="outlined">
          <Markdown variant="chat">{instruction}</Markdown>
        </Block>
      </AccordionItem>
    </Accordion>
  );
});

const TaskBlocksList = memo(function TaskBlocksList({
  blocks,
  messageId,
}: {
  blocks: AssistantContentBlock[];
  messageId: string;
}) {
  return (
    <ScrollArea className={styles.blocksScroll} scrollFade>
      <Flexbox gap={8} style={{ paddingInlineEnd: 12 }}>
        {blocks.map((block) => {
          const tool = block.tools?.[0];
          if (tool) {
            return (
              <ToolAccordion
                assistantMessageId={messageId}
                key={block.id}
                showActions={false}
                tool={tool}
              />
            );
          }
          if (block.content) {
            return (
              <Block key={block.id} padding={12} variant="outlined">
                <Markdown variant="chat">{block.content}</Markdown>
              </Block>
            );
          }
          return null;
        })}
      </Flexbox>
    </ScrollArea>
  );
});

/** §C.47*/
export const TaskMessages = memo(function TaskMessages({
  instruction,
  isProcessing,
  messages,
  messageId,
  startTime,
  duration,
}: {
  instruction?: string;
  isProcessing?: boolean;
  messages: TaskThreadMessage[];
  messageId: string;
  startTime?: number;
  duration?: number;
}) {
  const blocks = useMemo(() => extractTaskBlocks(messages), [messages]);
  const toolCalls = useMemo(() => countToolCalls(blocks), [blocks]);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime || !isProcessing) return;
    setElapsed(Date.now() - startTime);
    const timer = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    return () => clearInterval(timer);
  }, [isProcessing, startTime]);

  const intermediateBlocks = blocks.length > 1 ? blocks.slice(0, -1) : [];
  const finalBlock = blocks.length > 0 ? blocks[blocks.length - 1] : undefined;

  return (
    <Flexbox gap={12} width="100%">
      {instruction ? (
        <InstructionAccordion childrenCount={blocks.length} instruction={instruction} />
      ) : null}

      {isProcessing ? (
        <Flexbox gap={8}>
          <Flexbox horizontal align="center" gap={8}>
            <Block horizontal align="center" flex="none" height={24} justify="center" variant="outlined" width={24}>
              <NeuralNetworkLoading size={16} />
            </Block>
            <Text type="secondary" weight={500}>
              <AnimatedNumber duration={500} formatter={(v) => String(Math.round(v))} value={toolCalls} />
              {' 次技能调用'}
            </Text>
            {startTime ? (
              <Text type="secondary">（{formatElapsedTime(elapsed)}）</Text>
            ) : null}
          </Flexbox>
          <TaskBlocksList blocks={blocks} messageId={messageId} />
        </Flexbox>
      ) : (
        <Flexbox gap={8}>
          {intermediateBlocks.length > 0 ? (
            <Accordion defaultExpandedKeys={[]} gap={8}>
              <AccordionItem
                itemKey="intermediate"
                paddingBlock={4}
                paddingInline={4}
                title={
                  <Flexbox horizontal align="center" gap={8}>
                    <Block horizontal align="center" flex="none" height={24} justify="center" variant="outlined" width={24}>
                      <Icon color={cssVar.colorTextSecondary} icon={Workflow} size={12} />
                    </Block>
                    <Text type="secondary">
                      中间步骤 · {intermediateBlocks.length}
                      {duration ? ` · ${formatDuration(duration)}` : ''}
                    </Text>
                  </Flexbox>
                }
              >
                <Flexbox gap={8} style={{ marginBlock: 8 }}>
                  <TaskBlocksList blocks={intermediateBlocks} messageId={messageId} />
                </Flexbox>
              </AccordionItem>
            </Accordion>
          ) : null}
          {finalBlock ? <TaskBlocksList blocks={[finalBlock]} messageId={messageId} /> : null}
        </Flexbox>
      )}
    </Flexbox>
  );
});
