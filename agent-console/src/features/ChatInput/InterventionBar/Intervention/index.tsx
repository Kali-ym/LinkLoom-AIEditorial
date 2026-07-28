import { Flexbox } from '@lobehub/ui';
import { memo, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useChatStore } from '../../../../stores';
import { useStreamingStore } from '../../../../stores/streamingStore';
import { isAgentConsoleApiMode } from '../../../../adapters/registry';
import { resolveRunHitlViaPort } from '../../../../hooks/data/runHitlControl';
import { continueAgentRunAfterIntervention } from '../../../../services/streaming/continueAgentRunStream';
import { TOOLSET_IDS } from '../../../../domain/constants/toolsetIdentifiers';
import { showToast } from '../../../../services/ui/toast';
import { ApprovalActions } from './ApprovalActions';
import {
  ADMIN_REGUIDE_REJECT_REASON,
  isHighRiskAdminIntervention,
} from './adminInterventionConfig';
import {
  isCustomInteractionIdentifier,
} from './customInteractionHandlers';
import { FallbackIntervention } from './Fallback';
import { getBuiltinIntervention } from './registry';
import { SecurityBlacklistWarning } from './SecurityBlacklistWarning';
import { RuntimeHitlIntervention } from './builtins/RuntimeHitlIntervention';
import { isRuntimeHitlKind } from './runtimeHitl';
import type { InteractionAction, InterventionRouterProps } from './types';
import { safeParseJSON } from './utils';

/** §C.36*/
export const Intervention = memo(function Intervention({
  requestArgs,
  toolMessageId,
  identifier,
  apiName,
  toolCallId,
  assistantGroupId,
  assistantMessageId,
  actionsPortalTarget,
  topicId,
  onResolved,
  permissionId,
  hitlKind,
  hitlPrompt,
  allowedActions,
}: InterventionRouterProps) {
  const approvalMode = useStreamingStore((s) => s.approvalMode);
  const updatePluginArguments = useChatStore((s) => s.updatePluginArguments);
  const resolveIntervention = useChatStore((s) => s.resolveIntervention);
  const submitToolInteraction = useChatStore((s) => s.submitToolInteraction);
  const skipToolInteraction = useChatStore((s) => s.skipToolInteraction);

  const beforeApproveCallbacksRef = useRef<Map<string, () => void | Promise<void>>>(new Map());

  const registerBeforeApprove = useCallback(
    (callbackId: string, callback: () => void | Promise<void>) => {
      beforeApproveCallbacksRef.current.set(callbackId, callback);
      return () => {
        beforeApproveCallbacksRef.current.delete(callbackId);
      };
    },
    [],
  );

  const handleBeforeApprove = useCallback(async () => {
    const callbacks = Array.from(beforeApproveCallbacksRef.current.values());
    await Promise.all(callbacks.map((cb) => cb()));
  }, []);

  const parsedArgs = useMemo(() => safeParseJSON(requestArgs) ?? {}, [requestArgs]);
  const resolvedHitlKind = hitlKind ?? (isRuntimeHitlKind(identifier) ? identifier : undefined);
  const isPermissionConfirmation =
    Boolean(permissionId) && resolvedHitlKind === 'confirmation';
  const useRuntimeHitl =
    Boolean(resolvedHitlKind) && isRuntimeHitlKind(resolvedHitlKind) && !isPermissionConfirmation;
  const isCustomInteraction = isCustomInteractionIdentifier(identifier, apiName);
  const BuiltinRender = getBuiltinIntervention(identifier, apiName);

  const handleArgsChange = useCallback(
    async (newArgs: unknown) => {
      if (newArgs && typeof newArgs === 'object') {
        updatePluginArguments(topicId, toolCallId, newArgs as Record<string, unknown>);
      }
    },
    [toolCallId, topicId, updatePluginArguments],
  );

  const handleInteractionAction = useCallback(
    async (action: InteractionAction) => {
      const submitAskUserQuestionToBackend = async (
        payload: unknown,
        options?: { skipped?: boolean; reason?: string },
      ) => {
        if (!isAgentConsoleApiMode() || identifier !== 'linkloom-user-interaction') return false;
        const runCtx = useStreamingStore.getState().getRunContextForTopic(topicId);
        const runId = runCtx?.runId;
        const hitlRequestId = runCtx?.hitlRequestId;
        if (!runId || !hitlRequestId) return false;

        await continueAgentRunAfterIntervention({
          topicId,
          runId,
          assistantMessageId,
          toolCallId,
          hitlRequestId,
          triggerResume: async () => {
            await resolveRunHitlViaPort(runId, hitlRequestId, {
              action: 'provide_input',
              kind: 'needs_input',
              input: options?.skipped ? { skipped: true, reason: options.reason } : payload,
              reason: options?.reason,
            });
          },
        });
        return true;
      };

      switch (action.type) {
        case 'submit': {
          const resumed = await submitAskUserQuestionToBackend(action.payload);
          submitToolInteraction(topicId, toolCallId, action.payload);
          showToast(resumed ? '已提交回答，正在继续执行…' : '已提交回答');
          onResolved?.();
          break;
        }
        case 'skip': {
          const resumed = await submitAskUserQuestionToBackend(
            { skipped: true },
            { skipped: true, reason: action.reason },
          );
          skipToolInteraction(topicId, toolCallId, action.reason);
          showToast(resumed ? '已跳过，正在继续执行…' : '已跳过');
          onResolved?.();
          break;
        }
        case 'cancel':
          resolveIntervention(topicId, toolCallId, 'reject', { reason: '用户取消' });
          showToast('已取消');
          onResolved?.();
          break;
        default:
          break;
      }
    },
    [
      assistantMessageId,
      identifier,
      onResolved,
      resolveIntervention,
      skipToolInteraction,
      submitToolInteraction,
      toolCallId,
      topicId,
    ],
  );

  if (useRuntimeHitl && resolvedHitlKind) {
    return (
      <RuntimeHitlIntervention
        actionsPortalTarget={actionsPortalTarget}
        allowedActions={allowedActions}
        assistantMessageId={assistantMessageId}
        hitlKind={resolvedHitlKind}
        hitlPrompt={hitlPrompt}
        permissionId={permissionId}
        requestArgs={requestArgs}
        toolCallId={toolCallId}
        topicId={topicId}
        onResolved={onResolved}
      />
    );
  }

  if (BuiltinRender) {
    if (isCustomInteraction) {
      return (
        <Flexbox gap={12}>
          <BuiltinRender
            actionsPortalTarget={actionsPortalTarget}
            apiName={apiName}
            args={parsedArgs}
            identifier={identifier}
            interactionMode="custom"
            messageId={toolMessageId}
            registerBeforeApprove={registerBeforeApprove}
            onArgsChange={handleArgsChange}
            onInteractionAction={handleInteractionAction}
          />
        </Flexbox>
      );
    }

    const isAdminBuiltinIntervention = identifier === TOOLSET_IDS.ADMIN;

    const actions = (
      <ApprovalActions
        apiName={apiName}
        approvalMode={approvalMode}
        assistantGroupId={assistantGroupId}
        assistantMessageId={assistantMessageId}
        identifier={identifier}
        permissionId={permissionId}
        reguideRejectReason={isAdminBuiltinIntervention ? ADMIN_REGUIDE_REJECT_REASON : undefined}
        requireHighRiskConfirm={
          isAdminBuiltinIntervention ? isHighRiskAdminIntervention(apiName) : undefined
        }
        showAdminReguide={isAdminBuiltinIntervention}
        topicId={topicId}
        toolCallId={toolCallId}
        onBeforeApprove={handleBeforeApprove}
        onResolved={onResolved}
      />
    );

    return (
      <Flexbox gap={12}>
        <SecurityBlacklistWarning args={parsedArgs} />
        <BuiltinRender
          apiName={apiName}
          args={parsedArgs}
          identifier={identifier}
          messageId={toolMessageId}
          registerBeforeApprove={registerBeforeApprove}
          onArgsChange={handleArgsChange}
        />
        {actionsPortalTarget ? createPortal(actions, actionsPortalTarget) : actions}
      </Flexbox>
    );
  }

  return (
    <Flexbox gap={12}>
      <SecurityBlacklistWarning args={parsedArgs} />
      <FallbackIntervention
        actionsPortalTarget={actionsPortalTarget}
        apiName={apiName}
        assistantGroupId={assistantGroupId}
        assistantMessageId={assistantMessageId}
        identifier={identifier}
        requestArgs={requestArgs}
        toolCallId={toolCallId}
        toolMessageId={toolMessageId}
        topicId={topicId}
        onResolved={onResolved}
      />
    </Flexbox>
  );
});
