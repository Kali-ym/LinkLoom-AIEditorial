import { useEffect, useRef, useState } from 'react';
import type { AiBuilderMention } from '../../../services/agentService';
import { mentionKey, createSession } from './aiBuilderMentions';
import { hydrateSessionsFromArtifacts, readSessions, writeSessions } from './sessionStorage';
import type { AiBuilderSession, SessionRuntime } from './sessionStorage';

export interface UseAiBuilderSessionOptions {
  defaultProviderId: string;
  defaultModel: string;
  initialMention?: AiBuilderMention | null;
  onInitialMentionConsumed?: () => void;
  onBackgroundActivityChange?: (active: boolean) => void;
}

export function useAiBuilderSession({
  defaultProviderId,
  defaultModel,
  initialMention,
  onInitialMentionConsumed,
  onBackgroundActivityChange
}: UseAiBuilderSessionOptions) {
  const [sessions, setSessions] = useState<AiBuilderSession[]>(() => {
    const existing = readSessions();
    return existing.length ? existing : [createSession(defaultProviderId, defaultModel)];
  });
  const [activeSessionId, setActiveSessionId] = useState(() => readSessions()[0]?.id || '');
  const [runtimeBySessionId, setRuntimeBySessionId] = useState<Record<string, SessionRuntime>>({});

  const abortControllersRef = useRef<Record<string, AbortController | null>>({});
  const streamRunIdRef = useRef<Record<string, number>>({});
  const consumedInitialMentionKeyRef = useRef<string | null>(null);
  const hydratedArtifactsRef = useRef(false);

  const activeSession = sessions.find((session) => session.id === activeSessionId) || sessions[0];

  useEffect(() => {
    setSessions((prev) =>
      prev.map((session) => ({
        ...session,
        providerId: session.providerId || defaultProviderId,
        model: session.model || defaultModel
      }))
    );
  }, [defaultProviderId, defaultModel]);

  useEffect(() => {
    if (hydratedArtifactsRef.current) writeSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    let cancelled = false;
    void hydrateSessionsFromArtifacts(sessions).then((hydrated) => {
      if (cancelled) return;
      hydratedArtifactsRef.current = true;
      const changed = JSON.stringify(hydrated) !== JSON.stringify(sessions);
      if (changed) setSessions(hydrated);
      else writeSessions(sessions);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(abortControllersRef.current).forEach((controller) => controller?.abort());
      abortControllersRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!sessions.some((session) => session.id === activeSessionId)) {
      setActiveSessionId(sessions[0]?.id || '');
    }
  }, [sessions, activeSessionId]);

  useEffect(() => {
    const active = Object.values(runtimeBySessionId).some(
      (runtime) => runtime.isStreaming || runtime.isApplying || runtime.dryRunLoading
    );
    onBackgroundActivityChange?.(active);
  }, [runtimeBySessionId, onBackgroundActivityChange]);

  useEffect(() => {
    if (!initialMention) {
      consumedInitialMentionKeyRef.current = null;
      return;
    }
    const key = mentionKey(initialMention);
    if (consumedInitialMentionKeyRef.current === key) return;
    consumedInitialMentionKeyRef.current = key;
    const session = createSession(defaultProviderId, defaultModel, initialMention);
    setSessions((prev) => {
      const withoutUnusedBlank = prev.filter(
        (item) =>
          item.messages.length > 0 ||
          item.mentions.length > 0 ||
          (item.draft || '').trim() ||
          (item.draftMentions || []).length > 0
      );
      return [session, ...withoutUnusedBlank];
    });
    setActiveSessionId(session.id);
    onInitialMentionConsumed?.();
  }, [initialMention, defaultProviderId, defaultModel, onInitialMentionConsumed]);

  const updateSessionRuntime = (sessionId: string, patch: Partial<SessionRuntime>) => {
    setRuntimeBySessionId((prev) => {
      const current = prev[sessionId] || {
        isStreaming: false,
        isApplying: false,
        statusText: '',
        dryRunLoading: false,
        dryRunFailed: false
      };
      return {
        ...prev,
        [sessionId]: { ...current, ...patch }
      };
    });
  };

  const setActiveStatusText = (message: string) => {
    if (activeSession?.id) updateSessionRuntime(activeSession.id, { statusText: message });
  };

  const updateSessionById = (
    sessionId: string,
    patch: Partial<AiBuilderSession> | ((session: AiBuilderSession) => Partial<AiBuilderSession>)
  ) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) return session;
        const nextPatch = typeof patch === 'function' ? patch(session) : patch;
        return { ...session, ...nextPatch, updatedAt: Date.now() };
      })
    );
  };

  const updateActiveSession = (
    patch: Partial<AiBuilderSession> | ((session: AiBuilderSession) => Partial<AiBuilderSession>)
  ) => {
    if (!activeSession) return;
    updateSessionById(activeSession.id, patch);
  };

  useEffect(() => {
    if (!activeSession?.id || activeSession.activeClarification?.questions?.length) return;
    const restoredClarification = [...activeSession.messages]
      .reverse()
      .find(
        (message) =>
          message.kind === 'questions_artifact' &&
          message.collapsed !== true &&
          (message.questions?.length || 0) > 0
      );
    if (!restoredClarification?.questions?.length) return;
    updateSessionById(activeSession.id, {
      activeClarification: { questions: restoredClarification.questions, step: 0 }
    });
  }, [activeSession?.activeClarification, activeSession?.id, activeSession?.messages]);

  const createBlankSession = () => {
    const session = createSession(defaultProviderId, defaultModel);
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
  };

  const deleteSession = (id: string) => {
    abortControllersRef.current[id]?.abort();
    abortControllersRef.current[id] = null;
    streamRunIdRef.current[id] = (streamRunIdRef.current[id] || 0) + 1;
    setRuntimeBySessionId((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSessions((prev) => {
      const next = prev.filter((session) => session.id !== id);
      return next.length ? next : [createSession(defaultProviderId, defaultModel)];
    });
  };

  return {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    activeSession,
    runtimeBySessionId,
    updateSessionRuntime,
    setActiveStatusText,
    updateActiveSession,
    updateSessionById,
    createBlankSession,
    deleteSession,
    abortControllersRef,
    streamRunIdRef,
    hydratedArtifactsRef
  };
}
