import { Flexbox, Icon, Input, InputNumber, Text, TextArea } from '@lobehub/ui';
import { Switch } from '@lobehub/ui/base-ui';
import { Editor, useEditor } from '@lobehub/editor/react';
import { createStaticStyles, cx } from 'antd-style';
import type { LucideIcon } from 'lucide-react';
import { Bot, Hand, RefreshCw, Scale } from 'lucide-react';
import { memo, useEffect } from 'react';

import type {
  VerifyCriterionView,
  VerifyOnFailStrategy,
  VerifyVerifierType,
} from '../../../../domain/types/toolPortal';
import { useVerifyPlanPortalStore } from '../../../../stores/verifyPlanPortalStore';
import type { ToolPortalProps } from '../../types';

const VERIFIERS: { icon: LucideIcon; type: VerifyVerifierType }[] = [
  { icon: Bot, type: 'agent' },
  { icon: Scale, type: 'llm' },
];

const ON_FAILS: { icon: LucideIcon; type: VerifyOnFailStrategy }[] = [
  { icon: RefreshCw, type: 'auto_repair' },
  { icon: Hand, type: 'manual' },
];

const styles = createStaticStyles(({ css, cssVar: v }) => ({
  card: css`
    padding: 10px 12px;
    border: 1px solid ${v.colorBorderSecondary};
    border-radius: ${v.borderRadiusLG};
    cursor: pointer;
    transition: border-color 0.2s;
  `,
  cardActive: css`
    border-color: ${v.colorPrimary};
  `,
  fieldLabel: css`
    font-size: 13px;
    font-weight: 500;
    color: ${v.colorTextSecondary};
  `,
  editorBlock: css`
    max-height: 240px;
    overflow: auto;
    padding: 8px 12px;
    border: 1px solid ${v.colorBorderSecondary};
    border-radius: ${v.borderRadiusLG};
  `,
}));

export const RubricConfigPanel = memo(function RubricConfigPanel() {
  const rubricName = useVerifyPlanPortalStore((s) => s.rubricName);
  const maxRepairRounds = useVerifyPlanPortalStore((s) => s.maxRepairRounds);
  const updateRubricConfig = useVerifyPlanPortalStore((s) => s.updateRubricConfig);

  return (
    <Flexbox gap={16}>
      <Flexbox gap={6}>
        <Text className={styles.fieldLabel}>Rubric 名称</Text>
        <Input
          value={rubricName ?? ''}
          onChange={(e) => updateRubricConfig({ rubricName: e.target.value })}
        />
      </Flexbox>
      <Flexbox gap={6}>
        <Text className={styles.fieldLabel}>最大修复轮次 (0–5)</Text>
        <InputNumber
          max={5}
          min={0}
          step={1}
          style={{ width: 120 }}
          value={maxRepairRounds ?? 0}
          onChange={(v) => updateRubricConfig({ maxRepairRounds: Number(v) })}
        />
      </Flexbox>
    </Flexbox>
  );
});

export const CriterionDetailPanel = memo(function CriterionDetailPanel({
  criterion,
  index,
}: {
  criterion: VerifyCriterionView;
  index: number;
}) {
  const updateCriterion = useVerifyPlanPortalStore((s) => s.updateCriterion);
  const editor = useEditor();

  useEffect(() => {
    editor.setDocument('text', criterion.instruction ?? '');
  }, [criterion.instruction, editor]);

  return (
    <Flexbox gap={16}>
      <TextArea
        autoSize
        placeholder="标题"
        style={{ fontSize: 18, fontWeight: 600, padding: 0 }}
        value={criterion.title}
        variant="borderless"
        onChange={(e) => updateCriterion(index, { title: e.target.value })}
      />
      <TextArea
        autoSize
        placeholder="描述"
        value={criterion.description ?? ''}
        variant="borderless"
        onChange={(e) => updateCriterion(index, { description: e.target.value })}
      />
      <Flexbox gap={6}>
        <Text className={styles.fieldLabel}>验收指令</Text>
        <div className={styles.editorBlock}>
          <Editor
            editor={editor}
            placeholder="编写验收步骤…"
            type="text"
            onTextChange={() => {
              const text = editor.getDocument('text');
              updateCriterion(index, {
                instruction: typeof text === 'string' ? text : String(text ?? ''),
              });
            }}
          />
        </div>
      </Flexbox>
      <Flexbox horizontal align="center" gap={8}>
        <Text className={styles.fieldLabel}>必需项</Text>
        <Switch
          checked={criterion.required}
          onChange={(checked) => updateCriterion(index, { required: checked })}
        />
      </Flexbox>
      <Flexbox gap={8}>
        <Text className={styles.fieldLabel}>验证器</Text>
        <Flexbox horizontal gap={8}>
          {VERIFIERS.map(({ icon, type }) => (
            <button
              key={type}
              className={cx(styles.card, criterion.verifierType === type && styles.cardActive)}
              type="button"
              onClick={() => updateCriterion(index, { verifierType: type })}
            >
              <Flexbox horizontal align="center" gap={6}>
                <Icon icon={icon} size={16} />
                <span>{type === 'agent' ? 'Agent' : 'LLM'}</span>
              </Flexbox>
            </button>
          ))}
        </Flexbox>
      </Flexbox>
      <Flexbox gap={8}>
        <Text className={styles.fieldLabel}>失败策略</Text>
        <Flexbox horizontal gap={8}>
          {ON_FAILS.map(({ icon, type }) => (
            <button
              key={type}
              className={cx(styles.card, criterion.onFail === type && styles.cardActive)}
              type="button"
              onClick={() => updateCriterion(index, { onFail: type })}
            >
              <Flexbox horizontal align="center" gap={6}>
                <Icon icon={icon} size={16} />
                <span>{type === 'auto_repair' ? '自动修复' : '人工介入'}</span>
              </Flexbox>
            </button>
          ))}
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
});

export const DeliveryCheckerPortalBody = memo(function DeliveryCheckerPortalBody({
  payload,
}: ToolPortalProps) {
  const params = payload.toolUIParams;
  const hydrateFromPayload = useVerifyPlanPortalStore((s) => s.hydrateFromPayload);
  const items = useVerifyPlanPortalStore((s) => s.items) ?? [];

  useEffect(() => {
    hydrateFromPayload(payload.pluginState as never);
  }, [hydrateFromPayload, payload.pluginState]);

  if (params?.view === 'rubric') {
    return <RubricConfigPanel />;
  }

  const index = typeof params?.index === 'number' ? params.index : 0;
  const criterion = items[index];
  if (!criterion) {
    return <Text type="secondary">无验收标准</Text>;
  }

  return <CriterionDetailPanel criterion={criterion} index={index} />;
});
