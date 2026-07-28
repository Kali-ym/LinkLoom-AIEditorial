import { ActionIcon, Flexbox, Icon } from '@lobehub/ui';
import { ChevronDown, ChevronRight, Edit3Icon, Hash } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { useChatStore } from '../../../../stores';
import { useStreamingStore } from '../../../../stores/streamingStore';
import { getToolDisplayName } from '../../../Messages/AssistantGroup/toolDisplayNames';
import { CommandSnippet } from '../CommandSnippet';
import { getInterventionMeta } from '../interventionMeta';
import { InterventionSection } from '../InterventionSection';
import { interventionStyles } from '../interventionStyles';
import { ApprovalActions, KeyValueEditor } from './ApprovalActions';
import { safeParseJSON } from './utils';

export const FallbackIntervention = memo(function FallbackIntervention({
  requestArgs,
  identifier,
  apiName,
  toolCallId,
  assistantGroupId,
  assistantMessageId,
  actionsPortalTarget,
  topicId,
  onResolved,
}: {
  requestArgs: string;
  toolMessageId: string;
  identifier: string;
  apiName: string;
  toolCallId: string;
  assistantGroupId?: string;
  assistantMessageId: string;
  actionsPortalTarget: HTMLDivElement | null;
  topicId: string;
  onResolved?: () => void;
}) {
  const approvalMode = useStreamingStore((s) => s.approvalMode);
  const updatePluginArguments = useChatStore((s) => s.updatePluginArguments);
  const [isEditing, setIsEditing] = useState(false);
  const [showArgs, setShowArgs] = useState(false);

  const parsedArgs = useMemo(() => safeParseJSON(requestArgs) ?? {}, [requestArgs]);
  const argCount = Object.keys(parsedArgs).length;
  const displayName = getToolDisplayName(apiName);
  const meta = getInterventionMeta(apiName, identifier);

  const isActivateTools = identifier === 'linkloom-activator' && apiName === 'activateTools';
  const activationReason =
    isActivateTools && typeof parsedArgs.reason === 'string' ? parsedArgs.reason : undefined;
  const requestedTools = useMemo(() => {
    if (!isActivateTools || !Array.isArray(parsedArgs.identifiers)) return [];
    return parsedArgs.identifiers.filter((item): item is string => typeof item === 'string');
  }, [isActivateTools, parsedArgs.identifiers]);

  const handleFinish = useCallback(
    async (editedObject: Record<string, unknown>) => {
      const newArgsString = JSON.stringify(editedObject, null, 2);
      if (newArgsString !== requestArgs) {
        updatePluginArguments(topicId, toolCallId, editedObject);
      }
      setIsEditing(false);
    },
    [requestArgs, toolCallId, topicId, updatePluginArguments],
  );

  if (isEditing) {
    return (
      <KeyValueEditor
        initialValue={parsedArgs}
        onCancel={() => setIsEditing(false)}
        onFinish={handleFinish}
      />
    );
  }

  const actions = (
    <ApprovalActions
      apiName={apiName}
      approvalMode={approvalMode}
      assistantGroupId={assistantGroupId}
      assistantMessageId={assistantMessageId}
      identifier={identifier}
      topicId={topicId}
      toolCallId={toolCallId}
      onResolved={onResolved}
    />
  );

  return (
    <Flexbox gap={12}>
      <InterventionSection title="操作详情">
        <p className={interventionStyles.leadDesc}>
          {activationReason ?? meta.subtitle}
        </p>
        <div className={interventionStyles.metaRow}>
          <span className={interventionStyles.metaChip}>
            <Icon icon={Hash} size={11} />
            {identifier}
          </span>
          <span className={interventionStyles.metaChip}>{displayName}</span>
          {requestedTools.map((tool) => (
            <span className={interventionStyles.metaChip} key={tool}>
              {tool}
            </span>
          ))}
        </div>
      </InterventionSection>

      {argCount > 0 ? (
        <InterventionSection title="调用参数">
          <button
            className={interventionStyles.collapseHeader}
            type="button"
            onClick={() => setShowArgs(!showArgs)}
          >
            <Icon icon={showArgs ? ChevronDown : ChevronRight} size={14} />
            {showArgs ? '收起' : '展开'} JSON（{argCount} 个字段）
            {showArgs ? (
              <ActionIcon
                icon={Edit3Icon}
                size="small"
                title="编辑"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
              />
            ) : null}
          </button>
          {showArgs ? <CommandSnippet language="json" text={requestArgs} /> : null}
        </InterventionSection>
      ) : null}

      {actionsPortalTarget ? createPortal(actions, actionsPortalTarget) : actions}
    </Flexbox>
  );
});
