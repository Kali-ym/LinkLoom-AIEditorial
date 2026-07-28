import {
  Accordion,
  AccordionItem,
  Alert,
  Flexbox,
  SyntaxHighlighter,
  Text,
} from '@lobehub/ui';
import type { Key } from 'react';
import { memo, useCallback, useEffect, useState } from 'react';

import type { ToolPayload } from '../../domain/types/tool';
import { hasResolvableToolIdentity } from '../../domain/utils/toolDisplayIdentity';
import { isToolAwaitingIntervention } from '../../domain/utils/toolReference';
import { normalizeToolPluginId } from '../../hooks/data/useToolPortal';
import { openToolUI } from '../Portal/portalActions';
import { ToolActions, type ToolRemovalRef } from './AssistantGroup/Tool/Actions';
import { ToolArgsPreview } from './AssistantGroup/Tool/shared/ToolArgsPreview';
import { ToolDetail } from './AssistantGroup/Tool/Detail';
import {
  canToggleCustomToolRender,
  hasStreamingRenderer,
  resolveRenderDisplayControl,
} from './AssistantGroup/Tool/toolInspectorUtils';
import {
  detectArgumentsStreaming,
  resolveToolApiName,
  resolveToolIdentifier,
  resolveToolRequestArgs,
} from './AssistantGroup/Tool/toolArgsUtils';
import { ToolStatusBadge } from './ToolStatusBadge';
import { renderToolTitle } from './ToolTitle';

function toolPortalTitle(tool: ToolPayload): string {
  if (tool.customTitle) return tool.customTitle;
  return `${tool.plugin ?? 'plugin'} › ${tool.api ?? 'api'}`;
}

function formatDuration(tool: ToolPayload, executing: boolean): string {
  if (executing) return '0.0s';
  const d = tool.duration ?? '1.2';
  return String(d).includes('s') ? d : `${d}s`;
}

/** §C.3 / §C.26 / §C.43 Tool Inspector */
export const ToolAccordion = memo(function ToolAccordion({
  tool,
  id,
  defaultOpen,
  showActions = true,
  inWorkflow = false,
  onRemove,
  topicId,
  assistantMessageId,
  toolRemoval,
  disableEditing = false,
}: {
  tool: ToolPayload;
  id?: string;
  defaultOpen?: boolean;
  showActions?: boolean;
  inWorkflow?: boolean;
  onRemove?: () => void;
  topicId?: string;
  assistantMessageId?: string;
  toolRemoval?: ToolRemovalRef;
  disableEditing?: boolean;
}) {
  const state = tool.state || 'success';
  const displayState = isToolAwaitingIntervention(tool) ? 'pending' : state;
  const executing = displayState === 'executing';
  const aborted = state === 'aborted';
  const itemKey = id || tool.id || 'tool';
  const renderDisplayControl = resolveRenderDisplayControl(tool);
  const isAlwaysExpand = renderDisplayControl === 'alwaysExpand';

  const identifier = resolveToolIdentifier(tool);
  const apiName = resolveToolApiName(tool);
  const requestArgs = resolveToolRequestArgs(tool);
  const isArgumentsStreaming = detectArgumentsStreaming(tool, requestArgs);
  const streamingRenderer = hasStreamingRenderer(tool);
  const forceShowStreamingRender = isArgumentsStreaming && streamingRenderer;
  const isToolCalling = executing && !isArgumentsStreaming;

  if (!hasResolvableToolIdentity(tool)) return null;

  const initialOpen =
    defaultOpen ?? (executing || state === 'pending' || Boolean(forceShowStreamingRender));

  const [open, setOpen] = useState(initialOpen);
  const [showCustomToolRender, setShowCustomToolRender] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [removed, setRemoved] = useState(false);

  const pluginId = tool.plugin ?? tool.identifier ?? 'plugin';
  const messageId = assistantMessageId ?? id ?? itemKey;
  const toolCallId = tool.toolCallId ?? tool.id ?? itemKey;

  const debug =
    tool.debug ??
    `toolCallId: ${toolCallId}\nidentifier: ${pluginId}\napiName: ${apiName}\nstate: ${state}`;

  const isToolDetailExpand = open || showDebug || executing || Boolean(forceShowStreamingRender);

  useEffect(() => {
    if (executing || state === 'pending' || forceShowStreamingRender) {
      setOpen(true);
      return;
    }
    setOpen(false);
    setShowDebug(false);
  }, [executing, forceShowStreamingRender, state]);

  const openPortal = useCallback(() => {
    const normalized = normalizeToolPluginId(pluginId);
    const toolApiName = tool.api ?? tool.apiName ?? '';
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(requestArgs) as Record<string, unknown>;
    } catch {
      args = (tool.params ?? tool.arguments ?? tool.args ?? {}) as Record<string, unknown>;
    }
    const toolUIParams =
      normalized === 'linkloom-delivery-checker' && toolApiName === 'generateVerifyPlan'
        ? { index: 0 }
        : normalized === 'linkloom-web-browsing' && toolApiName === 'crawlMultiPages'
          ? {
              url:
                typeof args === 'object' && args && 'url' in args ? String(args.url) : undefined,
            }
          : undefined;

    openToolUI({
      title: toolPortalTitle(tool),
      plugin: normalized,
      api: toolApiName,
      messageId,
      state: tool.state,
      duration: tool.duration ? `${tool.duration}s` : undefined,
      args,
      result: tool.resultText,
      ...(toolUIParams ? { toolUIParams } : {}),
    });
  }, [messageId, pluginId, requestArgs, tool]);

  const handleExpandChange = useCallback(
    (keys: Key[]) => {
      if (isAlwaysExpand && !keys.includes(itemKey)) return;
      const next = keys.includes(itemKey);
      if (!next) setShowDebug(false);
      setOpen(next);
    },
    [isAlwaysExpand, itemKey],
  );

  const handleToggleDebug = useCallback(() => {
    setShowDebug((prev) => {
      const next = !prev;
      if (next) setOpen(true);
      return next;
    });
  }, []);

  const handleToggleCustomRender = useCallback(() => {
    setShowCustomToolRender((prev) => !prev);
  }, []);

  const handleDeleteFallback = useCallback(() => {
    onRemove?.();
    setRemoved(true);
  }, [onRemove]);

  if (removed) return null;
  if (inWorkflow && tool.intervention?.status === 'pending' && tool.toolCallId) return null;

  const titleRow = (
    <Flexbox horizontal align="center" gap={8} style={{ minWidth: 0, flex: 1 }}>
      <ToolStatusBadge state={displayState} />
      {renderToolTitle(tool, executing, aborted)}
      <Text style={{ flexShrink: 0, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
        {formatDuration(tool, executing)}
      </Text>
    </Flexbox>
  );

  const actions = showActions ? (
    <ToolActions
      assistantMessageId={messageId}
      canToggleCustomToolRender={canToggleCustomToolRender(tool)}
      pluginId={pluginId}
      showCustomToolRender={showCustomToolRender}
      showDebug={showDebug}
      tool={tool}
      toolRemoval={toolRemoval}
      topicId={topicId}
      onDeleteFallback={handleDeleteFallback}
      onToggleCustomRender={handleToggleCustomRender}
      onToggleDebug={handleToggleDebug}
    />
  ) : undefined;

  const canToggleRenderView = canToggleCustomToolRender(tool) && !forceShowStreamingRender;

  const detailBody = (
    <ToolDetail
      apiName={apiName}
      disableEditing={disableEditing}
      fallbackResult={tool.resultContent ?? tool.resultText}
      identifier={identifier}
      intervention={tool.intervention}
      isArgumentsStreaming={isArgumentsStreaming}
      isToolCalling={isToolCalling}
      messageId={messageId}
      pluginState={tool.pluginState}
      requestArgs={requestArgs}
      showCustomToolRender={showCustomToolRender}
      toolCallId={toolCallId}
      toolMessageId={tool.id}
      onOpenPortal={state === 'success' && !tool.hidePortal ? openPortal : undefined}
    />
  );

  const inspectorBody =
    canToggleRenderView && !showCustomToolRender ? (
      <ToolArgsPreview arguments={requestArgs} loading={executing || isArgumentsStreaming} />
    ) : (
      detailBody
    );

  return (
    <div className={`tool-accordion${inWorkflow ? ' in-workflow' : ''}`} data-type="tool" id={id}>
      <Accordion
        expandedKeys={isToolDetailExpand ? [itemKey] : []}
        onExpandedChange={handleExpandChange}
      >
        <AccordionItem
      action={actions}
      alwaysShowAction={Boolean(actions)}
      hideIndicator={isAlwaysExpand}
      itemKey={itemKey}
      paddingBlock={4}
      paddingInline={4}
      title={titleRow}
    >
      <Flexbox gap={8} paddingBlock={8}>
        {displayState === 'error' && (
              <Alert showIcon type="error" message={`错误：${tool.error || '未收到执行结果'}`} />
            )}
            {state === 'rejected' && (
              <Alert
                showIcon
                type="warning"
                message={`已拒绝：${tool.rejectedReason || '用户拒绝了此工具调用'}`}
              />
            )}
            {state === 'aborted' && <Alert showIcon type="info" message="工具调用已终止" />}
            {inspectorBody}
            {showDebug && (
              <SyntaxHighlighter language="text" variant="borderless">
                {debug}
              </SyntaxHighlighter>
            )}
          </Flexbox>
        </AccordionItem>
      </Accordion>
    </div>
  );
});
