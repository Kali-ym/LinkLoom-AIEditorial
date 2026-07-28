import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AiBuilderChatTranscript } from './AiBuilderChatTranscript';
import { AiBuilderEmptyChat } from './AiBuilderEmptyChat';
import { AiBuilderInputFooter } from './AiBuilderInputFooter';
import { AiBuilderMobileSessions } from './AiBuilderMobileSessions';
import { AiBuilderSessionList } from './AiBuilderSessionList';
import { MsIcon } from './aiBuilderMsIcon';
import type {
  Agent,
  AiBuilderMention,
  BuilderMode,
  Skill,
  Workflow
} from '../../../services/agentService';
import { useMessageDialog } from '../../../context/MessageDialogContext';
import {
  displaySessionTitle,
  emptyStateCopy,
  formatSessionTime,
  getActiveDraft,
  getActivePlan,
  primaryMention,
  sessionPreview
} from './aiBuilderSessionDisplay';
import { BuilderStateSteps } from './BuilderStateRail';
import { canEnterBuildReview, mergeStateGraphWithGates } from './builderGates';
import { mentionIcon, mentionKey } from './aiBuilderMentions';
import { useAiBuilderSession } from './useAiBuilderSession';
import {
  AI_PROVIDER_TYPE_META,
  AI_PROVIDER_TYPE_ORDER,
  getProviderDisplayName,
  type AIProviderType
} from '../../settings/fields/ai/aiProviderUtils';
import { useAiBuilderActions } from './useAiBuilderActions';
import { useAiBuilderMentions } from './useAiBuilderMentions';
import { useAiBuilderFooterState } from './useAiBuilderFooterState';

export type { AiBuilderSession } from './sessionStorage';
export { createAiBuilderMention } from './aiBuilderMentions';

const BUILDER_MODES = [
  { id: 'chat', label: '对话', icon: 'all_inclusive' },
  { id: 'plan', label: '计划', icon: 'checklist' },
  { id: 'build', label: '构建', icon: 'construction' }
] as const;

const backdropTransition = { duration: 0.32, ease: 'easeOut' as const };
const panelSpring = { type: 'spring' as const, stiffness: 360, damping: 32, mass: 0.85 };

function currentBuilderMode(builderMode?: BuilderMode) {
  return BUILDER_MODES.find((mode) => mode.id === builderMode) || BUILDER_MODES[0];
}

interface AiBuilderPanelProps {
  open: boolean;
  initialMention?: AiBuilderMention | null;
  agents: Agent[];
  skills: Skill[];
  workflows: Workflow[];
  settings?: any;
  onClose: () => void;
  onApplied: () => Promise<void> | void;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
  onInitialMentionConsumed?: () => void;
  onBackgroundActivityChange?: (active: boolean) => void;
}

export const AiBuilderPanel: React.FC<AiBuilderPanelProps> = ({
  open,
  initialMention,
  agents,
  skills,
  workflows,
  settings,
  onClose,
  onApplied,
  onError,
  onSuccess,
  onInitialMentionConsumed,
  onBackgroundActivityChange
}) => {
  const { confirm: showConfirm } = useMessageDialog();
  const providers = Array.isArray(settings?.AI_PROVIDERS) ? settings.AI_PROVIDERS : [];
  const defaultProviderId = settings?.ACTIVE_AI_PROVIDER_ID || providers[0]?.id || '';
  const defaultProvider =
    providers.find((provider: any) => provider.id === defaultProviderId) || providers[0];
  const defaultModel = defaultProvider?.models?.[0] || '';

  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelQuery, setModelQuery] = useState('');
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [portalReady, setPortalReady] = useState(false);

  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const {
    sessions,
    setActiveSessionId,
    activeSession,
    runtimeBySessionId,
    updateActiveSession,
    updateSessionById,
    updateSessionRuntime,
    setActiveStatusText,
    createBlankSession,
    deleteSession,
    abortControllersRef,
    streamRunIdRef
  } = useAiBuilderSession({
    defaultProviderId,
    defaultModel,
    initialMention,
    onInitialMentionConsumed,
    onBackgroundActivityChange
  });

  const builderMode = currentBuilderMode(activeSession?.builderMode || 'chat');
  const planMode = builderMode.id === 'plan';
  const buildMode = builderMode.id === 'build';
  const draft = activeSession?.draft || '';
  const draftMentions = activeSession?.draftMentions || [];

  const {
    isStreaming,
    isApplying,
    dryRunLoading,
    dryRunFailed,
    applyStep,
    applyTotal,
    statusText,
    generateGate,
    applyGate,
    stopActiveRun,
    sendMessage,
    startBuild,
    completeClarification,
    enterBuildFromDraft,
    submitBuildPlanAnswers,
    retryDryRunForActivePlan,
    saveEditedPlanVersion
  } = useAiBuilderActions({
    open,
    activeSession,
    runtimeBySessionId,
    updateSessionRuntime,
    setActiveStatusText,
    updateSessionById,
    abortControllersRef,
    streamRunIdRef,
    builderModeId: builderMode.id,
    buildMode,
    showConfirm,
    onApplied,
    onError,
    onSuccess,
    scrollContainerRef,
    scrollRef,
    setEditorResetKey
  });

  const {
    filteredMentionItems,
    quickMentions,
    applyQuickMention,
    renderMentionChip,
    renderMentionGroup
  } = useAiBuilderMentions(
    agents,
    skills,
    workflows,
    mentionQuery,
    updateActiveSession,
    () => {
      setMentionMenuOpen(false);
      setMentionQuery('');
    },
    () => editorRef.current?.focus()
  );

  const hasOpenClarification = Boolean(activeSession?.activeClarification?.questions?.length);
  const { canStop, canSend, buildFooterPrimaryAction } = useAiBuilderFooterState(
    activeSession,
    buildMode,
    planMode,
    hasOpenClarification,
    draft,
    draftMentions.length,
    isStreaming,
    isApplying,
    dryRunLoading,
    applyGate
  );

  const liveStateGraph = useMemo(
    () =>
      mergeStateGraphWithGates(activeSession?.stateGraph, {
        draft: getActiveDraft(activeSession),
        plan: getActivePlan(activeSession),
        contract:
          activeSession?.planContract ||
          getActivePlan(activeSession)?.contract ||
          getActiveDraft(activeSession)?.contract,
        hasOpenPlanQuestions: hasOpenClarification,
        isStreaming,
        isApplying,
        builderMode: builderMode.id
      }),
    [activeSession, builderMode.id, hasOpenClarification, isApplying, isStreaming]
  );

  const buildReviewGate = useMemo(
    () =>
      canEnterBuildReview({
        draft: getActiveDraft(activeSession),
        plan: getActivePlan(activeSession),
        contract:
          activeSession?.planContract ||
          getActivePlan(activeSession)?.contract ||
          getActiveDraft(activeSession)?.contract,
        hasOpenPlanQuestions: hasOpenClarification,
        isStreaming,
        isApplying,
        builderMode: builderMode.id
      }),
    [activeSession, builderMode.id, hasOpenClarification, isApplying, isStreaming]
  );

  const selectedProviderId = activeSession?.providerId || defaultProviderId;
  const selectedModel = activeSession?.model || defaultModel;
  const selectedConfig = providers.find((provider: any) => provider.id === selectedProviderId);
  const selectedModelLabel = selectedConfig
    ? getProviderDisplayName(selectedConfig)
    : selectedModel;

  const filteredProviderGroups = useMemo(() => {
    const query = modelQuery.trim().toLowerCase();
    return AI_PROVIDER_TYPE_ORDER.map((type) => ({
      type,
      label: AI_PROVIDER_TYPE_META[type].shortLabel,
      configs: providers.filter((provider: any) => {
        if (provider.type !== type || !(provider.models?.length > 0)) return false;
        if (!query) return true;
        const displayName = getProviderDisplayName(provider);
        return (
          displayName.toLowerCase().includes(query) ||
          AI_PROVIDER_TYPE_META[type as AIProviderType].label.toLowerCase().includes(query) ||
          String(provider.models?.[0] || '')
            .toLowerCase()
            .includes(query)
        );
      })
    })).filter((group) => group.configs.length > 0);
  }, [providers, modelQuery]);

  const activePrimaryMention = primaryMention(activeSession);
  const emptyCopy = emptyStateCopy(activePrimaryMention);

  const switchBuilderMode = (mode: BuilderMode) => {
    if (!activeSession || canStop) return;
    if (mode === 'build' && !buildReviewGate.ok) {
      setActiveStatusText(buildReviewGate.reason || '需要先生成构建计划');
      return;
    }
    updateActiveSession({ builderMode: mode });
  };

  const exitBuildReview = (target: 'chat' | 'plan') => {
    if (!activeSession || canStop) return;
    updateActiveSession({ builderMode: target });
  };

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) setMobileSessionsOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const overlay = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="ai-builder-overlay"
          role="dialog"
          aria-modal
          aria-label="AI Builder"
          className="fixed inset-0 z-[60] flex items-stretch justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-3 md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={backdropTransition}
        >
          <motion.div
            className="flex h-[100dvh] w-full flex-row overflow-hidden rounded-none border-0 bg-canvas shadow-modal dark:bg-[#0d1117] sm:h-[min(860px,92vh)] sm:max-w-[1080px] sm:rounded-[22px] sm:border sm:border-hairline-soft dark:sm:border-white/10"
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={panelSpring}
          >
            <aside className="hidden w-72 shrink-0 border-r border-hairline-soft bg-surface-soft/80 dark:border-white/10 dark:bg-canvas/[0.03] md:flex md:flex-col">
              <div className="flex items-center justify-between border-b border-hairline-soft px-4 py-3 dark:border-white/10">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                    AI Builder
                  </h3>
                  <p className="text-xs text-text-slate dark:text-text-stone">
                    本地会话 · 仅保存在本机
                  </p>
                </div>
                <button
                  type="button"
                  onClick={createBlankSession}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white hover:opacity-90 dark:bg-canvas dark:text-text-ink"
                >
                  <MsIcon name="add" size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                <AiBuilderSessionList
                  sessions={sessions}
                  activeSessionId={activeSession?.id}
                  runtimeBySessionId={runtimeBySessionId}
                  displaySessionTitle={displaySessionTitle}
                  sessionPreview={sessionPreview}
                  formatSessionTime={formatSessionTime}
                  onSelectSession={setActiveSessionId}
                  onDeleteSession={deleteSession}
                />
              </div>
            </aside>

            <section className="flex min-w-0 flex-1 flex-col">
              <header className="shrink-0 border-b border-hairline-soft bg-canvas/95 px-3 py-2 sm:px-4 dark:border-white/10 dark:bg-[#0d1117]/95">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileSessionsOpen(true)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-slate hover:bg-surface md:hidden dark:hover:bg-canvas/5"
                    aria-label="打开会话列表"
                  >
                    <MsIcon name="forum" size={18} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold leading-tight text-slate-950 dark:text-white">
                      {(activeSession?.messages.length || 0) > 0
                        ? activeSession
                          ? displaySessionTitle(activeSession)
                          : 'AI Builder'
                        : '新会话'}
                    </h3>
                    {(activeSession?.messages.length || 0) === 0 && (
                      <p className="mt-0.5 text-[11px] leading-tight text-text-stone">
                        在下方输入目标，用 @ 引用要创建或修改的资源
                      </p>
                    )}
                  </div>
                  {(activeSession?.messages.length || 0) > 0 && (
                    <>
                      <BuilderStateSteps
                        graph={liveStateGraph}
                        compact
                        className="inline-flex shrink-0 sm:hidden"
                      />
                      <BuilderStateSteps
                        graph={liveStateGraph}
                        className="hidden shrink-0 sm:inline-flex"
                      />
                    </>
                  )}
                  <button
                    onClick={onClose}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-stone hover:bg-surface dark:hover:bg-canvas/5"
                  >
                    <MsIcon name="close" size={18} />
                  </button>
                </div>
              </header>

              <main
                ref={scrollContainerRef}
                className="min-h-0 flex-1 overflow-y-auto bg-surface-soft dark:bg-[#111827]"
              >
                <div className="mx-auto max-w-4xl space-y-4 px-3 py-4 pb-36 sm:space-y-5 sm:px-6 sm:py-6 sm:pb-6">
                  {(activeSession?.messages.length || 0) === 0 && (
                    <AiBuilderEmptyChat
                      headline={emptyCopy.headline}
                      subtext={emptyCopy.subtext}
                      quickMentions={quickMentions}
                      activePrimaryMention={activePrimaryMention}
                      mentionKey={mentionKey}
                      mentionIcon={mentionIcon}
                      onQuickMention={applyQuickMention}
                    />
                  )}

                  <AiBuilderChatTranscript
                    messages={activeSession?.messages ?? []}
                    statusText={statusText}
                    dryRunLoading={dryRunLoading}
                    dryRunFailed={dryRunFailed}
                    isApplying={isApplying}
                    applyStep={applyStep}
                    applyTotal={applyTotal}
                    generateGate={generateGate}
                    applyGate={applyGate}
                    updateActiveSession={updateActiveSession}
                    enterBuildFromDraft={enterBuildFromDraft}
                    startBuild={startBuild}
                    submitBuildPlanAnswers={submitBuildPlanAnswers}
                    saveEditedPlanVersion={saveEditedPlanVersion}
                    retryDryRunForActivePlan={retryDryRunForActivePlan}
                    renderMentionChip={renderMentionChip}
                  />

                  <div ref={scrollRef} />
                </div>
              </main>

              <AiBuilderInputFooter
                activeSession={activeSession}
                buildMode={buildMode}
                planMode={planMode}
                builderModeId={builderMode.id}
                draft={draft}
                draftMentions={draftMentions}
                hasOpenClarification={hasOpenClarification}
                isStreaming={isStreaming}
                isApplying={isApplying}
                canSend={canSend}
                canStop={canStop}
                applyGate={applyGate}
                buildReviewGate={buildReviewGate}
                buildFooterPrimaryAction={buildFooterPrimaryAction}
                editorRef={editorRef}
                editorResetKey={editorResetKey}
                mentionMenuOpen={mentionMenuOpen}
                filteredMentionItems={filteredMentionItems}
                modelMenuOpen={modelMenuOpen}
                modelQuery={modelQuery}
                selectedProviderId={selectedProviderId}
                selectedModelLabel={selectedModelLabel}
                filteredProviderGroups={filteredProviderGroups}
                renderMentionChip={renderMentionChip}
                renderMentionGroup={renderMentionGroup}
                updateActiveSession={updateActiveSession}
                onMentionMenuOpen={setMentionMenuOpen}
                onMentionQuery={setMentionQuery}
                onModelMenuOpen={setModelMenuOpen}
                onModelQuery={setModelQuery}
                onSelectModel={(providerId, model) => {
                  updateActiveSession({ providerId, model });
                  setModelMenuOpen(false);
                  setModelQuery('');
                }}
                onSwitchBuilderMode={switchBuilderMode}
                onExitBuildReview={exitBuildReview}
                onSendMessage={() => void sendMessage()}
                onStopRun={stopActiveRun}
                onStartBuild={startBuild}
                onSetStatusText={setActiveStatusText}
                onCompleteClarification={completeClarification}
              />
            </section>
          </motion.div>

          <AiBuilderMobileSessions
            open={mobileSessionsOpen}
            sessions={sessions}
            activeSessionId={activeSession?.id}
            runtimeBySessionId={runtimeBySessionId}
            displaySessionTitle={displaySessionTitle}
            sessionPreview={sessionPreview}
            formatSessionTime={formatSessionTime}
            onClose={() => setMobileSessionsOpen(false)}
            onCreateSession={createBlankSession}
            onSelectSession={setActiveSessionId}
            onDeleteSession={deleteSession}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!portalReady) return null;
  return createPortal(overlay, document.body);
};
