import React from 'react';
import { InlineMentionEditor } from './InlineMentionEditor';
import { PlanClarificationSheet } from './PlanClarificationSheet';
import { MsIcon } from './aiBuilderMsIcon';
import type { AiBuilderMention, AiBuildPlan, BuilderMode } from '../../../services/agentService';
import { getActivePlan } from './aiBuilderSessionDisplay';
import { mentionIcon, mentionKey, mentionText, uniqueMentions } from './aiBuilderMentions';
import type { AiBuilderSession } from './sessionStorage';
import {
  getProviderDisplayName,
  type AIProviderType
} from '../../settings/fields/ai/aiProviderUtils';

const BUILDER_MODES = [
  { id: 'chat', label: '对话', icon: 'all_inclusive' },
  { id: 'plan', label: '计划', icon: 'checklist' },
  { id: 'build', label: '构建', icon: 'construction' }
] as const;

export interface AiBuilderInputFooterProps {
  activeSession?: AiBuilderSession;
  buildMode: boolean;
  planMode: boolean;
  builderModeId: BuilderMode;
  draft: string;
  draftMentions: AiBuilderMention[];
  hasOpenClarification: boolean;
  isStreaming: boolean;
  isApplying: boolean;
  canSend: boolean;
  canStop: boolean;
  applyGate: { ok: boolean; reason?: string };
  buildReviewGate: { ok: boolean; reason?: string };
  buildFooterPrimaryAction: {
    id: 'confirm_apply';
    label: string;
    disabled: boolean;
  } | null;
  editorRef: React.RefObject<HTMLDivElement | null>;
  editorResetKey: number;
  mentionMenuOpen: boolean;
  filteredMentionItems: {
    agents: AiBuilderMention[];
    skills: AiBuilderMention[];
    workflows: AiBuilderMention[];
  };
  modelMenuOpen: boolean;
  modelQuery: string;
  selectedProviderId: string;
  selectedModelLabel: string;
  filteredProviderGroups: Array<{
    type: AIProviderType;
    label: string;
    configs: Array<{ id: string; name?: string; models: string[]; type?: string }>;
  }>;
  renderMentionChip: (mention: AiBuilderMention, removable?: boolean) => React.ReactNode;
  renderMentionGroup: (title: string, items: AiBuilderMention[]) => React.ReactNode;
  updateActiveSession: (
    patch: Partial<AiBuilderSession> | ((session: AiBuilderSession) => Partial<AiBuilderSession>)
  ) => void;
  onMentionMenuOpen: (open: boolean) => void;
  onMentionQuery: (query: string) => void;
  onModelMenuOpen: (open: boolean) => void;
  onModelQuery: (query: string) => void;
  onSelectModel: (providerId: string, model: string) => void;
  onSwitchBuilderMode: (mode: BuilderMode) => void;
  onExitBuildReview: (target: 'chat' | 'plan') => void;
  onSendMessage: () => void;
  onStopRun: () => void;
  onStartBuild: (plan: AiBuildPlan) => void;
  onSetStatusText: (message: string) => void;
  onCompleteClarification: (answers: Record<string, unknown>) => void;
}

export const AiBuilderInputFooter: React.FC<AiBuilderInputFooterProps> = ({
  activeSession,
  buildMode,
  planMode,
  builderModeId,
  draft,
  draftMentions,
  hasOpenClarification,
  isStreaming,
  isApplying,
  canSend,
  canStop,
  applyGate,
  buildReviewGate,
  buildFooterPrimaryAction,
  editorRef,
  editorResetKey,
  mentionMenuOpen,
  filteredMentionItems,
  modelMenuOpen,
  modelQuery,
  selectedProviderId,
  selectedModelLabel,
  filteredProviderGroups,
  renderMentionGroup,
  updateActiveSession,
  onMentionMenuOpen,
  onMentionQuery,
  onModelMenuOpen,
  onModelQuery,
  onSelectModel,
  onSwitchBuilderMode,
  onExitBuildReview,
  onSendMessage,
  onStopRun,
  onStartBuild,
  onSetStatusText,
  onCompleteClarification
}) => (
  <footer className="shrink-0 border-t border-hairline-soft bg-canvas px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-3 dark:border-white/10 dark:bg-[#0d1117]">
    <div className="mx-auto max-w-4xl space-y-2">
      {hasOpenClarification && activeSession?.activeClarification && (
        <PlanClarificationSheet
          questions={activeSession.activeClarification.questions}
          step={activeSession.activeClarification.step}
          answers={activeSession.planAnswers || {}}
          busy={isStreaming}
          onStepChange={(step) =>
            updateActiveSession((session) => ({
              activeClarification: session.activeClarification
                ? { ...session.activeClarification, step }
                : null
            }))
          }
          onAnswersChange={(answers) => updateActiveSession({ planAnswers: answers })}
          onComplete={onCompleteClarification}
        />
      )}
      <div className="relative rounded-2xl border border-hairline-soft bg-canvas p-2 shadow-subtle dark:border-white/10 dark:bg-canvas/[0.03]">
        {!buildMode && (
          <div
            className="min-h-[52px] cursor-text rounded-2xl px-2 py-1.5 sm:min-h-[74px] sm:px-3 sm:py-2"
            onClick={() => editorRef.current?.focus()}
          >
            <InlineMentionEditor
              editorRef={editorRef}
              sessionKey={activeSession?.id}
              resetKey={editorResetKey}
              draft={draft}
              mentions={draftMentions}
              readOnly={false}
              placeholder="..."
              mentionKey={mentionKey}
              mentionText={mentionText}
              mentionIcon={mentionIcon}
              onChange={(nextDraft, nextMentions) => {
                updateActiveSession((session) => {
                  const nextDraftMentions = uniqueMentions(nextMentions);
                  const nextKeys = new Set(nextDraftMentions.map(mentionKey));
                  return {
                    draft: nextDraft,
                    draftMentions: nextDraftMentions,
                    mentions: session.mentions.filter(
                      (mention) =>
                        nextKeys.has(mentionKey(mention)) ||
                        session.messages.some((message) =>
                          (message.mentions || []).some(
                            (item) => mentionKey(item) === mentionKey(mention)
                          )
                        )
                    )
                  };
                });
              }}
              onAtQuery={(query, open) => {
                onMentionMenuOpen(open);
                onMentionQuery(query);
              }}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  (event.metaKey || event.ctrlKey) &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                  onSendMessage();
                }
              }}
            />
          </div>
        )}

        {mentionMenuOpen && !buildMode && (
          <div
            className="absolute bottom-[calc(100%+8px)] left-2 z-30 max-h-96 w-[min(560px,calc(100vw-3rem))] overflow-y-auto rounded-2xl border border-hairline-soft bg-canvas p-2 shadow-xl dark:border-white/10 dark:bg-[#151b26]"
            onMouseDown={(event) => event.preventDefault()}
          >
            {renderMentionGroup('智能体', filteredMentionItems.agents)}
            {renderMentionGroup('技能', filteredMentionItems.skills)}
            {renderMentionGroup('工作流', filteredMentionItems.workflows)}
          </div>
        )}

        <div className="flex flex-col gap-2 px-1 pb-0.5 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:px-2 sm:pb-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {buildMode ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-8 items-center rounded-full bg-amber-50 px-3 text-xs font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-100">
                  构建审阅
                </span>
                <button
                  type="button"
                  disabled={canStop}
                  onClick={() => onExitBuildReview('plan')}
                  className="inline-flex h-8 items-center rounded-full border border-hairline-soft px-3 text-xs font-medium text-text-charcoal hover:bg-surface-soft disabled:opacity-50 dark:border-white/10 dark:text-text-stone dark:hover:bg-canvas/[0.06]"
                >
                  回到计划
                </button>
                <button
                  type="button"
                  disabled={canStop}
                  onClick={() => onExitBuildReview('chat')}
                  className="inline-flex h-8 items-center rounded-full border border-hairline-soft px-3 text-xs font-medium text-text-charcoal hover:bg-surface-soft disabled:opacity-50 dark:border-white/10 dark:text-text-stone dark:hover:bg-canvas/[0.06]"
                >
                  回到对话
                </button>
              </div>
            ) : (
              <div className="scroll-x-tabs max-w-full shrink-0">
                <div className="inline-flex w-max flex-nowrap rounded-full border border-hairline-soft bg-canvas p-0.5 dark:border-white/10 dark:bg-canvas/[0.04]">
                  {BUILDER_MODES.map((mode) => {
                    const disabled = mode.id === 'build' ? !buildReviewGate.ok : false;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => onSwitchBuilderMode(mode.id)}
                        disabled={disabled}
                        title={disabled ? buildReviewGate.reason : undefined}
                        className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                          builderModeId === mode.id
                            ? 'bg-ink text-white dark:bg-canvas dark:text-text-ink'
                            : 'text-text-charcoal hover:bg-surface-soft dark:text-text-stone dark:hover:bg-canvas/[0.06]'
                        }`}
                      >
                        <MsIcon name={mode.icon} size={14} />
                        <span className="whitespace-nowrap">{mode.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!buildMode && (
              <div className="relative min-w-0 flex-1 sm:flex-none">
                <button
                  type="button"
                  onClick={() => onModelMenuOpen(!modelMenuOpen)}
                  className="inline-flex h-8 w-full max-w-full items-center gap-1.5 rounded-full border border-hairline-soft bg-canvas px-2.5 text-xs font-medium text-text-charcoal hover:bg-surface-soft sm:max-w-[220px] dark:border-white/10 dark:bg-canvas/[0.04] dark:text-text-secondary dark:hover:bg-canvas/[0.08]"
                >
                  <MsIcon
                    name="neurology"
                    size={14}
                    className="text-text-charcoal dark:text-text-stone"
                  />
                  <span className="truncate">{selectedModelLabel || '未选择'}</span>
                  <MsIcon name="expand_more" size={14} className="text-text-stone" />
                </button>
                {modelMenuOpen && (
                  <div className="absolute bottom-[calc(100%+8px)] left-0 z-20 w-[min(calc(100vw-2rem),20rem)] sm:w-80 overflow-hidden rounded-2xl border border-hairline-soft bg-canvas shadow-xl dark:border-white/10 dark:bg-[#151b26]">
                    <input
                      value={modelQuery}
                      onChange={(event) => onModelQuery(event.target.value)}
                      placeholder="搜索模型"
                      className="w-full border-b border-hairline-soft bg-transparent px-4 py-3 text-sm outline-none placeholder:text-text-stone dark:border-white/10 dark:text-white"
                    />
                    <div className="max-h-80 overflow-y-auto">
                      {filteredProviderGroups.map((group, index) => (
                        <div
                          key={group.type}
                          className={
                            index > 0 ? 'border-t border-hairline-soft dark:border-white/10' : ''
                          }
                        >
                          <p className="px-4 pt-3 text-[11px] font-semibold text-text-stone">
                            {group.label}
                          </p>
                          {group.configs.map((config) => {
                            const model = config.models?.[0] || '';
                            return (
                              <button
                                key={config.id}
                                type="button"
                                onClick={() => onSelectModel(config.id, model)}
                                className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm text-text-charcoal hover:bg-surface dark:text-text-secondary dark:hover:bg-canvas/[0.06]"
                              >
                                <span className="truncate">{getProviderDisplayName(config)}</span>
                                {selectedProviderId === config.id && (
                                  <MsIcon name="check" size={18} className="text-text-slate" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:ml-auto sm:w-auto">
            <button
              onClick={
                canStop
                  ? onStopRun
                  : buildMode && buildFooterPrimaryAction && !buildFooterPrimaryAction.disabled
                    ? () => {
                        const plan = getActivePlan(activeSession);
                        if (plan && applyGate.ok) onStartBuild(plan);
                        else if (applyGate.reason) onSetStatusText(applyGate.reason);
                      }
                    : onSendMessage
              }
              disabled={
                !canStop &&
                (buildMode
                  ? !buildFooterPrimaryAction || buildFooterPrimaryAction.disabled
                  : !canSend)
              }
              className={`inline-flex h-9 items-center gap-1.5 rounded-2xl px-4 text-xs font-semibold hover:opacity-90 disabled:opacity-50 ${
                canStop
                  ? 'border border-coral-light text-coral-dark hover:bg-coral-light dark:border-red-500/30 dark:text-red-300 dark:hover:bg-brand-coral/10'
                  : buildMode && buildFooterPrimaryAction && !buildFooterPrimaryAction.disabled
                    ? 'bg-ink text-white hover:bg-charcoal'
                    : 'bg-ink text-white dark:bg-canvas dark:text-text-ink'
              }`}
            >
              <MsIcon
                name={
                  canStop
                    ? 'stop_circle'
                    : buildMode && buildFooterPrimaryAction && !buildFooterPrimaryAction.disabled
                      ? 'check_circle'
                      : 'send'
                }
                size={16}
              />
              {canStop
                ? isApplying
                  ? '取消构建'
                  : '中断'
                : buildMode
                  ? buildFooterPrimaryAction?.label || '等待审阅'
                  : planMode
                    ? '发送到计划'
                    : '发送'}
            </button>
          </div>
        </div>
      </div>
    </div>
  </footer>
);
