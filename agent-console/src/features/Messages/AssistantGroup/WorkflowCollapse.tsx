import { Accordion, AccordionItem, Block, Flexbox, Text } from '@lobehub/ui';
import { cssVar, createStaticStyles } from 'antd-style';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Hand, X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type Key } from 'react';

import { NeuralNetworkLoading } from '../../../components/NeuralNetworkLoading';
import { shinyTextStyles } from '../../../styles/shinyTextStyles';
import type { AssistantContentBlock } from '../../../domain/types';
import type { ToolPayload } from '../../../domain/types';
import {
  TIME_MS_PER_SECOND,
  WORKFLOW_HEADLINE_DEBOUNCE_MS,
  WORKFLOW_STREAMING_TITLE_MIN_HEIGHT_PX,
  WORKFLOW_WORKING_ELAPSED_SHOW_AFTER_MS,
} from './constants';
import {
  formatWorkflowDuration,
  getWorkflowCompletionStatus,
  getWorkflowStreamingHeadline,
  getWorkflowSummaryText,
  isTerminalToolState,
} from './toolDisplayNames';
import { filterResolvableTools } from '../../../domain/utils/toolDisplayIdentity';
import { WorkflowExpandedList } from './WorkflowExpandedList';

export type WorkflowExpandLevel = 'collapsed' | 'semi' | 'full';

export type WorkflowExpandLevelDefault =
  | WorkflowExpandLevel
  | { completion?: WorkflowExpandLevel; streaming?: WorkflowExpandLevel };

const styles = createStaticStyles(({ css }) => ({
  titleRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: ${WORKFLOW_STREAMING_TITLE_MIN_HEIGHT_PX}px;
  `,
  duration: css`
    font-size: 12px;
    color: ${cssVar.colorTextQuaternary};
    white-space: nowrap;
  `,
}));

const resolveExpandDefaults = (raw?: WorkflowExpandLevelDefault) => {
  if (!raw) return {};
  if (typeof raw === 'string') return { completion: raw, streaming: raw };
  return raw;
};

const collectTools = (blocks: AssistantContentBlock[]): ToolPayload[] =>
  filterResolvableTools(blocks.flatMap((b) => b.tools ?? []));

const hasPendingIntervention = (tools: ToolPayload[]) =>
  tools.some((t) => t.intervention?.status === 'pending');

/** False-positive abandonment before sibling tool_finished lands. */
const isTransientWorkflowError = (tool: ToolPayload): boolean =>
  tool.state === 'error' &&
  !tool.duration &&
  (tool.error === '未完成' || !tool.error?.trim());

function StatusBlock({ status }: { status: ReturnType<typeof getWorkflowCompletionStatus> }) {
  if (status === 'working') {
    return (
      <Block align="center" height={24} justify="center" variant="outlined" width={24}>
        <NeuralNetworkLoading size={14} />
      </Block>
    );
  }
  if (status === 'error') {
    return (
      <Block align="center" height={24} justify="center" variant="outlined" width={24}>
        <X color={cssVar.colorError} size={12} />
      </Block>
    );
  }
  if (status === 'warning') {
    return (
      <Block align="center" height={24} justify="center" variant="outlined" width={24}>
        <AlertTriangle color={cssVar.colorWarning} size={12} />
      </Block>
    );
  }
  return (
    <Block align="center" height={24} justify="center" variant="outlined" width={24}>
      <Check color={cssVar.colorSuccess} size={12} />
    </Block>
  );
}

/** §C.12 WorkflowCollapse*/
export const WorkflowCollapse = memo(function WorkflowCollapse({
  assistantMessageId,
  blocks,
  defaultWorkflowExpandLevel,
  isGenerating,
  topicId,
  workflowChromeComplete = false,
}: {
  assistantMessageId?: string;
  blocks: AssistantContentBlock[];
  defaultWorkflowExpandLevel?: WorkflowExpandLevelDefault;
  isGenerating: boolean;
  topicId?: string;
  workflowChromeComplete?: boolean;
}) {
  const allTools = useMemo(() => collectTools(blocks), [blocks]);
  const toolsPhaseComplete =
    allTools.length > 0 && allTools.every((t) => isTerminalToolState(t.state));
  const pendingIntervention = useMemo(() => hasPendingIntervention(allTools), [allTools]);
  const allComplete = toolsPhaseComplete && (workflowChromeComplete || !isGenerating);

  const { streaming: streamingDefault, completion: completionDefault } = useMemo(
    () => resolveExpandDefaults(defaultWorkflowExpandLevel),
    [defaultWorkflowExpandLevel],
  );
  const streamingInitial: WorkflowExpandLevel = streamingDefault ?? 'semi';
  const completionInitial: WorkflowExpandLevel = completionDefault ?? 'collapsed';

  const [expandLevel, setExpandLevel] = useState<WorkflowExpandLevel>(() =>
    toolsPhaseComplete ? completionInitial : streamingInitial,
  );
  const userOpenedRef = useRef(false);
  const prevToolsPhaseCompleteRef = useRef(toolsPhaseComplete);

  useEffect(() => {
    const wasToolsComplete = prevToolsPhaseCompleteRef.current;
    prevToolsPhaseCompleteRef.current = toolsPhaseComplete;
    if (!toolsPhaseComplete && wasToolsComplete) {
      userOpenedRef.current = false;
      setExpandLevel(streamingInitial);
      return;
    }
    if (toolsPhaseComplete && !wasToolsComplete && !userOpenedRef.current && allTools.length > 0) {
      setExpandLevel(completionInitial);
    }
  }, [toolsPhaseComplete, allTools.length, completionInitial, streamingInitial]);

  // Tool chrome is only "live" while tools are still in flight — once every tool
  // has a terminal state, show the completed summary even if the model is still
  // streaming the final answer (matches lobehub WorkflowCollapse semantics).
  const streaming = isGenerating && !toolsPhaseComplete;
  const forceExpanded = pendingIntervention && !allComplete;

  useEffect(() => {
    if (forceExpanded) setExpandLevel('semi');
  }, [forceExpanded]);

  const isExpanded = forceExpanded || expandLevel !== 'collapsed';
  const completionStatus = getWorkflowCompletionStatus(allTools);
  const hasTransientErrors = isGenerating && allTools.some(isTransientWorkflowError);
  const statusForBlock =
    pendingIntervention || streaming || hasTransientErrors ? 'working' : completionStatus;

  const headlineRaw = useMemo(() => {
    if (pendingIntervention) return '需要你确认';
    return getWorkflowStreamingHeadline(allTools, streaming);
  }, [allTools, pendingIntervention, streaming]);

  const [headline, setHeadline] = useState(headlineRaw);
  useEffect(() => {
    if (!streaming) {
      setHeadline(getWorkflowSummaryText(allTools));
      return;
    }
    if (pendingIntervention) {
      setHeadline(headlineRaw);
      return;
    }
    const id = window.setTimeout(() => setHeadline(headlineRaw), WORKFLOW_HEADLINE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [allTools, headlineRaw, pendingIntervention, streaming]);

  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!streaming) {
      startedAtRef.current = null;
      setElapsedSec(0);
      return;
    }
    if (pendingIntervention) return;
    if (startedAtRef.current == null) startedAtRef.current = Date.now();
    const id = window.setInterval(() => {
      if (startedAtRef.current == null) return;
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / TIME_MS_PER_SECOND));
    }, 200);
    return () => window.clearInterval(id);
  }, [pendingIntervention, streaming]);

  const showElapsed = streaming && elapsedSec * TIME_MS_PER_SECOND >= WORKFLOW_WORKING_ELAPSED_SHOW_AFTER_MS;

  const workflowScopeId = blocks[0]?.id ?? assistantMessageId ?? 'default';
  const itemKey = `workflow-${workflowScopeId}`;

  const handleExpandedChange = useCallback(
    (keys: Key[]) => {
      if (forceExpanded) return;
      const nextExpanded = keys.includes(itemKey);
      if (!nextExpanded) {
        setExpandLevel('collapsed');
        return;
      }
      userOpenedRef.current = true;
      setExpandLevel('semi');
    },
    [forceExpanded, itemKey],
  );

  if (!allTools.length) return null;

  const title = (
    <Flexbox className={styles.titleRow} horizontal align="center" gap={8}>
      <StatusBlock status={statusForBlock} />
      <Text
        className={streaming && !pendingIntervention ? shinyTextStyles.shinyText : undefined}
        ellipsis
        fontSize={13}
        style={{ color: pendingIntervention ? cssVar.colorInfo : undefined, flex: 1, minWidth: 0 }}
      >
        {pendingIntervention ? (
          <>
            <Hand size={12} />
            {headline}
          </>
        ) : streaming ? (
          <AnimatePresence mode="popLayout">
            <motion.span
              key={headline}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              initial={{ opacity: 0, y: 8 }}
              style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              {headline}
            </motion.span>
          </AnimatePresence>
        ) : (
          headline
        )}
      </Text>
      {showElapsed && <span className={styles.duration}>{formatWorkflowDuration(elapsedSec)}</span>}
    </Flexbox>
  );

  return (
    <Accordion
      expandedKeys={isExpanded ? [itemKey] : []}
      variant="borderless"
      onExpandedChange={handleExpandedChange}
    >
      <AccordionItem itemKey={itemKey} paddingBlock={4} paddingInline={4} title={title}>
        <WorkflowExpandedList
          assistantMessageId={assistantMessageId}
          constrained={isExpanded && streaming}
          streaming={streaming}
          tools={allTools}
          topicId={topicId}
        />
      </AccordionItem>
    </Accordion>
  );
});
