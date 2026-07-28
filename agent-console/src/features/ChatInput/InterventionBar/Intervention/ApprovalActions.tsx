import { ActionIcon, Button, Checkbox, Flexbox, Input } from '@lobehub/ui';
import { Modal } from 'antd';
import { Check, CornerDownLeft, LucidePlus, LucideTrash, X } from 'lucide-react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useChatStore } from '../../../../stores';
import { useStreamingStore, type ApprovalMode } from '../../../../stores/streamingStore';
import { showToast, showErrorToast } from '../../../../services/ui/toast';
import { isAgentConsoleApiMode } from '../../../../adapters/registry';
import {
  approveRunPermissionViaPort,
  rejectRunPermissionViaPort,
  resolveRunHitlViaPort,
  getHttpErrorMessage,
} from '../../../../hooks/data/runHitlControl';
import { continueAgentRunAfterIntervention } from '../../../../services/streaming/continueAgentRunStream';
import { interventionStyles } from '../interventionStyles';
import { InterventionPanel } from '../InterventionSection';

interface ApprovalActionsProps {
  apiName: string;
  approvalMode: ApprovalMode;
  assistantGroupId?: string;
  assistantMessageId: string;
  identifier: string;
  permissionId?: string;
  topicId: string;
  toolCallId: string;
  onBeforeApprove?: () => void | Promise<void>;
  onResolved?: () => void;
  showAdminReguide?: boolean;
  reguideRejectReason?: string;
  requireHighRiskConfirm?: boolean;
}

type Choice = 'approve' | 'reject';

interface KeyValueItem {
  id: string;
  key?: string;
  value?: string;
}

const recordToFormList = (record: Record<string, unknown>): KeyValueItem[] =>
  Object.entries(record).map(([key, val], index) => ({
    id: `${key}-${index}`,
    key,
    value: typeof val === 'string' ? val : JSON.stringify(val),
  }));

const formListToRecord = (list: KeyValueItem[]): Record<string, unknown> => {
  const record: Record<string, unknown> = {};
  list.forEach((item) => {
    if (!item.key) return;
    try {
      record[item.key] = JSON.parse(item.value || '""');
    } catch {
      record[item.key] = item.value || '';
    }
  });
  return record;
};

/** §C.36*/
export const KeyValueEditor = memo(function KeyValueEditor({
  initialValue = {},
  onCancel,
  onChange,
  onFinish,
}: {
  initialValue?: Record<string, unknown>;
  onCancel?: () => void;
  onChange?: (value: Record<string, unknown>) => void;
  onFinish?: (value: Record<string, unknown>) => Promise<void>;
}) {
  const [items, setItems] = useState<KeyValueItem[]>(() => recordToFormList(initialValue));
  const [updating, setUpdating] = useState(false);

  const updateItems = useCallback(
    (next: KeyValueItem[]) => {
      setItems(next);
      onChange?.(formListToRecord(next));
    },
    [onChange],
  );

  const handleFinish = async () => {
    setUpdating(true);
    try {
      await onFinish?.(formListToRecord(items));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <InterventionPanel>
      <Flexbox gap={8}>
      {items.map((item, index) => (
        <Flexbox horizontal gap={8} key={item.id}>
          <Input
            className="mono"
            placeholder="key"
            style={{ flex: 1, fontFamily: 'var(--console-vars-font-family-code)', fontSize: 12 }}
            value={item.key}
            onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, key: e.target.value };
              updateItems(next);
            }}
          />
          <Input
            placeholder="value"
            style={{ flex: 2, fontFamily: 'var(--console-vars-font-family-code)', fontSize: 12 }}
            value={item.value}
            onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, value: e.target.value };
              updateItems(next);
            }}
          />
          <ActionIcon
            icon={LucideTrash}
            size="small"
            title="删除"
            onClick={() => updateItems(items.filter((_, i) => i !== index))}
          />
        </Flexbox>
      ))}
      <Button
        icon={LucidePlus}
        size="small"
        type="text"
        onClick={() => updateItems([...items, { id: `new-${Date.now()}`, key: '', value: '' }])}
      >
        添加字段
      </Button>
      <Flexbox horizontal gap={8} justify="flex-end">
        <Button className={interventionStyles.secondaryBtn} onClick={onCancel}>
          取消
        </Button>
        <Button
          className={interventionStyles.primaryBtn}
          loading={updating}
          type="primary"
          onClick={handleFinish}
        >
          保存
        </Button>
      </Flexbox>
      </Flexbox>
    </InterventionPanel>
  );
});

/** §C.36*/
export const ApprovalActions = memo(function ApprovalActions({
  approvalMode,
  apiName,
  assistantMessageId,
  identifier,
  permissionId: permissionIdProp,
  topicId,
  toolCallId,
  onBeforeApprove,
  onResolved,
  showAdminReguide,
  reguideRejectReason,
  requireHighRiskConfirm,
}: ApprovalActionsProps) {
  const [choice, setChoice] = useState<Choice>('approve');
  const [remember, setRemember] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const rejectInputRef = useRef<HTMLInputElement>(null);

  const resolveIntervention = useChatStore((s) => s.resolveIntervention);
  const addToolToAllowList = useStreamingStore((s) => s.addToolToAllowList);
  const getRunContextForTopic = useStreamingStore((s) => s.getRunContextForTopic);
  const clearPendingApprovalContext = useStreamingStore((s) => s.clearPendingApprovalContext);
  const isAllowListMode = approvalMode === 'allow-list';

  const submitToBackend = useCallback(async (submitChoice: Choice, rejectReason?: string) => {
    if (!isAgentConsoleApiMode()) return;
    const runContext = getRunContextForTopic(topicId);
    if (!runContext?.runId) {
      throw new Error('无法恢复运行：缺少运行上下文，请刷新页面后重试');
    }
    const { runId } = runContext;
    const permissionId = permissionIdProp ?? runContext.permissionId;
    const hitlRequestId = runContext.hitlRequestId;
    const resolvedRejectReason = rejectReason ?? (reason.trim() || undefined);

    if (submitChoice === 'approve') {
      await continueAgentRunAfterIntervention({
        topicId,
        runId,
        assistantMessageId,
        toolCallId,
        permissionId,
        hitlRequestId,
        interventionAction: 'approve',
        triggerResume: async () => {
          if (permissionId) {
            await approveRunPermissionViaPort(runId, permissionId);
          } else if (hitlRequestId) {
            await resolveRunHitlViaPort(runId, hitlRequestId, { action: 'allow' });
          } else {
            throw new Error('无法提交审批：缺少 permissionId');
          }
        },
      });
      useStreamingStore.getState().setActiveRunContext(topicId, { runId });
      return;
    }

    resolveIntervention(topicId, toolCallId, 'reject', {
      reason: resolvedRejectReason,
    });
    await continueAgentRunAfterIntervention({
      topicId,
      runId,
      assistantMessageId,
      toolCallId,
      permissionId,
      hitlRequestId,
      interventionAction: 'reject',
      triggerResume: async () => {
        if (permissionId) {
          await rejectRunPermissionViaPort(runId, permissionId, {
            reason: resolvedRejectReason,
          });
        } else if (hitlRequestId) {
          await resolveRunHitlViaPort(runId, hitlRequestId, {
            action: 'deny',
            reason: resolvedRejectReason,
          });
        } else {
          throw new Error('无法提交审批：缺少 permissionId');
        }
      },
    });
    clearPendingApprovalContext(topicId);
    useStreamingStore.getState().setActiveRunContext(topicId, { runId });
  }, [
    assistantMessageId,
    clearPendingApprovalContext,
    getRunContextForTopic,
    permissionIdProp,
    reason,
    resolveIntervention,
    toolCallId,
    topicId,
  ]);

  const handleSubmit = useCallback(async (submitChoice: Choice = choice, rejectReason?: string) => {
    if (loading) return;
    setChoice(submitChoice);
    setLoading(true);
    const resolvedRejectReason = rejectReason ?? (reason.trim() || undefined);
    try {
      if (submitChoice === 'approve') {
        if (onBeforeApprove) await onBeforeApprove();
      }
      if (isAgentConsoleApiMode()) {
        try {
          if (submitChoice === 'approve') {
            onResolved?.();
            if (isAllowListMode && remember) {
              addToolToAllowList(`${identifier}/${apiName}`);
            }
            showToast(
              isAllowListMode && remember ? '已加入允许列表，正在继续执行…' : '已批准，正在继续执行…',
            );
          }
          await submitToBackend(submitChoice, rejectReason);
        } catch (error) {
          const message = getHttpErrorMessage(error);
          if (message.includes('no pending permission')) {
            clearPendingApprovalContext(topicId);
            resolveIntervention(topicId, toolCallId, 'reject', {
              reason: '审批已过期，请刷新后继续',
            });
          }
          showErrorToast(message);
          return;
        }
        if (submitChoice === 'approve') {
          return;
        }
        showToast(rejectReason ? '已请求重新引导' : '已拒绝工具调用');
        onResolved?.();
        return;
      }
      if (submitChoice === 'approve') {
        resolveIntervention(topicId, toolCallId, 'approve');
        if (isAllowListMode && remember) {
          addToolToAllowList(`${identifier}/${apiName}`);
          showToast('已加入允许列表');
        } else {
          showToast('已批准工具调用');
        }
      } else {
        resolveIntervention(topicId, toolCallId, 'reject', {
          reason: resolvedRejectReason,
        });
        showToast(rejectReason ? '已请求重新引导' : '已拒绝工具调用');
      }
      onResolved?.();
    } finally {
      setLoading(false);
    }
  }, [
    addToolToAllowList,
    apiName,
    choice,
    identifier,
    isAllowListMode,
    loading,
    onBeforeApprove,
    onResolved,
    reason,
    remember,
    resolveIntervention,
    submitToBackend,
    topicId,
    toolCallId,
  ]);

  const handleApproveClick = useCallback(() => {
    if (requireHighRiskConfirm) {
      Modal.confirm({
        title: '此操作不可撤销',
        content: '请再次确认要执行该高危管理员操作。',
        okText: '确认执行',
        cancelText: '取消',
        onOk: () => handleSubmit('approve'),
      });
      return;
    }
    void handleSubmit('approve');
  }, [handleSubmit, requireHighRiskConfirm]);

  const handleReguide = useCallback(() => {
    if (!reguideRejectReason) return;
    void handleSubmit('reject', reguideRejectReason);
  }, [handleSubmit, reguideRejectReason]);

  useEffect(() => {
    if (choice === 'reject') rejectInputRef.current?.focus();
  }, [choice]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case '1':
          e.preventDefault();
          handleApproveClick();
          break;
        case '2':
          e.preventDefault();
          setChoice('reject');
          rejectInputRef.current?.focus();
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault();
          setChoice((c) => (c === 'approve' ? 'reject' : 'approve'));
          break;
        case 'Enter':
          if (e.shiftKey) return;
          e.preventDefault();
          if (choice === 'approve') {
            handleApproveClick();
          } else {
            void handleSubmit(choice);
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [choice, handleApproveClick, handleSubmit]);

  const handleRejectInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit('reject');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setChoice('approve');
      rejectInputRef.current?.blur();
    }
  };

  return (
    <div className={interventionStyles.actionDock}>
      {isAllowListMode ? (
        <div className={interventionStyles.rememberRow}>
          <Checkbox
            checked={remember}
            disabled={loading}
            onChange={(checked) => setRemember(Boolean(checked))}
          >
            记住此类工具，下次自动批准
          </Checkbox>
        </div>
      ) : null}

      {choice === 'reject' || reason ? (
        <div className={interventionStyles.rejectField}>
          <label className={interventionStyles.rejectLabel} htmlFor="intervention-reject-reason">
            拒绝说明（可选）
          </label>
          <input
            aria-label="拒绝理由"
            className={interventionStyles.rejectInput}
            disabled={loading}
            id="intervention-reject-reason"
            placeholder="告诉代理为什么要拒绝这次操作"
            ref={rejectInputRef}
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onFocus={() => setChoice('reject')}
            onKeyDown={handleRejectInputKeyDown}
          />
        </div>
      ) : null}

      <div className={interventionStyles.actionRow}>
        <Button
          className={interventionStyles.rejectBtn}
          disabled={loading}
          icon={X}
          size="large"
          onClick={() => {
            setChoice('reject');
            if (reason.trim()) {
              void handleSubmit('reject');
              return;
            }
            rejectInputRef.current?.focus();
          }}
        >
          拒绝
        </Button>
        {showAdminReguide ? (
          <Button
            className={interventionStyles.secondaryBtn}
            disabled={loading || !reguideRejectReason}
            size="large"
            onClick={handleReguide}
          >
            重新引导
          </Button>
        ) : null}
        <Button
          className={interventionStyles.approveBtn}
          disabled={loading}
          icon={Check}
          loading={loading && choice === 'approve'}
          size="large"
          type="primary"
          onClick={handleApproveClick}
        >
          批准并继续
          <span className={interventionStyles.shortcutHint}>
            <CornerDownLeft size={12} />
          </span>
        </Button>
      </div>
    </div>
  );
});
