import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type RefObject
} from 'react';
import { aiBuilderUi } from '../../../copy/aiBuilderUi';
import type {
  AiBuildDryRunResult,
  AiBuildPlan,
  AiBuilderMention,
  BuilderCheckpoint,
  BuilderMode,
  PlanDraft,
  PlanLineage
} from '../../../services/agentService';
import { agentService } from '../../../services/agentService';
import { summarizeAnswers } from './aiBuilderAnswers';
import { buildApplyConfirmDialog } from './builderApplyConfirm';
import {
  canApplyBuildPlan,
  canGenerateBuildPlan,
  mergeStateGraphWithGates,
  type BuilderGateContext
} from './builderGates';
import { extractPlanReflectionText, getActiveDraft, getActivePlan } from './aiBuilderSessionDisplay';
import { estimateTokens, uniqueMentions } from './aiBuilderMentions';
import {
  SUMMARY_TOKEN_LIMIT,
  collapseAllDraftArtifacts,
  collapseOlderDraftArtifacts,
  collapseOlderPlanArtifacts,
  withoutPendingArtifactIds,
  withoutPendingArtifacts
} from './sessionStorage';
import type { AiBuilderSession, ChatMessage, SessionRuntime } from './sessionStorage';

export interface UseAiBuilderActionsOptions {
  open: boolean;
  activeSession: AiBuilderSession | undefined;
  runtimeBySessionId: Record<string, SessionRuntime>;
  updateSessionRuntime: (sessionId: string, patch: Partial<SessionRuntime>) => void;
  setActiveStatusText: (message: string) => void;
  updateSessionById: (
    sessionId: string,
    patch: Partial<AiBuilderSession> | ((session: AiBuilderSession) => Partial<AiBuilderSession>)
  ) => void;
  abortControllersRef: MutableRefObject<Record<string, AbortController | null>>;
  streamRunIdRef: MutableRefObject<Record<string, number>>;
  builderModeId: BuilderMode;
  buildMode: boolean;
  showConfirm: (options: ReturnType<typeof buildApplyConfirmDialog>) => Promise<boolean>;
  onApplied: () => Promise<void> | void;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
  scrollContainerRef: RefObject<HTMLElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>;
  setEditorResetKey: React.Dispatch<React.SetStateAction<number>>;
}

function sessionBuilderMode(session: AiBuilderSession | undefined): BuilderMode {
  const mode = session?.builderMode;
  return mode === 'plan' || mode === 'build' ? mode : 'chat';
}

export function useAiBuilderActions({
  open,
  activeSession,
  runtimeBySessionId,
  updateSessionRuntime,
  setActiveStatusText,
  updateSessionById,
  abortControllersRef,
  streamRunIdRef,
  builderModeId,
  buildMode,
  showConfirm,
  onApplied,
  onError,
  onSuccess,
  scrollContainerRef,
  scrollRef,
  setEditorResetKey
}: UseAiBuilderActionsOptions) {
  const pendingPlanFocusRef = useRef<{
    sessionId: string;
    messageId?: string;
    planId?: string;
  } | null>(null);
  const streamAssistantIdRef = useRef<Record<string, string | null>>({});
  const dryRunAutoAttemptRef = useRef<Set<string>>(new Set());

  const activeRuntime = runtimeBySessionId[activeSession?.id || ''] || {
    isStreaming: false,
    isApplying: false,
    statusText: '',
    dryRunLoading: false,
    dryRunFailed: false
  };
  const isStreaming = activeRuntime.isStreaming;
  const isApplying = activeRuntime.isApplying;
  const dryRunLoading = activeRuntime.dryRunLoading === true;
  const dryRunFailed = activeRuntime.dryRunFailed === true;

  const gateContext = useMemo<BuilderGateContext>(
    () => ({
      draft: getActiveDraft(activeSession),
      plan: getActivePlan(activeSession),
      contract:
        activeSession?.planContract ||
        getActivePlan(activeSession)?.contract ||
        getActiveDraft(activeSession)?.contract,
      hasOpenPlanQuestions: Boolean(activeSession?.activeClarification?.questions?.length),
      isStreaming,
      isApplying,
      builderMode: builderModeId
    }),
    [activeSession, builderModeId, isApplying, isStreaming]
  );

  const generateGate = useMemo(() => canGenerateBuildPlan(gateContext), [gateContext]);
  const applyGate = useMemo(() => canApplyBuildPlan(gateContext), [gateContext]);

  const draft = activeSession?.draft || '';
  const draftMentions = activeSession?.draftMentions || [];

  const nextRunId = (sessionId: string) => {
    const runId = (streamRunIdRef.current[sessionId] || 0) + 1;
    streamRunIdRef.current[sessionId] = runId;
    return runId;
  };

  const appendCheckpoint = (
    sessionId: string,
    checkpoint: Partial<BuilderCheckpoint> & {
      type: BuilderCheckpoint['type'];
      summary: string;
      planId?: string;
      planVersion?: number;
    }
  ) => {
    updateSessionById(sessionId, (session) => {
      const previous = session.checkpoints?.[session.checkpoints.length - 1];
      const mode = sessionBuilderMode(session);
      const lineage: PlanLineage = {
        ...checkpoint.lineage,
        planId: checkpoint.lineage?.planId || checkpoint.planId,
        planVersion: checkpoint.lineage?.planVersion || checkpoint.planVersion,
        parentCheckpointId: checkpoint.lineage?.parentCheckpointId || previous?.id
      };
      return {
        checkpoints: [
          ...(session.checkpoints || []),
          {
            id: checkpoint.id || `cp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            type: checkpoint.type,
            summary: checkpoint.summary,
            state:
              checkpoint.state || (mode === 'build' ? 'build' : mode === 'plan' ? 'plan' : 'chat'),
            lineage,
            answers: checkpoint.answers,
            riskAccepted: checkpoint.riskAccepted,
            partialWriteRisk: checkpoint.partialWriteRisk,
            createdAt: checkpoint.createdAt || new Date().toISOString()
          }
        ].slice(-80)
      };
    });
  };

  const ingestCheckpoint = (sessionId: string, checkpoint: BuilderCheckpoint) => {
    updateSessionById(sessionId, (session) => ({
      lineage: checkpoint.lineage || session.lineage,
      checkpoints: [
        ...(session.checkpoints || []).filter((item) => item.id !== checkpoint.id),
        checkpoint
      ].slice(-80)
    }));
  };

  const focusPlanArtifact = (
    sessionId: string,
    target?: { messageId?: string; planId?: string },
    options?: { statusText?: string; scroll?: boolean }
  ) => {
    updateSessionById(sessionId, (session) => ({
      messages: session.messages.map((message) => {
        if (message.kind !== 'plan_artifact' || message.superseded) return message;
        if (target?.messageId) {
          return message.id === target.messageId ? { ...message, collapsed: false } : message;
        }
        if (target?.planId) {
          return message.planSnapshot?.id === target.planId
            ? { ...message, collapsed: false }
            : message;
        }
        return { ...message, collapsed: false };
      })
    }));
    if (options?.scroll !== false) {
      pendingPlanFocusRef.current = {
        sessionId,
        messageId: target?.messageId,
        planId: target?.planId
      };
    }
    if (options?.statusText) {
      updateSessionRuntime(sessionId, { statusText: options.statusText });
    }
  };

  const runDryRunForPlan = (sessionId: string, plan: AiBuildPlan, sourcePlanId: string) => {
    const attemptKey = `${sessionId}:${sourcePlanId}:${plan.version || 1}`;
    dryRunAutoAttemptRef.current.add(attemptKey);
    updateSessionRuntime(sessionId, {
      dryRunLoading: true,
      dryRunFailed: false,
      statusText: aiBuilderUi.statusRunning
    });
    void agentService
      .dryRunAiBuildPlan(plan)
      .then((result) => {
        const sanitizedPlan = result.sanitizedPlan || plan;
        const resultForPlan: AiBuildDryRunResult = { ...result, sanitizedPlan: undefined };
        const planWithDryRun: AiBuildPlan = {
          ...sanitizedPlan,
          version: sanitizedPlan.version || plan.version || result.planVersion || 1,
          dryRun: resultForPlan,
          status:
            result.errors.length === 0 && sanitizedPlan.validation.status === 'ok'
              ? 'ready'
              : 'pending_validation'
        };
        const originalPlanId = plan.id;
        updateSessionById(sessionId, (session) => {
          const nextMessages = session.messages.map((message) =>
            message.kind === 'plan_artifact' &&
            (message.planSnapshot?.id === sourcePlanId ||
              message.planSnapshot?.id === originalPlanId)
              ? {
                  ...message,
                  dryRun: resultForPlan,
                  planSnapshot: planWithDryRun
                }
              : message
          );
          const nextPlan = getActivePlan({ ...session, messages: nextMessages });
          return {
            messages: nextMessages,
            stateGraph: mergeStateGraphWithGates(session.stateGraph, {
              draft: getActiveDraft(session),
              plan: nextPlan,
              contract: nextPlan?.contract || session.planContract,
              hasOpenPlanQuestions: Boolean(session.activeClarification?.questions?.length),
              isStreaming: false,
              isApplying: false,
              builderMode: 'build'
            })
          };
        });
        focusPlanArtifact(
          sessionId,
          { planId: planWithDryRun.id },
          {
            statusText: result.errors.length
              ? aiBuilderUi.statusBlocked(result.errors.length)
              : result.riskPolicy?.hasHighRisk
                ? aiBuilderUi.statusReadyHighRisk
                : aiBuilderUi.statusReady,
            scroll: true
          }
        );
      })
      .catch((error) => {
        const message = error.message || aiBuilderUi.statusFailed;
        updateSessionRuntime(sessionId, { dryRunFailed: true, statusText: message });
        onError?.(message);
      })
      .finally(() => {
        updateSessionRuntime(sessionId, { dryRunLoading: false });
      });
  };

  const ensureDryRunForActivePlan = () => {
    if (!activeSession?.id || !buildMode || isStreaming || isApplying || dryRunLoading) return;
    const plan = getActivePlan(activeSession);
    if (!plan?.id || plan.dryRun || plan.validation.status !== 'ok') return;
    const attemptKey = `${activeSession.id}:${plan.id}:${plan.version || 1}`;
    if (dryRunAutoAttemptRef.current.has(attemptKey)) return;
    dryRunAutoAttemptRef.current.add(attemptKey);
    runDryRunForPlan(activeSession.id, plan, plan.id);
  };

  useEffect(() => {
    if (!open) return;
    ensureDryRunForActivePlan();
  }, [
    open,
    activeSession?.id,
    activeSession?.messages,
    buildMode,
    dryRunLoading,
    isApplying,
    isStreaming
  ]);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !open) return;
    const frame = window.requestAnimationFrame(() => {
      const pending = pendingPlanFocusRef.current;
      if (pending && pending.sessionId === activeSession?.id) {
        let target: Element | null = null;
        if (pending.messageId) {
          target = container.querySelector(`[data-plan-message-id="${pending.messageId}"]`);
        } else if (pending.planId) {
          target = container.querySelector(
            `[data-plan-id="${pending.planId}"]:not([data-plan-superseded="true"])`
          );
        } else {
          target = container.querySelector('[data-plan-active="true"]');
        }
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          pendingPlanFocusRef.current = null;
          return;
        }
      }
      if (buildMode && getActivePlan(activeSession)) return;
      container.scrollTop = container.scrollHeight;
      scrollRef.current?.scrollIntoView({ block: 'end' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    activeSession,
    buildMode,
    open,
    runtimeBySessionId[activeSession?.id || '']?.isStreaming,
    runtimeBySessionId[activeSession?.id || '']?.statusText,
    scrollContainerRef,
    scrollRef
  ]);

  const stopActiveRun = () => {
    if (!activeSession) return;
    const sessionId = activeSession.id;
    const runtime = runtimeBySessionId[sessionId] || {
      isStreaming: false,
      isApplying: false,
      statusText: ''
    };
    const wasApplying = runtime.isApplying;
    const wasStreaming = runtime.isStreaming;
    streamRunIdRef.current[sessionId] = (streamRunIdRef.current[sessionId] || 0) + 1;
    abortControllersRef.current[sessionId]?.abort();
    abortControllersRef.current[sessionId] = null;
    if (wasApplying) {
      updateSessionRuntime(sessionId, {
        isApplying: false,
        isStreaming: false,
        statusText: '构建已取消',
        applyStep: undefined,
        applyTotal: undefined
      });
      updateSessionById(sessionId, (session) => ({
        messages: session.messages.map((message) =>
          message.kind === 'plan_artifact' && message.planSnapshot?.status === 'building'
            ? {
                ...message,
                buildError: '构建已取消',
                planSnapshot: { ...message.planSnapshot, status: 'ready' as const }
              }
            : message
        )
      }));
    }
    if (wasStreaming) {
      updateSessionRuntime(sessionId, {
        isStreaming: false,
        dryRunLoading: false,
        dryRunFailed: false,
        applyStep: undefined,
        applyTotal: undefined,
        statusText: wasApplying ? '构建已取消' : '已停止生成'
      });
      updateSessionById(sessionId, (session) => ({
        messages: withoutPendingArtifacts(session.messages).map((message) =>
          message.pending
            ? { ...message, pending: false, content: message.content || '已停止。' }
            : message
        )
      }));
    }
  };

  const maybeCompressContext = async (
    session: AiBuilderSession,
    messages: ChatMessage[],
    mentions: AiBuilderMention[]
  ) => {
    if (estimateTokens({ ...session, messages }) < SUMMARY_TOKEN_LIMIT)
      return session.contextSummary || '';
    try {
      let summary = session.contextSummary || '';
      let memory = session.contextMemory;
      await agentService.streamAiBuildChat(
        {
          messages: messages
            .filter((message) => !message.kind || message.kind === 'text')
            .map(({ role, content, mentions }) => ({ role, content, mentions })),
          mentions,
          contextSummary: session.contextSummary || '',
          contextMemory: session.contextMemory,
          currentPlan: getActivePlan(session) || undefined,
          compressRequested: true,
          providerId: session.providerId,
          model: session.model
        },
        (event) => {
          if (event.type === 'context_summary') summary = event.summary;
          if (event.type === 'context_memory') {
            summary = event.summary;
            memory = event.memory;
          }
        }
      );
      updateSessionById(session.id, { contextSummary: summary, contextMemory: memory });
      return summary;
    } catch {
      updateSessionRuntime(session.id, { statusText: '上下文压缩失败，已临时使用最近消息继续。' });
      return session.contextSummary || '';
    }
  };

  const sendMessage = async (options?: {
    content?: string;
    planPhase?: 'discover' | 'generate';
    planAnswers?: Record<string, unknown>;
    builderMode?: BuilderMode;
    currentDraft?: PlanDraft;
  }) => {
    if (
      !activeSession ||
      isStreaming ||
      dryRunLoading ||
      (buildMode && options?.builderMode !== 'build')
    )
      return;
    const sessionId = activeSession.id;
    const modeForRun = options?.builderMode || builderModeId;
    const content =
      options?.content ||
      (modeForRun === 'plan' ? draft.trim() || '请继续完善这个方案。' : draft.trim());
    if (!content && draftMentions.length === 0) return;

    const answersForRun = options?.planAnswers || activeSession.planAnswers || {};
    const planPhase = options?.planPhase || 'discover';
    const buildRequested = modeForRun === 'build';
    const draftRefinementPending = modeForRun === 'plan' && planPhase === 'generate';
    const runId = nextRunId(sessionId);
    streamAssistantIdRef.current[sessionId] = null;
    abortControllersRef.current[sessionId]?.abort();
    const abortController = new AbortController();
    abortControllersRef.current[sessionId] = abortController;

    const allMentions = uniqueMentions([...activeSession.mentions, ...draftMentions]);
    const userMessage: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content,
      mentions: draftMentions
    };
    const assistantId = buildRequested ? null : `a_${Date.now()}`;
    const planPlaceholderId = buildRequested ? `plan_pending_${Date.now()}` : null;
    const draftPlaceholderId = draftRefinementPending ? `draft_pending_${Date.now()}` : null;
    const artifactPlaceholderId = planPlaceholderId || draftPlaceholderId;
    const artifactPlaceholderIds = [planPlaceholderId, draftPlaceholderId];
    const clearCurrentPendingArtifacts = () => {
      updateSessionById(sessionId, (session) => ({
        messages: withoutPendingArtifactIds(session.messages, artifactPlaceholderIds)
      }));
    };
    const nextMessages: ChatMessage[] = [
      ...activeSession.messages,
      userMessage,
      ...(planPlaceholderId
        ? [
            {
              id: planPlaceholderId,
              role: 'assistant',
              content: '正在生成构建评审单...',
              kind: 'plan_artifact_pending',
              pending: true,
              collapsed: false
            } as ChatMessage
          ]
        : []),
      ...(draftPlaceholderId
        ? [
            {
              id: draftPlaceholderId,
              role: 'assistant',
              content: '正在生成计划草稿...',
              kind: 'planning_artifact_pending',
              pending: true,
              collapsed: false
            } as ChatMessage
          ]
        : []),
      ...(assistantId
        ? [
            {
              id: assistantId,
              role: 'assistant' as const,
              content: '',
              pending: true,
              kind: 'text' as const
            }
          ]
        : [])
    ];
    const nextTitle =
      activeSession.messages.length === 0
        ? draftMentions[0]?.label || content.slice(0, 28) || activeSession.title
        : activeSession.title;

    updateSessionById(sessionId, {
      messages: nextMessages,
      mentions: allMentions,
      title: nextTitle,
      draft: '',
      draftMentions: []
    });
    appendCheckpoint(sessionId, { type: 'message', summary: content, answers: answersForRun });
    setEditorResetKey((key) => key + 1);
    updateSessionRuntime(sessionId, {
      isStreaming: true,
      dryRunLoading: false,
      dryRunFailed: false,
      statusText: buildRequested
        ? '正在把方案转换为构建计划...'
        : modeForRun === 'plan'
          ? planPhase === 'generate'
            ? '正在生成计划草稿...'
            : '正在分析目标并准备澄清问题...'
          : ''
    });
    if (artifactPlaceholderId) {
      pendingPlanFocusRef.current = { sessionId, messageId: artifactPlaceholderId };
    }

    const contextSummary = await maybeCompressContext(activeSession, nextMessages, allMentions);
    if (abortController.signal.aborted) {
      clearCurrentPendingArtifacts();
      return;
    }

    try {
      await agentService.streamAiBuildChat(
        {
          messages: nextMessages
            .filter((message) => !message.pending)
            .filter((message) => !message.kind || message.kind === 'text')
            .slice(-12)
            .map(({ role, content, mentions }) => ({ role, content, mentions })),
          mentions: allMentions,
          contextSummary,
          contextMemory: activeSession.contextMemory,
          currentPlan: getActivePlan(activeSession) || undefined,
          currentDraft: options?.currentDraft || getActiveDraft(activeSession) || undefined,
          stateGraph: activeSession.stateGraph,
          capabilityGraph: activeSession.capabilityGraph,
          planContract: activeSession.planContract,
          lineage: activeSession.lineage,
          builderMode: modeForRun,
          planPhase,
          planAnswers: answersForRun,
          buildRequested,
          providerId: activeSession.providerId || undefined,
          model: activeSession.model || undefined
        },
        (event) => {
          if (streamRunIdRef.current[sessionId] !== runId) return;
          if (event.type === 'status') {
            updateSessionRuntime(sessionId, { statusText: event.message });
            return;
          }
          if (event.type === 'tool_started') {
            updateSessionRuntime(sessionId, {
              statusText: `调用工具：${event.tool}`
            });
            return;
          }
          if (event.type === 'tool_finished') {
            updateSessionRuntime(sessionId, {
              statusText: event.success
                ? event.summary || `工具 ${event.tool} 完成`
                : `工具 ${event.tool} 失败：${event.summary || ''}`
            });
            return;
          }
          if (event.type === 'run_started') {
            updateSessionRuntime(sessionId, {
              statusText: `Builder Agent 运行中 (${event.runId})`
            });
            return;
          }
          if (event.type === 'delta') {
            if (assistantId) {
              updateSessionById(sessionId, (session) => ({
                messages: session.messages.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: message.content + event.content, pending: false }
                    : message
                )
              }));
              return;
            }
            let targetId = streamAssistantIdRef.current[sessionId];
            if (!targetId) {
              targetId = `a_${Date.now()}`;
              streamAssistantIdRef.current[sessionId] = targetId;
              updateSessionById(sessionId, (session) => ({
                messages: [
                  ...withoutPendingArtifactIds(session.messages, artifactPlaceholderIds),
                  {
                    id: targetId!,
                    role: 'assistant',
                    content: event.content,
                    pending: false,
                    kind: 'text'
                  } as ChatMessage
                ]
              }));
              return;
            }
            updateSessionById(sessionId, (session) => ({
              messages: session.messages.map((message) =>
                message.id === targetId
                  ? { ...message, content: message.content + event.content, pending: false }
                  : message
              )
            }));
            return;
          }
          if (event.type === 'needs_input') {
            updateSessionRuntime(sessionId, { statusText: event.message });
            if (modeForRun === 'chat') return;
            const noticeId = assistantId || `needs_${Date.now()}`;
            updateSessionById(sessionId, (session) => {
              const messages = withoutPendingArtifactIds(session.messages, artifactPlaceholderIds);
              const existing = messages.find((message) => message.id === noticeId);
              if (existing) {
                return {
                  messages: messages.map((message) =>
                    message.id === noticeId
                      ? {
                          ...message,
                          role: 'assistant' as const,
                          content: message.content.trim() ? message.content : event.message,
                          kind: 'text' as const,
                          pending: false
                        }
                      : message
                  )
                };
              }
              return {
                messages: [
                  ...messages.filter(
                    (message) =>
                      !assistantId || message.id !== assistantId || message.content.trim()
                  ),
                  {
                    id: noticeId,
                    role: 'assistant',
                    content: event.message,
                    kind: 'text',
                    pending: false
                  } as ChatMessage
                ]
              };
            });
            return;
          }
          if (event.type === 'state_graph') {
            updateSessionById(sessionId, { stateGraph: event.graph });
            return;
          }
          if (event.type === 'capability_graph') {
            updateSessionById(sessionId, { capabilityGraph: event.graph });
            return;
          }
          if (event.type === 'plan_contract') {
            updateSessionById(sessionId, { planContract: event.contract });
            return;
          }
          if (event.type === 'checkpoint') {
            ingestCheckpoint(sessionId, event.checkpoint);
            return;
          }
          if (event.type === 'questions' || event.type === 'planning_questions') {
            const questions = event.questions;
            const noticeId = assistantId || `clarify_${Date.now()}`;
            updateSessionById(sessionId, (session) => ({
              activeClarification: { questions, step: 0 },
              messages: [
                ...withoutPendingArtifactIds(session.messages, artifactPlaceholderIds).filter(
                  (message) => !assistantId || message.id !== assistantId || message.content.trim()
                ),
                {
                  id: noticeId,
                  role: 'assistant',
                  content: `我需要先确认 ${questions.length} 个关键问题，请在下方逐项选择。`,
                  kind: 'text',
                  pending: false
                } as ChatMessage
              ]
            }));
            updateSessionRuntime(sessionId, { statusText: '请在下方澄清面板中逐项回答。' });
            appendCheckpoint(sessionId, {
              type: 'questions',
              summary: '生成计划澄清问题',
              answers: answersForRun
            });
            return;
          }
          if (event.type === 'plan_draft') {
            let draftVersion = 1;
            const draftMessageId = `draft_${event.draft.id}_${Date.now()}`;
            const reflectionAssistantId =
              assistantId || streamAssistantIdRef.current[sessionId] || null;
            updateSessionById(sessionId, (session) => {
              draftVersion =
                session.messages.filter((message) => message.kind === 'planning_artifact').length +
                1;
              const draftForCard: PlanDraft = { ...event.draft, version: draftVersion };
              const baseMessages = withoutPendingArtifactIds(
                session.messages,
                artifactPlaceholderIds
              )
                .map((message) => {
                  if (
                    reflectionAssistantId &&
                    message.id === reflectionAssistantId &&
                    message.content.trim()
                  ) {
                    const reflection = extractPlanReflectionText(message.content);
                    if (!reflection) return null;
                    return {
                      ...message,
                      content: reflection,
                      pending: false,
                      kind: 'text' as const
                    };
                  }
                  return message;
                })
                .filter((message): message is ChatMessage => message !== null);
              return {
                activeDraft: draftForCard,
                stateGraph: event.draft.stateGraph || session.stateGraph,
                capabilityGraph: event.draft.capabilityGraph || session.capabilityGraph,
                planContract: event.draft.contract || session.planContract,
                lineage: event.draft.lineage || session.lineage,
                messages: collapseOlderDraftArtifacts(baseMessages, draftMessageId).concat({
                  id: draftMessageId,
                  role: 'assistant',
                  content: event.draft.summary,
                  kind: 'planning_artifact',
                  draftSnapshot: draftForCard,
                  draftVersion,
                  collapsed: false,
                  superseded: false
                } as ChatMessage)
              };
            });
            pendingPlanFocusRef.current = { sessionId, messageId: draftMessageId };
            updateSessionRuntime(sessionId, { statusText: '计划草稿已准备好，可以生成构建计划。' });
            if (!event.draft.lineage?.checkpointId) {
              appendCheckpoint(sessionId, {
                type: 'plan_draft',
                lineage: {
                  ...event.draft.lineage,
                  draftId: event.draft.id,
                  draftVersion
                },
                summary: event.draft.summary,
                answers: answersForRun
              });
            }
            return;
          }
          if (event.type === 'context_summary') {
            updateSessionById(sessionId, { contextSummary: event.summary });
            return;
          }
          if (event.type === 'context_memory') {
            updateSessionById(sessionId, {
              contextSummary: event.summary,
              contextMemory: event.memory
            });
            return;
          }
          if (event.type === 'plan') {
            const planMessageId = `plan_${event.plan.id}_${Date.now()}`;
            let planVersion = 1;
            let planForCard: AiBuildPlan | null = null;
            updateSessionById(sessionId, (session) => {
              planVersion =
                session.messages.filter((message) => message.kind === 'plan_artifact').length + 1;
              planForCard = {
                ...event.plan,
                status: event.plan.validation.status === 'ok' ? 'pending_validation' : 'draft',
                version: planVersion,
                dryRun: undefined
              };
              return {
                plan: null,
                stateGraph: event.plan.stateGraph || session.stateGraph,
                capabilityGraph: event.plan.capabilityGraph || session.capabilityGraph,
                planContract: event.plan.contract || session.planContract,
                lineage: event.plan.lineage || session.lineage,
                messages: collapseOlderPlanArtifacts(
                  collapseAllDraftArtifacts(
                    withoutPendingArtifactIds(session.messages, artifactPlaceholderIds).filter(
                      (message) =>
                        !assistantId || message.id !== assistantId || message.content.trim()
                    )
                  ),
                  planMessageId
                ).concat({
                  id: planMessageId,
                  role: 'assistant',
                  content: event.plan.summary,
                  kind: 'plan_artifact',
                  planSnapshot: planForCard,
                  planVersion,
                  collapsed: false,
                  superseded: false
                } as ChatMessage)
              };
            });
            updateSessionById(sessionId, { builderMode: 'build' });
            focusPlanArtifact(
              sessionId,
              { messageId: planMessageId, planId: event.plan.id },
              {
                statusText:
                  event.plan.validation.status === 'ok'
                    ? aiBuilderUi.statusPreparing
                    : '构建计划已生成，但需要回到 Plan 修正。'
              }
            );
            if (event.plan.validation.status === 'ok' && planForCard) {
              runDryRunForPlan(sessionId, planForCard, event.plan.id);
            }
            if (!event.plan.lineage?.checkpointId) {
              appendCheckpoint(sessionId, {
                type: 'plan',
                lineage: {
                  ...event.plan.lineage,
                  planId: event.plan.id,
                  planVersion
                },
                summary: event.plan.summary,
                answers: answersForRun
              });
            }
            return;
          }
          if (event.type === 'error') {
            const message =
              event.message || (event as { error?: string }).error || 'AI Builder 请求失败';
            clearCurrentPendingArtifacts();
            updateSessionRuntime(sessionId, { statusText: message });
            onError?.(message);
          }
        },
        { signal: abortController.signal }
      );
    } catch (error: any) {
      if (abortController.signal.aborted) return;
      const message = error.message || 'AI Builder 对话失败';
      updateSessionRuntime(sessionId, { statusText: message });
      onError?.(message);
    } finally {
      updateSessionById(sessionId, (session) => ({
        messages: withoutPendingArtifactIds(session.messages, artifactPlaceholderIds).map((message) =>
          assistantId && message.id === assistantId ? { ...message, pending: false } : message
        )
      }));
      if (streamRunIdRef.current[sessionId] === runId) {
        abortControllersRef.current[sessionId] = null;
        updateSessionRuntime(sessionId, { isStreaming: false });
      }
    }
  };

  const startBuild = async (targetPlan: AiBuildPlan) => {
    if (!targetPlan || targetPlan.validation.status !== 'ok' || isApplying || isStreaming) return;
    const applyCheck = canApplyBuildPlan({ ...gateContext, plan: targetPlan });
    if (!applyCheck.ok) {
      setActiveStatusText(applyCheck.reason || '当前无法写库');
      return;
    }
    if (!activeSession) return;
    const sessionId = activeSession.id;
    const planId = targetPlan.id;
    const dryRunToken = targetPlan.dryRun?.dryRunToken;
    if (!dryRunToken) {
      setActiveStatusText(aiBuilderUi.tokenMissingActive);
      return;
    }
    const confirmHighRisk = targetPlan.dryRun?.riskPolicy?.hasHighRisk === true;
    const confirmed = await showConfirm(buildApplyConfirmDialog(targetPlan));
    if (!confirmed) {
      setActiveStatusText('已取消写库。');
      return;
    }
    const runId = nextRunId(sessionId);
    abortControllersRef.current[sessionId]?.abort();
    const abortController = new AbortController();
    abortControllersRef.current[sessionId] = abortController;
    const updatePlanArtifactForSession = (patch: (message: ChatMessage) => ChatMessage) => {
      updateSessionById(sessionId, (session) => ({
        messages: session.messages.map((message) =>
          message.kind === 'plan_artifact' && message.planSnapshot?.id === planId
            ? patch(message)
            : message
        )
      }));
    };
    try {
      updateSessionRuntime(sessionId, { isApplying: true });
      updateSessionById(sessionId, { builderMode: 'build' });
      updatePlanArtifactForSession((message) => ({
        ...message,
        collapsed: false,
        buildLog: ['开始构建...'],
        buildError: undefined,
        planSnapshot: message.planSnapshot
          ? { ...message.planSnapshot, status: 'building' }
          : message.planSnapshot
      }));
      focusPlanArtifact(
        sessionId,
        { planId: targetPlan.id },
        {
          statusText: '正在写库，请稍候...',
          scroll: true
        }
      );
      await agentService.streamAiBuildExecute(
        {
          planId: targetPlan.id,
          planVersion: targetPlan.version || 1,
          dryRunToken,
          confirmHighRisk
        },
        (event) => {
          if (streamRunIdRef.current[sessionId] !== runId) return;
          if (event.type === 'state_graph') {
            updateSessionById(sessionId, { stateGraph: event.graph });
            return;
          }
          if (event.type === 'checkpoint') {
            ingestCheckpoint(sessionId, event.checkpoint);
            return;
          }
          if (event.type === 'build_start') {
            updateSessionRuntime(sessionId, {
              statusText: '构建开始...',
              applyStep: 0,
              applyTotal: event.total
            });
            return;
          }
          if (event.type === 'dry_run') {
            updatePlanArtifactForSession((message) => ({
              ...message,
              dryRun: event.result,
              planSnapshot: message.planSnapshot
                ? { ...message.planSnapshot, dryRun: event.result }
                : message.planSnapshot
            }));
            if (!event.checkpoint) {
              appendCheckpoint(sessionId, {
                type: 'dry_run',
                lineage: event.lineage ||
                  targetPlan.lineage || { planId, planVersion: targetPlan.version },
                summary: aiBuilderUi.summary(
                  event.result.changes.length,
                  event.result.errors.length
                )
              });
            }
            return;
          }
          if (event.type === 'build_progress') {
            updateSessionRuntime(sessionId, {
              statusText: event.message,
              applyStep: event.step,
              applyTotal: event.total
            });
            updatePlanArtifactForSession((message) => ({
              ...message,
              buildLog: [...(message.buildLog || []), event.message]
            }));
            return;
          }
          if (event.type === 'build_done') {
            updateSessionRuntime(sessionId, { statusText: '构建完成' });
            updatePlanArtifactForSession((message) => ({
              ...message,
              collapsed: false,
              buildResult: event.result,
              planSnapshot: message.planSnapshot
                ? { ...message.planSnapshot, status: 'applied' }
                : message.planSnapshot
            }));
            updateSessionById(sessionId, { builderMode: 'build' });
            focusPlanArtifact(
              sessionId,
              { planId: targetPlan.id },
              {
                statusText: '构建已完成，交付结果已展开。',
                scroll: true
              }
            );
            if (!event.checkpoint) {
              appendCheckpoint(sessionId, {
                type: 'build',
                lineage: event.lineage ||
                  targetPlan.lineage || { planId, planVersion: targetPlan.version },
                summary: '构建完成'
              });
            }
            void onApplied();
            onSuccess?.('AI Builder 构建已完成');
            return;
          }
          if (event.type === 'build_failed') {
            const cancelled = event.message === '构建已取消' || abortController.signal.aborted;
            updateSessionRuntime(sessionId, { statusText: event.message });
            updatePlanArtifactForSession((message) => ({
              ...message,
              collapsed: false,
              buildError: event.appliedChanges?.length
                ? `${event.message}\n已应用：${event.appliedChanges.join(', ')}`
                : event.message,
              planSnapshot: message.planSnapshot
                ? { ...message.planSnapshot, status: cancelled ? 'ready' : 'failed' }
                : message.planSnapshot
            }));
            if (!cancelled) {
              updateSessionById(sessionId, { builderMode: 'build' });
              focusPlanArtifact(
                sessionId,
                { planId: targetPlan.id },
                {
                  statusText: '构建失败，请查看错误详情后重试写库。',
                  scroll: true
                }
              );
            }
            if (!event.checkpoint) {
              appendCheckpoint(sessionId, {
                type: 'build',
                lineage: event.lineage ||
                  targetPlan.lineage || { planId, planVersion: targetPlan.version },
                summary: `构建失败：${event.message}`
              });
            }
            if (!cancelled && !abortController.signal.aborted) onError?.(event.message);
            return;
          }
          if (event.type === 'error') {
            const errorMessage = event.message || (event as { error?: string }).error || '构建失败';
            updateSessionRuntime(sessionId, { statusText: errorMessage });
            updatePlanArtifactForSession((artifactMessage) => ({
              ...artifactMessage,
              collapsed: false,
              buildError: errorMessage,
              planSnapshot: artifactMessage.planSnapshot
                ? { ...artifactMessage.planSnapshot, status: 'failed' }
                : artifactMessage.planSnapshot
            }));
            if (!abortController.signal.aborted) {
              updateSessionById(sessionId, { builderMode: 'build' });
              focusPlanArtifact(
                sessionId,
                { planId: targetPlan.id },
                {
                  statusText: '构建失败，请查看错误详情后重试写库。',
                  scroll: true
                }
              );
              onError?.(errorMessage);
            }
          }
        },
        { signal: abortController.signal }
      );
    } catch (error: any) {
      updatePlanArtifactForSession((message) => ({
        ...message,
        collapsed: abortController.signal.aborted ? message.collapsed : false,
        buildError: abortController.signal.aborted ? '构建已取消' : error.message || '构建失败',
        planSnapshot: message.planSnapshot
          ? { ...message.planSnapshot, status: abortController.signal.aborted ? 'ready' : 'failed' }
          : message.planSnapshot
      }));
      if (!abortController.signal.aborted) {
        updateSessionById(sessionId, { builderMode: 'build' });
        focusPlanArtifact(
          sessionId,
          { planId: targetPlan.id },
          {
            statusText: '构建失败，请查看错误详情后重试写库。',
            scroll: true
          }
        );
        onError?.(error.message || '构建失败');
      }
    } finally {
      if (streamRunIdRef.current[sessionId] === runId) {
        abortControllersRef.current[sessionId] = null;
      }
      updateSessionRuntime(sessionId, {
        isApplying: false,
        applyStep: undefined,
        applyTotal: undefined
      });
    }
  };

  const completeClarification = (answers: Record<string, unknown>) => {
    if (!activeSession?.activeClarification?.questions?.length) return;
    const sessionId = activeSession.id;
    const questions = activeSession.activeClarification.questions;
    const summary = summarizeAnswers(questions, answers);
    updateSessionById(sessionId, (session) => ({
      activeClarification: null,
      planAnswers: answers,
      messages: summary
        ? [
            ...session.messages,
            {
              id: `answers_${Date.now()}`,
              role: 'user',
              content: `已确认计划问题：\n${summary}`,
              kind: 'text'
            } as ChatMessage
          ]
        : session.messages
    }));
    void sendMessage({
      content: '我已经回答了规划澄清问题，请生成方案草稿。',
      builderMode: 'plan',
      planPhase: 'generate',
      planAnswers: answers
    });
  };

  const enterBuildFromDraft = (draft: PlanDraft) => {
    if (!activeSession || isStreaming || isApplying || dryRunLoading) return;
    const generateCheck = canGenerateBuildPlan({ ...gateContext, draft });
    if (!generateCheck.ok) {
      setActiveStatusText(generateCheck.reason || '当前无法生成构建计划');
      return;
    }
    const sessionId = activeSession.id;
    updateSessionById(sessionId, { builderMode: 'build', activeDraft: draft });
    void sendMessage({
      content: '请基于当前计划草稿生成可审阅的构建计划。',
      builderMode: 'build',
      planPhase: 'generate',
      currentDraft: draft,
      planAnswers: activeSession.planAnswers || {}
    });
  };

  const submitBuildPlanAnswers = (answers: Record<string, unknown>) => {
    if (!activeSession || isStreaming || isApplying || dryRunLoading) return;
    updateSessionById(activeSession.id, { planAnswers: answers });
    void sendMessage({
      content: '我已补充构建计划中的待确认问题，请更新构建计划。',
      builderMode: 'build',
      planPhase: 'generate',
      planAnswers: answers,
      currentDraft: getActiveDraft(activeSession) || undefined
    });
  };

  const retryDryRunForActivePlan = () => {
    if (!activeSession || dryRunLoading) return;
    const plan = getActivePlan(activeSession);
    if (!plan || plan.validation.status !== 'ok') return;
    const attemptKey = `${activeSession.id}:${plan.id}:${plan.version || 1}`;
    dryRunAutoAttemptRef.current.delete(attemptKey);
    runDryRunForPlan(activeSession.id, plan, plan.id);
  };

  const saveEditedPlanVersion = (sourceMessageId: string, editedPlan: AiBuildPlan) => {
    if (!activeSession || dryRunLoading) return;
    const sessionId = activeSession.id;
    const nextVersion =
      (activeSession.messages.filter((message) => message.kind === 'plan_artifact').length || 0) +
      1;
    const pendingValidation = editedPlan.validation.status === 'ok';
    const nextPlan: AiBuildPlan = {
      ...editedPlan,
      id: `${editedPlan.id}_edit_${Date.now().toString(36)}`,
      version: nextVersion,
      status: pendingValidation ? 'pending_validation' : 'draft',
      dryRun: undefined
    };
    const planMessageId = `plan_${nextPlan.id}`;
    updateSessionById(sessionId, (session) => ({
      builderMode: 'build',
      messages: collapseOlderPlanArtifacts(session.messages, planMessageId).concat({
        id: planMessageId,
        role: 'assistant',
        content: nextPlan.summary,
        kind: 'plan_artifact',
        planSnapshot: nextPlan,
        planVersion: nextVersion,
        collapsed: false,
        superseded: false
      } as ChatMessage)
    }));
    appendCheckpoint(sessionId, {
      type: 'plan',
      planId: nextPlan.id,
      planVersion: nextVersion,
      summary: `从 ${sourceMessageId} 手动编辑生成新计划版本`
    });
    focusPlanArtifact(
      sessionId,
      { messageId: planMessageId, planId: nextPlan.id },
      {
        statusText: pendingValidation ? aiBuilderUi.rerunAfterEdit : '计划已手动修订，请继续完善。'
      }
    );
    if (pendingValidation) {
      runDryRunForPlan(sessionId, nextPlan, nextPlan.id);
    }
  };

  return {
    isStreaming,
    isApplying,
    dryRunLoading,
    dryRunFailed,
    applyStep: activeRuntime.applyStep,
    applyTotal: activeRuntime.applyTotal,
    statusText: activeRuntime.statusText,
    generateGate,
    applyGate,
    stopActiveRun,
    sendMessage,
    startBuild,
    completeClarification,
    enterBuildFromDraft,
    submitBuildPlanAnswers,
    retryDryRunForActivePlan,
    saveEditedPlanVersion,
    setActiveStatusText
  };
}
