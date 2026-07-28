import { ActionIcon } from '@lobehub/ui';
import { Bug, BugOff, LayoutPanelTop, Logs, Trash2 } from 'lucide-react';
import { memo, useState } from 'react';

import { usePermission } from '../../../../../hooks/usePermission';
import { useChatStore } from '../../../../../stores/chatStore';
import {
  getToolSettingsSchema,
  isToolSettingsSchemaNonEmpty,
} from '../toolInspectorUtils';
import { PluginDetailModal } from '../PluginDetailModal';
import { ToolSettingsAction } from './Settings';
import { toolActionStrings } from './toolActionStrings';
import type { ToolPayload } from '../../../../../domain/types/tool';

export interface ToolRemovalRef {
  messageId: string;
  toolCallId: string;
}

/** §C.26 Tool Inspector Actions*/
export const ToolActions = memo(function ToolActions({
  assistantMessageId,
  canToggleCustomToolRender,
  pluginId,
  showCustomToolRender,
  showDebug,
  tool,
  toolRemoval,
  topicId,
  onToggleCustomRender,
  onToggleDebug,
  onDeleteFallback,
}: {
  assistantMessageId: string;
  canToggleCustomToolRender: boolean;
  pluginId: string;
  showCustomToolRender: boolean;
  showDebug: boolean;
  tool: ToolPayload;
  toolRemoval?: ToolRemovalRef;
  topicId?: string;
  onToggleCustomRender: () => void;
  onToggleDebug: () => void;
  onDeleteFallback?: () => void;
}) {
  const { allowed: canEdit } = usePermission('edit_own_content');
  const deleteMessage = useChatStore((s) => s.deleteMessage);
  const removeToolFromMessage = useChatStore((s) => s.removeToolFromMessage);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const schema = getToolSettingsSchema(tool);
  const hasSettings = isToolSettingsSchemaNonEmpty(schema);

  const handleDelete = () => {
    if (!topicId) {
      onDeleteFallback?.();
      return;
    }
    if (toolRemoval) {
      removeToolFromMessage(topicId, toolRemoval.messageId, toolRemoval.toolCallId);
      return;
    }
    deleteMessage(topicId, assistantMessageId);
  };

  return (
    <>
      {canToggleCustomToolRender ? (
        <ActionIcon
          icon={showCustomToolRender ? Logs : LayoutPanelTop}
          size="small"
          title={
            showCustomToolRender
              ? toolActionStrings.inspectorArgs
              : toolActionStrings.inspectorPluginRender
          }
          onClick={(e) => {
            e.stopPropagation();
            onToggleCustomRender();
          }}
        />
      ) : null}
      <ActionIcon
        active={showDebug}
        icon={showDebug ? BugOff : Bug}
        size="small"
        title={showDebug ? toolActionStrings.debugOff : toolActionStrings.debugOn}
        onClick={(e) => {
          e.stopPropagation();
          onToggleDebug();
        }}
      />
      {canEdit && hasSettings ? (
        <ToolSettingsAction onClick={() => setSettingsOpen(true)} />
      ) : null}
      {canEdit ? (
        <ActionIcon
          danger
          icon={Trash2}
          size="small"
          title={toolActionStrings.delete}
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
        />
      ) : null}
      {schema ? (
        <PluginDetailModal
          open={settingsOpen}
          pluginId={pluginId}
          schema={schema}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </>
  );
});
