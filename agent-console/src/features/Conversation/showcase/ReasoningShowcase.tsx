import { memo, useEffect, useMemo, useState } from 'react';

import type { StaticReasoningBlock } from '../../../domain/types/conversation';
import { useWorkspaceStore } from '../../../stores';
import { ReasoningBlock } from '../../Messages/ReasoningBlock';
import { ShowcasePanel } from './ShowcasePanel';
import { showcaseStyles } from './showcaseStyles';

function toStaticBlock(
  block: {
    id?: string;
    label: string;
    thinking: boolean;
    open: boolean;
    duration?: string;
    content: string;
  },
  index: number,
): StaticReasoningBlock {
  return {
    id: block.id ?? `reasoning-showcase-${index}`,
    label: block.label,
    duration: block.duration ?? '0',
    thinking: block.thinking,
    open: block.open,
    paragraphs: block.content.split('\n\n'),
  };
}

/** index.html `#reasoningDemoLive` — 循环演示流式思考 → 完成折叠 */
const ReasoningLiveDemo = memo(function ReasoningLiveDemo({
  demoFullText,
}: {
  demoFullText: string;
}) {
  const parts = useMemo(
    () => demoFullText.match(/.{1,4}/g) ?? [demoFullText],
    [demoFullText],
  );
  const [thinking, setThinking] = useState(true);
  const [open, setOpen] = useState(true);
  const [label, setLabel] = useState('思考中…');
  const [paragraphs, setParagraphs] = useState<string[]>(['']);

  const liveBlock = useMemo(
    (): StaticReasoningBlock => ({
      id: 'reasoningDemoLive',
      label,
      duration: '1.1',
      thinking,
      open,
      paragraphs,
    }),
    [label, thinking, open, paragraphs],
  );

  useEffect(() => {
    let idx = 0;
    let phase: 'stream' | 'done' | 'wait' = 'stream';
    let timer: ReturnType<typeof setTimeout> | undefined;

    const reset = () => {
      setThinking(true);
      setOpen(true);
      setLabel('思考中…');
      setParagraphs(['']);
      idx = 0;
      phase = 'stream';
    };

    const tick = () => {
      if (phase === 'stream') {
        if (idx < parts.length) {
          setParagraphs([parts.slice(0, idx + 1).join('')]);
          idx += 1;
          timer = setTimeout(tick, 70);
        } else {
          phase = 'done';
          timer = setTimeout(tick, 700);
        }
      } else if (phase === 'done') {
        setThinking(false);
        setOpen(false);
        setLabel('已深度思考（1.1s）');
        phase = 'wait';
        timer = setTimeout(() => {
          reset();
          tick();
        }, 3000);
      }
    };

    reset();
    tick();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [parts]);

  return <ReasoningBlock block={liveBlock} />;
});

export const ReasoningShowcase = memo(function ReasoningShowcase() {
  const showcase = useWorkspaceStore((s) => s.showcase.reasoning);
  const staticBlocks = showcase.blocks
    .filter((b) => !b.streamChunks)
    .map((block, index) => toStaticBlock(block, index));

  return (
    <ShowcasePanel itemKey="reasoning" title={showcase.title}>
      <div className={showcaseStyles.reasoningDemoGrid}>
        <ReasoningLiveDemo demoFullText={showcase.demoFullText} />
        {staticBlocks.map((block) => (
          <ReasoningBlock key={block.id} block={block} />
        ))}
      </div>
    </ShowcasePanel>
  );
});
