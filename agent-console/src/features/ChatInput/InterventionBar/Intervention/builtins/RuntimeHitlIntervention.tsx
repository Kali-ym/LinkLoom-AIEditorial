import { Button, Flexbox, TextArea } from '@lobehub/ui';
import { memo, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { isAgentConsoleApiMode } from '../../../../../adapters/registry';
import { getHttpErrorMessage } from '../../../../../hooks/data/runHitlControl';
import { useChatStore } from '../../../../../stores';
import { useStreamingStore } from '../../../../../stores/streamingStore';
import { showToast } from '../../../../../services/ui/toast';
import { KeyValueEditor } from '../ApprovalActions';
import {
  defaultAllowedActionsForKind,
  isRuntimeHitlKind,
  RUNTIME_HITL_ACTION_LABELS,
} from '../runtimeHitl';
import { continueAgentRunAfterIntervention } from '../../../../../services/streaming/continueAgentRunStream';
import { InterventionSection } from '../../InterventionSection';
import { interventionStyles } from '../../interventionStyles';
import { submitRuntimeHitlResolution, type RunHitlResolveAction } from '../resolveRuntimeHitl';
import { safeParseJSON } from '../utils';

interface RuntimeHitlInterventionProps {
  actionsPortalTarget?: HTMLDivElement | null;
  allowedActions?: string[];
  assistantMessageId: string;
  hitlKind: string;
  hitlPrompt?: string;
  permissionId?: string;
  requestArgs: string;
  topicId: string;
  toolCallId: string;
  onResolved?: () => void;
}

function isApproveAction(action: RunHitlResolveAction): boolean {
  return (
    action === 'provide_input' ||
    action === 'external_result' ||
    action === 'edit_arguments' ||
    action === 'allow'
  );
}

/** §C.14 — runtime SSE HITL (needs_input / argument_edit / …) */
export const RuntimeHitlIntervention = memo(function RuntimeHitlIntervention({
  actionsPortalTarget,
  allowedActions,
  assistantMessageId,
  hitlKind,
  hitlPrompt,
  permissionId,
  requestArgs,
  topicId,
  toolCallId,
  onResolved,
}: RuntimeHitlInterventionProps) {
  const resolveIntervention = useChatStore((s) => s.resolveIntervention);
  const updatePluginArguments = useChatStore((s) => s.updatePluginArguments);

  const parsedArgs = useMemo(() => safeParseJSON(requestArgs) ?? {}, [requestArgs]);
  const allowedActionList = useMemo(
    () => allowedActions ?? defaultAllowedActionsForKind(hitlKind),
    [allowedActions, hitlKind],
  );

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditingArgs, setIsEditingArgs] = useState(false);

  const showTextInput = hitlKind === 'needs_input' || hitlKind === 'external_execution';
  const showArgumentEditor = hitlKind === 'argument_edit' && allowedActionList.includes('edit_arguments');

  const handleFinish = useCallback(
    async (action: RunHitlResolveAction, editedArgs?: Record<string, unknown>) => {
      if (loading) return;
      setLoading(true);
      try {
        if (isAgentConsoleApiMode()) {
          const runCtx = useStreamingStore.getState().getRunContextForTopic(topicId);
          const runId = runCtx?.runId;
          if (runId && isApproveAction(action)) {
            await continueAgentRunAfterIntervention({
              topicId,
              runId,
              assistantMessageId,
              toolCallId,
              permissionId: permissionId ?? runCtx?.permissionId,
              hitlRequestId: runCtx?.hitlRequestId,
              triggerResume: () =>
                submitRuntimeHitlResolution(action, {
                  topicId,
                  toolCallId,
                  permissionId,
                  kind: hitlKind,
                  input: input.trim() || undefined,
                  editedArguments: editedArgs ?? parsedArgs,
                  externalResult: input.trim() || undefined,
                }),
            });
            if (isApproveAction(action)) {
              showToast(action === 'edit_arguments' ? '已保存参数' : '已提交');
              onResolved?.();
              return;
            }
          } else {
            await submitRuntimeHitlResolution(action, {
              topicId,
              toolCallId,
              permissionId,
              kind: hitlKind,
              input: input.trim() || undefined,
              editedArguments: editedArgs ?? parsedArgs,
              externalResult: input.trim() || undefined,
            });
          }
        } else if (editedArgs) {
          updatePluginArguments(topicId, toolCallId, editedArgs);
        }

        if (isApproveAction(action)) {
          if (!isAgentConsoleApiMode()) {
            resolveIntervention(topicId, toolCallId, 'approve');
            showToast(action === 'edit_arguments' ? '已保存参数' : '已提交');
          }
        } else {
          resolveIntervention(topicId, toolCallId, 'reject', {
            reason: action === 'cancel' ? '用户取消' : '已拒绝',
          });
          showToast(action === 'cancel' ? '已取消' : '已拒绝');
        }
        if (!isAgentConsoleApiMode() || !isApproveAction(action)) {
          onResolved?.();
        }
      } catch (error) {
        const message = getHttpErrorMessage(error);
        showToast(message);
      } finally {
        setLoading(false);
      }
    },
    [assistantMessageId, hitlKind, input, loading, onResolved, parsedArgs, permissionId, resolveIntervention, toolCallId, topicId, updatePluginArguments],
  );

  if (isEditingArgs) {
    return (
      <KeyValueEditor
        initialValue={parsedArgs}
        onCancel={() => setIsEditingArgs(false)}
        onFinish={async (editedObject) => {
          setIsEditingArgs(false);
          await handleFinish('edit_arguments', editedObject);
        }}
      />
    );
  }

  const actionDock = (
    <div className={interventionStyles.actionDock}>
      <Flexbox horizontal gap={8} justify="flex-end" wrap="wrap">
        {allowedActionList.map((action) => {
          const typedAction = action as RunHitlResolveAction;
          const needsInput =
            (typedAction === 'provide_input' || typedAction === 'external_result') && !input.trim();
          const isDestructive = typedAction === 'cancel' || typedAction === 'deny';
          return (
            <Button
              className={
                isDestructive ? interventionStyles.secondaryBtn : interventionStyles.approveBtn
              }
              disabled={loading || needsInput}
              key={action}
              loading={loading}
              size="large"
              type={isDestructive ? 'default' : 'primary'}
              onClick={() => {
                if (typedAction === 'edit_arguments') {
                  setIsEditingArgs(true);
                  return;
                }
                void handleFinish(typedAction);
              }}
            >
              {RUNTIME_HITL_ACTION_LABELS[action] ?? action}
            </Button>
          );
        })}
      </Flexbox>
    </div>
  );

  return (
    <Flexbox gap={12}>
      <InterventionSection
        description="请完成以下步骤，代理才能继续执行。"
        title="需要你的输入"
      >
        <p className={interventionStyles.leadDesc}>
          {hitlPrompt || (isRuntimeHitlKind(hitlKind) ? `等待处理：${hitlKind}` : '等待人工确认')}
        </p>
      </InterventionSection>

      {showTextInput ? (
        <TextArea
          autoSize={{ minRows: 3, maxRows: 8 }}
          disabled={loading}
          placeholder={hitlKind === 'external_execution' ? '输入外部执行结果' : '输入你的回答'}
          value={input}
          variant="filled"
          onChange={(e) => setInput(e.target.value)}
        />
      ) : null}

      {showArgumentEditor && Object.keys(parsedArgs).length > 0 ? (
        <Button
          className={interventionStyles.secondaryBtn}
          disabled={loading}
          type="text"
          onClick={() => setIsEditingArgs(true)}
        >
          编辑参数（{Object.keys(parsedArgs).length}）
        </Button>
      ) : null}

      {actionsPortalTarget ? createPortal(actionDock, actionsPortalTarget) : actionDock}
    </Flexbox>
  );
});
