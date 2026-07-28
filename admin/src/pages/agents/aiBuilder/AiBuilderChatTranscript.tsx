import React from 'react';
import ContentRenderer from '../../../components/UI/ContentRenderer';
import { PlanBuildCard } from './PlanBuildCard';
import { PlanBuildCardSkeleton } from './PlanBuildCardSkeleton';
import { PlanDraftCard } from './PlanDraftCard';
import { PlanDraftCardSkeleton } from './PlanDraftCardSkeleton';
import type { AiBuildPlan, AiBuilderMention, PlanDraft } from '../../../services/agentService';
import type { BuilderGateResult } from './builderGates';
import type { AiBuilderSession, ChatMessage } from './sessionStorage';
import { MsIcon } from './aiBuilderMsIcon';

export function visibleAssistantText(text: string) {
  const markerIndex = text.indexOf('AI_BUILD_PLAN_JSON');
  const withoutPlan = markerIndex >= 0 ? text.slice(0, markerIndex) : text;
  return withoutPlan.replace(/```json[\s\S]*$/i, '').trimEnd();
}

export function splitAssistantPlanContent(text: string) {
  const markerIndex = text.indexOf('AI_BUILD_PLAN_JSON');
  if (markerIndex < 0) {
    return { prose: visibleAssistantText(text), json: null as string | null, streamingJson: false };
  }
  const prose = text.slice(0, markerIndex).trim();
  const tail = text.slice(markerIndex);
  const fenced = tail.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return { prose, json: fenced[1].trim(), streamingJson: false };
  }
  const partial = tail
    .replace(/^AI_BUILD_PLAN_JSON\s*/i, '')
    .replace(/^```(?:json)?\s*/i, '')
    .trim();
  return { prose, json: partial || null, streamingJson: true };
}

function renderAssistantContent(content: string, pending?: boolean) {
  if (!content) return pending ? '正在思考...' : '';
  const { prose, json, streamingJson } = splitAssistantPlanContent(content);
  return (
    <>
      {prose ? (
        <ContentRenderer
          content={prose}
          className="text-sm prose-sm [&_*]:max-w-full [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
        />
      ) : null}
      {json ? (
        <details
          className={`overflow-hidden rounded-2xl border border-hairline-soft bg-surface-soft dark:border-white/10 dark:bg-black/20 ${prose ? 'mt-3' : ''}`}
        >
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-text-slate dark:text-text-stone">
            {streamingJson && pending ? '正在生成计划 JSON...' : '计划 JSON'}
          </summary>
          <pre className="max-h-64 overflow-auto border-t border-hairline-soft p-3 text-[11px] text-text-charcoal dark:border-white/10 dark:text-text-secondary">
            {json}
          </pre>
        </details>
      ) : null}
      {!prose && !json && pending ? '正在思考...' : null}
      {!prose && !json && !pending ? (
        <ContentRenderer
          content={visibleAssistantText(content)}
          className="text-sm prose-sm [&_*]:max-w-full [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
        />
      ) : null}
    </>
  );
}

export interface AiBuilderChatTranscriptProps {
  messages: ChatMessage[];
  statusText: string;
  dryRunLoading: boolean;
  dryRunFailed: boolean;
  isApplying: boolean;
  applyStep?: number;
  applyTotal?: number;
  generateGate: BuilderGateResult;
  applyGate: BuilderGateResult;
  updateActiveSession: (
    patch: Partial<AiBuilderSession> | ((session: AiBuilderSession) => Partial<AiBuilderSession>)
  ) => void;
  enterBuildFromDraft: (draft: PlanDraft) => void;
  startBuild: (plan: AiBuildPlan) => void | Promise<void>;
  submitBuildPlanAnswers: (answers: Record<string, unknown>) => void;
  saveEditedPlanVersion: (sourceMessageId: string, editedPlan: AiBuildPlan) => void;
  retryDryRunForActivePlan: () => void;
  renderMentionChip: (mention: AiBuilderMention, removable?: boolean) => React.ReactNode;
}

export function AiBuilderChatTranscript({
  messages,
  statusText,
  dryRunLoading,
  dryRunFailed,
  isApplying,
  applyStep,
  applyTotal,
  generateGate,
  applyGate,
  updateActiveSession,
  enterBuildFromDraft,
  startBuild,
  submitBuildPlanAnswers,
  saveEditedPlanVersion,
  retryDryRunForActivePlan,
  renderMentionChip
}: AiBuilderChatTranscriptProps) {
  return (
    <>
      {messages.map((message) => {
        if (message.kind === 'questions_artifact') {
          return (
            <div key={message.id} className="flex gap-3 justify-start">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-blue-700 text-white">
                <MsIcon name="quiz" size={18} />
              </div>
              <div className="max-w-[88%] rounded-2xl border border-hairline-soft bg-canvas px-4 py-3 text-sm leading-6 text-text-ink shadow-subtle dark:border-white/10 dark:bg-canvas/[0.05] dark:text-slate-100">
                {message.content || '我需要先确认几个关键问题，请在下方澄清面板中回答。'}
              </div>
            </div>
          );
        }
        if (message.kind === 'planning_artifact_pending') {
          return (
            <div
              key={message.id}
              className="flex gap-3 justify-start scroll-mt-24"
              data-plan-message-id={message.id}
              data-draft-placeholder="true"
            >
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-indigo-700 text-white">
                <MsIcon name="route" size={18} />
              </div>
              <div className="max-w-full sm:max-w-[88%] flex-1">
                <PlanDraftCardSkeleton statusText={statusText || message.content} />
              </div>
            </div>
          );
        }
        if (message.kind === 'planning_artifact' && message.draftSnapshot) {
          return (
            <div
              key={message.id}
              className="flex gap-3 justify-start scroll-mt-24"
              data-plan-message-id={message.id}
            >
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-indigo-700 text-white">
                <MsIcon name="route" size={18} />
              </div>
              <div className="max-w-full sm:max-w-[88%] flex-1">
                <PlanDraftCard
                  draft={message.draftSnapshot}
                  collapsed={message.collapsed === true}
                  superseded={message.superseded}
                  generateBlockedReason={generateGate.ok ? undefined : generateGate.reason}
                  onToggleCollapse={() =>
                    updateActiveSession((session) => ({
                      messages: session.messages.map((item) =>
                        item.id === message.id
                          ? { ...item, collapsed: item.collapsed !== true }
                          : item
                      )
                    }))
                  }
                  onEnterBuild={() => enterBuildFromDraft(message.draftSnapshot!)}
                />
              </div>
            </div>
          );
        }
        if (message.kind === 'plan_artifact_pending') {
          return (
            <div
              key={message.id}
              className="flex gap-3 justify-start scroll-mt-24"
              data-plan-artifact
              data-plan-message-id={message.id}
              data-plan-placeholder="true"
            >
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-ink text-white dark:bg-canvas dark:text-text-ink">
                <MsIcon name="checklist" size={18} />
              </div>
              <div className="max-w-full sm:max-w-[88%] flex-1">
                <PlanBuildCardSkeleton statusText={statusText || message.content} />
              </div>
            </div>
          );
        }
        if (message.kind === 'plan_artifact' && message.planSnapshot) {
          return (
            <div
              key={message.id}
              className="flex gap-3 justify-start scroll-mt-24"
              data-plan-artifact
              data-plan-message-id={message.id}
              data-plan-id={message.planSnapshot.id}
              data-plan-active={!message.superseded ? 'true' : undefined}
              data-plan-superseded={message.superseded ? 'true' : undefined}
            >
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-ink text-white dark:bg-canvas dark:text-text-ink">
                <MsIcon name="checklist" size={18} />
              </div>
              <div className="max-w-full sm:max-w-[88%] flex-1">
                <PlanBuildCard
                  plan={message.planSnapshot}
                  collapsed={message.collapsed === true}
                  superseded={message.superseded}
                  dryRunLoading={
                    dryRunLoading && !message.superseded && !message.planSnapshot.dryRun
                  }
                  dryRunFailed={dryRunFailed && !message.superseded && !message.planSnapshot.dryRun}
                  applyStep={
                    isApplying && !message.superseded && message.planSnapshot.status === 'building'
                      ? applyStep
                      : undefined
                  }
                  applyTotal={
                    isApplying && !message.superseded && message.planSnapshot.status === 'building'
                      ? applyTotal
                      : undefined
                  }
                  onRetryDryRun={() => retryDryRunForActivePlan()}
                  buildLog={message.buildLog}
                  buildResult={message.buildResult}
                  buildError={message.buildError}
                  applyBlockedReason={applyGate.ok ? undefined : applyGate.reason}
                  onToggleCollapse={() =>
                    updateActiveSession((session) => ({
                      messages: session.messages.map((item) =>
                        item.id === message.id
                          ? { ...item, collapsed: item.collapsed !== true }
                          : item
                      )
                    }))
                  }
                  onStartBuild={() => void startBuild(message.planSnapshot!)}
                  onAnswersSubmit={submitBuildPlanAnswers}
                  onPlanEdited={(plan) => saveEditedPlanVersion(message.id, plan)}
                />
              </div>
            </div>
          );
        }
        return (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-ink text-white dark:bg-canvas dark:text-text-ink">
                <MsIcon name="auto_awesome" size={18} />
              </div>
            )}
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-subtle ${
                message.role === 'user'
                  ? 'bg-ink text-white dark:bg-canvas dark:text-text-ink'
                  : 'border border-hairline-soft bg-canvas text-text-ink dark:border-white/10 dark:bg-canvas/[0.05] dark:text-slate-100'
              }`}
            >
              {message.role === 'user' ? (
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                  {message.mentions?.map((mention) => renderMentionChip(mention))}
                  {message.content ? (
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  ) : null}
                </div>
              ) : (
                renderAssistantContent(message.content, message.pending)
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
