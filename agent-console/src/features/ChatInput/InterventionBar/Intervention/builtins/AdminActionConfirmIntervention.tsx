import { Block, Button, Flexbox, Icon, Tag, Text } from '@lobehub/ui';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { InterventionSection } from '../../InterventionSection';
import { interventionStyles } from '../../interventionStyles';
import { KeyValueEditor } from '../ApprovalActions';
import {
  ADMIN_PARAM_LABELS,
  formatAdminArgValue,
  isHighRiskAdminIntervention,
} from '../adminInterventionConfig';
import type { BuiltinInterventionProps } from '../types';

function argsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const AdminActionConfirmIntervention = memo(function AdminActionConfirmIntervention({
  args,
  apiName,
  onArgsChange,
  registerBeforeApprove,
}: BuiltinInterventionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftArgs, setDraftArgs] = useState<Record<string, unknown>>(args || {});
  const entries = useMemo(() => Object.entries(args || {}).filter(([, v]) => v !== undefined), [args]);
  const isHighRisk = isHighRiskAdminIntervention(apiName);

  useEffect(() => {
    setDraftArgs(args || {});
  }, [args]);

  const saveDraftIfNeeded = useCallback(async () => {
    const current = args || {};
    if (isEditing || !argsEqual(draftArgs, current)) {
      await onArgsChange?.(draftArgs);
    }
  }, [args, draftArgs, isEditing, onArgsChange]);

  useEffect(() => {
    if (!registerBeforeApprove || !apiName) return;
    return registerBeforeApprove(`admin-${apiName}`, saveDraftIfNeeded);
  }, [registerBeforeApprove, apiName, saveDraftIfNeeded]);

  if (isEditing) {
    return (
      <KeyValueEditor
        initialValue={draftArgs}
        onCancel={() => {
          setDraftArgs(args || {});
          setIsEditing(false);
        }}
        onChange={setDraftArgs}
        onFinish={async (editedObject) => {
          setDraftArgs(editedObject);
          await onArgsChange?.(editedObject);
          setIsEditing(false);
        }}
      />
    );
  }

  return (
    <Flexbox
      gap={12}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <InterventionSection
        description={isHighRisk ? '高危操作,请仔细核对参数后确认。' : '请核对以下参数,确认后执行。'}
        title="管理员操作确认"
      />
      {isHighRisk ? (
        <Flexbox horizontal align="center" gap={8} style={{ color: '#dc2626' }}>
          <Icon icon={ShieldAlert} size={16} />
          <Text style={{ color: '#dc2626', fontWeight: 600 }}>高危:此操作不可撤销</Text>
        </Flexbox>
      ) : null}
      <Block variant="borderless" width="100%" padding={12} gap={6}>
        {entries.length === 0 ? (
          <Text type="secondary">无参数(将直接执行)</Text>
        ) : (
          entries.map(([key, value]) => (
            <Flexbox key={key} horizontal align="flex-start" gap={8}>
              <Tag style={{ minWidth: 88 }}>{ADMIN_PARAM_LABELS[key] || key}</Tag>
              <Text style={{ wordBreak: 'break-all' }}>{formatAdminArgValue(value)}</Text>
            </Flexbox>
          ))
        )}
      </Block>
      {entries.length > 0 ? (
        <Button
          className={interventionStyles.secondaryBtn}
          size="small"
          type="text"
          onClick={() => setIsEditing(true)}
        >
          编辑参数
        </Button>
      ) : null}
      <Flexbox horizontal align="center" gap={6}>
        <Icon icon={CheckCircle2} size={14} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          确认后将调用 {apiName} 工具执行
        </Text>
      </Flexbox>
    </Flexbox>
  );
});
