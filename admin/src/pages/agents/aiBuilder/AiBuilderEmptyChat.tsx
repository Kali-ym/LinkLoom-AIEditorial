import { MsIcon } from './aiBuilderMsIcon';
import type { AiBuilderMention } from '../../../services/agentService';

export interface AiBuilderEmptyChatProps {
  headline: string;
  subtext: string;
  quickMentions: AiBuilderMention[];
  activePrimaryMention: AiBuilderMention | null;
  mentionKey: (mention: AiBuilderMention) => string;
  mentionIcon: (mention: AiBuilderMention) => string;
  onQuickMention: (mention: AiBuilderMention, seedDraft: string) => void;
}

export function AiBuilderEmptyChat({
  headline,
  subtext,
  quickMentions,
  activePrimaryMention,
  mentionKey,
  mentionIcon,
  onQuickMention
}: AiBuilderEmptyChatProps) {
  return (
    <div className="mx-auto max-w-2xl py-2 sm:py-8">
      <div className="mb-4 text-center sm:mb-6">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-ink text-white shadow-subtle sm:mb-4 sm:h-14 sm:w-14 dark:bg-canvas dark:text-text-ink">
          <MsIcon name="auto_awesome" size={28} />
        </div>
        <h4 className="text-lg font-semibold leading-snug text-slate-950 sm:text-xl dark:text-white">
          {headline}
        </h4>
        <p className="mx-auto mt-1.5 max-w-xl px-1 text-xs leading-relaxed text-text-slate sm:mt-2 sm:text-sm dark:text-text-stone">
          {subtext}
        </p>
      </div>
      <div className="scroll-x-tabs -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 sm:grid sm:w-full sm:grid-cols-3">
          {quickMentions.map((mention, index) => {
            const selected = Boolean(
              activePrimaryMention && mentionKey(activePrimaryMention) === mentionKey(mention)
            );
            return (
              <button
                key={mentionKey(mention)}
                type="button"
                onClick={() =>
                  onQuickMention(
                    mention,
                    index === 0
                      ? '我想创建一个工作流，目标是：'
                      : index === 1
                        ? '我想创建一个智能体，它需要：'
                        : '我想创建一个技能，用于：'
                  )
                }
                className={`w-[min(72vw,17.5rem)] shrink-0 rounded-2xl border p-3 text-left shadow-subtle transition active:scale-[0.99] sm:w-auto sm:shrink sm:p-4 sm:hover:-translate-y-0.5 sm:hover:shadow-subtle ${
                  selected
                    ? 'border-slate-900 bg-surface-soft ring-1 ring-slate-900/10 dark:border-white/30 dark:bg-canvas/[0.08] dark:ring-white/10'
                    : 'border-hairline-soft bg-canvas hover:border-hairline-strong dark:border-white/10 dark:bg-canvas/[0.04] dark:hover:bg-canvas/[0.07]'
                }`}
              >
                <span
                  className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-xl sm:mb-3 sm:h-8 sm:w-8 sm:rounded-2xl ${
                    selected
                      ? 'bg-ink text-white dark:bg-canvas dark:text-text-ink'
                      : 'bg-surface text-text-charcoal dark:bg-canvas/[0.08] dark:text-text-secondary'
                  }`}
                >
                  <MsIcon name={mentionIcon(mention)} size={17} />
                </span>
                <span className="block text-[13px] font-semibold leading-snug text-text-ink sm:text-sm dark:text-white">
                  {mention.label}
                </span>
                <span className="mt-1 block text-[11px] leading-4 text-text-slate sm:text-xs sm:leading-5 dark:text-text-stone">
                  {mention.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
