import {
  Accordion,
  AccordionItem,
  Avatar,
  Flexbox,
  Icon,
  Input,
  InputNumber,
  stopPropagation,
  Text,
  TextArea,
  Tooltip,
} from '@lobehub/ui';
import { createStaticStyles, useTheme } from 'antd-style';
import { Clock, Trash2 } from 'lucide-react';
import { type ChangeEvent, memo, useCallback, useEffect, useState } from 'react';

import { useAgentStore } from '../../../../../stores/agentStore';
import { InterventionPanel, InterventionSection } from '../../InterventionSection';
import type { BuiltinInterventionProps } from '../types';

const DEFAULT_TIMEOUT = 1_800_000;

const DEMO_AGENT_META: Record<string, { avatar: string; title: string }> = {
  'agent-research': { avatar: '🔍', title: '研究助理' },
  researcher: { avatar: '🔍', title: '研究员' },
  writer: { avatar: '✍️', title: '写作助理' },
};

const styles = createStaticStyles(({ css, cssVar }) => ({
  agentTitle: css`
    overflow: hidden;
    font-size: 14px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  assignee: css`
    display: flex;
    flex-shrink: 0;
    gap: 6px;
    align-items: center;
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
  deleteButton: css`
    cursor: pointer;
    color: ${cssVar.colorTextTertiary};
    transition: color 0.2s;

    &:hover {
      color: ${cssVar.colorError};
    }
  `,
  timeoutInput: css`
    width: 100px;
  `,
}));

function useAgentMeta(agentId?: string) {
  const catalogAgent = useAgentStore((s) =>
    agentId ? s.agents.find((agent) => agent.id === agentId) : undefined,
  );
  if (!agentId) return { avatar: '🤖', title: '未知助理' };
  if (catalogAgent) {
    return {
      avatar: '🤖',
      title: catalogAgent.name,
    };
  }
  return DEMO_AGENT_META[agentId] ?? { avatar: '🤖', title: agentId };
}

/** §C.36*/
export const ExecuteTaskIntervention = memo(function ExecuteTaskIntervention({
  args,
  onArgsChange,
  registerBeforeApprove,
}: BuiltinInterventionProps) {
  const agentId = typeof args.agentId === 'string' ? args.agentId : '';
  const agent = useAgentMeta(agentId);
  const [instruction, setInstruction] = useState(
    typeof args.instruction === 'string' ? args.instruction : '',
  );
  const [timeout, setTimeout] = useState(
    typeof args.timeout === 'number' ? args.timeout : DEFAULT_TIMEOUT,
  );
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!hasChanges) {
      setInstruction(typeof args.instruction === 'string' ? args.instruction : '');
      setTimeout(typeof args.timeout === 'number' ? args.timeout : DEFAULT_TIMEOUT);
    }
  }, [args.instruction, args.timeout, hasChanges]);

  useEffect(() => {
    if (!registerBeforeApprove) return;
    return registerBeforeApprove('executeTask', async () => {
      if (hasChanges) {
        await onArgsChange?.({ ...args, instruction, timeout });
      }
    });
  }, [args, hasChanges, instruction, onArgsChange, registerBeforeApprove, timeout]);

  const handleInstructionChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setInstruction(e.target.value);
    setHasChanges(true);
  }, []);

  const handleTimeoutChange = useCallback((value: number | string | null) => {
    if (typeof value === 'number') {
      setTimeout(value * 60_000);
      setHasChanges(true);
    }
  }, []);

  return (
    <Flexbox gap={12}>
      <InterventionSection
        description="批准后将把任务委派给指定 Agent 执行。"
        title="委派任务"
      />
      <InterventionPanel>
        <Flexbox gap={12}>
          <Flexbox horizontal align="center" justify="space-between">
            <Flexbox horizontal align="center" flex={1} gap={12} style={{ minWidth: 0 }}>
              <Avatar avatar={agent.avatar} size={24} style={{ borderRadius: 8, flexShrink: 0 }} />
              <Flexbox flex={1} gap={4} style={{ minWidth: 0 }}>
                <span className={styles.agentTitle}>{agent.title}</span>
              </Flexbox>
            </Flexbox>
            <Flexbox horizontal align="center" gap={8} style={{ flexShrink: 0 }}>
              <Tooltip title="超时（分钟）">
                <Clock size={14} />
              </Tooltip>
              <InputNumber
                className={styles.timeoutInput}
                max={120}
                min={1}
                size="small"
                suffix="分钟"
                value={Math.round(timeout / 60_000)}
                variant="filled"
                onChange={handleTimeoutChange}
              />
            </Flexbox>
          </Flexbox>
          <TextArea
            autoSize={{ maxRows: 10, minRows: 6 }}
            placeholder="任务说明"
            value={instruction}
            onChange={handleInstructionChange}
          />
        </Flexbox>
      </InterventionPanel>
    </Flexbox>
  );
});

interface TaskItem {
  agentId?: string;
  instruction?: string;
  timeout?: number;
  title?: string;
}

interface TaskEditorProps {
  index: number;
  onChange: (index: number, updates: Partial<TaskItem>) => void;
  onDelete: (index: number) => void;
  task: TaskItem;
}

const TaskEditor = memo(function TaskEditor({ task, index, onChange, onDelete }: TaskEditorProps) {
  const theme = useTheme();
  const agent = useAgentMeta(task.agentId);

  return (
    <AccordionItem
      defaultExpand
      itemKey={String(index)}
      paddingBlock={4}
      paddingInline={2}
      title={
        <Flexbox horizontal align="center" gap={8}>
          <div className={styles.assignee}>
            <Avatar
              avatar={agent.avatar}
              background={theme.colorBgContainer}
              shape="circle"
              size={20}
            />
            <span>{agent.title}</span>
          </div>
        </Flexbox>
      }
    >
      <Flexbox gap={12} style={{ marginTop: 8 }}>
        <Flexbox horizontal gap={12}>
          <Input
            placeholder="任务标题"
            size="small"
            value={task.title ?? ''}
            variant="filled"
            onChange={(e) => onChange(index, { title: e.target.value })}
          />
          <Flexbox horizontal align="center" gap={8} onClick={stopPropagation}>
            <Tooltip title="超时（分钟）">
              <Clock size={14} />
            </Tooltip>
            <InputNumber
              className={styles.timeoutInput}
              max={120}
              min={1}
              size="small"
              suffix="分钟"
              value={Math.round((task.timeout || DEFAULT_TIMEOUT) / 60_000)}
              variant="filled"
              onChange={(value) => {
                if (typeof value === 'number') onChange(index, { timeout: value * 60_000 });
              }}
            />
            <Icon
              className={styles.deleteButton}
              icon={Trash2}
              size={{ size: 16 }}
              onClick={() => onDelete(index)}
            />
          </Flexbox>
        </Flexbox>
        <TextArea
          autoSize={{ maxRows: 20, minRows: 8 }}
          placeholder="任务说明"
          value={task.instruction ?? ''}
          variant="filled"
          onChange={(e) => onChange(index, { instruction: e.target.value })}
        />
      </Flexbox>
    </AccordionItem>
  );
});

/** §C.36*/
export const ExecuteTasksIntervention = memo(function ExecuteTasksIntervention({
  args,
  onArgsChange,
  registerBeforeApprove,
}: BuiltinInterventionProps) {
  const initialTasks = Array.isArray(args.tasks) ? (args.tasks as TaskItem[]) : [];
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!hasChanges) {
      setTasks(Array.isArray(args.tasks) ? (args.tasks as TaskItem[]) : []);
    }
  }, [args.tasks, hasChanges]);

  const handleTaskChange = useCallback((index: number, updates: Partial<TaskItem>) => {
    setTasks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
    setHasChanges(true);
  }, []);

  const handleTaskDelete = useCallback((index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  }, []);

  useEffect(() => {
    if (!registerBeforeApprove) return;
    return registerBeforeApprove('executeTasks', async () => {
      if (hasChanges) {
        await onArgsChange?.({ ...args, tasks });
      }
    });
  }, [args, hasChanges, onArgsChange, registerBeforeApprove, tasks]);

  if (tasks.length === 0) {
    return <Text type="secondary">暂无委派任务</Text>;
  }

  return (
    <Flexbox gap={12}>
      <InterventionSection
        description={`将并行委派 ${tasks.length} 个 Agent 任务，批准前可编辑说明与超时。`}
        title="批量委派"
      />
      <InterventionPanel>
        <Accordion gap={0} variant="borderless">
          {tasks.map((task, index) => (
            <TaskEditor
              index={index}
              key={task.agentId || `task-${index}`}
              task={task}
              onChange={handleTaskChange}
              onDelete={handleTaskDelete}
            />
          ))}
        </Accordion>
      </InterventionPanel>
    </Flexbox>
  );
});
