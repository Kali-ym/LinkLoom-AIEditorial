import { Block, Button, Flexbox, Icon, Input, Tag, Text } from '@lobehub/ui';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { InterventionSection } from '../../InterventionSection';
import { interventionStyles } from '../../interventionStyles';
import { formatAdminArgValue } from '../adminInterventionConfig';
import type { BuiltinInterventionProps } from '../types';

function extractPatch(args: Record<string, unknown>): Record<string, unknown> {
  const patch = args?.patch;
  if (patch && typeof patch === 'object' && !Array.isArray(patch)) {
    return { ...(patch as Record<string, unknown>) };
  }
  return {};
}

function patchEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const SettingsPatchIntervention = memo(function SettingsPatchIntervention({
  args,
  apiName,
  onArgsChange,
  registerBeforeApprove,
}: BuiltinInterventionProps) {
  const sourcePatch = useMemo(() => extractPatch(args || {}), [args]);
  const [draftPatch, setDraftPatch] = useState<Record<string, unknown>>(sourcePatch);
  const [isEditing, setIsEditing] = useState(false);
  const entries = useMemo(
    () => Object.entries(sourcePatch).filter(([, v]) => v !== undefined),
    [sourcePatch],
  );

  useEffect(() => {
    setDraftPatch(sourcePatch);
  }, [sourcePatch]);

  const saveDraftIfNeeded = useCallback(async () => {
    if (isEditing || !patchEqual(draftPatch, sourcePatch)) {
      await onArgsChange?.({ ...args, patch: draftPatch });
    }
  }, [args, draftPatch, isEditing, onArgsChange, sourcePatch]);

  useEffect(() => {
    if (!registerBeforeApprove || !apiName) return;
    return registerBeforeApprove(`admin-${apiName}`, saveDraftIfNeeded);
  }, [registerBeforeApprove, apiName, saveDraftIfNeeded]);

  if (isEditing) {
    const editEntries = Object.entries(draftPatch);
    return (
      <Flexbox
        gap={12}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <InterventionSection
          description="编辑将要写入的设置字段，确认后执行。"
          title="修改系统设置"
        />
        <Flexbox horizontal align="center" gap={8} style={{ color: '#dc2626' }}>
          <Icon icon={ShieldAlert} size={16} />
          <Text style={{ color: '#dc2626', fontWeight: 600 }}>高危:此操作不可撤销</Text>
        </Flexbox>
        <Block variant="borderless" width="100%" padding={12} gap={8}>
          {editEntries.length === 0 ? (
            <Text type="secondary">patch 为空</Text>
          ) : (
            editEntries.map(([key, value]) => (
              <Flexbox key={key} horizontal align="flex-start" gap={8}>
                <Tag style={{ minWidth: 120 }}>{key}</Tag>
                <Input
                  style={{ flex: 1, fontFamily: 'var(--console-vars-font-family-code)', fontSize: 12 }}
                  value={
                    typeof value === 'string' || typeof value === 'number'
                      ? String(value)
                      : JSON.stringify(value)
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    let parsed: unknown = raw;
                    try {
                      parsed = JSON.parse(raw);
                    } catch {
                      parsed = raw;
                    }
                    setDraftPatch((prev) => ({ ...prev, [key]: parsed }));
                  }}
                />
              </Flexbox>
            ))
          )}
        </Block>
        <Flexbox horizontal gap={8}>
          <Button
            className={interventionStyles.secondaryBtn}
            size="small"
            type="text"
            onClick={() => {
              setDraftPatch(sourcePatch);
              setIsEditing(false);
            }}
          >
            取消
          </Button>
          <Button
            size="small"
            type="primary"
            onClick={async () => {
              await onArgsChange?.({ ...args, patch: draftPatch });
              setIsEditing(false);
            }}
          >
            保存修改
          </Button>
        </Flexbox>
      </Flexbox>
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
        description="高危操作,请仔细核对以下设置变更后确认。"
        title="修改系统设置"
      />
      <Flexbox horizontal align="center" gap={8} style={{ color: '#dc2626' }}>
        <Icon icon={ShieldAlert} size={16} />
        <Text style={{ color: '#dc2626', fontWeight: 600 }}>高危:此操作不可撤销</Text>
      </Flexbox>
      <Block variant="borderless" width="100%" padding={12} gap={6}>
        {entries.length === 0 ? (
          <Text type="secondary">无 patch 字段(将直接执行)</Text>
        ) : (
          <Flexbox gap={6}>
            <Flexbox horizontal align="center" gap={8}>
              <Tag style={{ minWidth: 120, fontWeight: 600 }}>设置键</Tag>
              <Tag style={{ flex: 1, fontWeight: 600 }}>新值</Tag>
            </Flexbox>
            {entries.map(([key, value]) => (
              <Flexbox key={key} horizontal align="flex-start" gap={8}>
                <Tag style={{ minWidth: 120 }}>{key}</Tag>
                <Text style={{ wordBreak: 'break-all', flex: 1 }}>{formatAdminArgValue(value)}</Text>
              </Flexbox>
            ))}
          </Flexbox>
        )}
      </Block>
      {entries.length > 0 ? (
        <Button
          className={interventionStyles.secondaryBtn}
          size="small"
          type="text"
          onClick={() => setIsEditing(true)}
        >
          编辑 patch
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
