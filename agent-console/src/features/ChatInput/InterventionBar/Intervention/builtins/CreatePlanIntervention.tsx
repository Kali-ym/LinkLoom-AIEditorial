import {
  ReactCodeblockPlugin,
  ReactCodePlugin,
  ReactHRPlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactMathPlugin,
  ReactTablePlugin,
} from '@lobehub/editor';
import { Editor, useEditor } from '@lobehub/editor/react';
import { Flexbox, TextArea } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { InterventionPanel, InterventionSection } from '../../InterventionSection';
import type { BuiltinInterventionProps } from '../types';

const PLAN_PLUGINS = [
  ReactListPlugin,
  ReactCodePlugin,
  ReactCodeblockPlugin,
  ReactHRPlugin,
  ReactLinkPlugin,
  ReactTablePlugin,
  ReactMathPlugin,
];

const styles = createStaticStyles(({ css, cssVar }) => ({
  description: css`
    font-size: 14px;
    color: ${cssVar.colorTextSecondary};
  `,
  title: css`
    font-size: 22px;
    font-weight: 600;
    line-height: 1.3;
  `,
}));

export const CreatePlanIntervention = memo(function CreatePlanIntervention({
  args,
  onArgsChange,
  registerBeforeApprove,
}: BuiltinInterventionProps) {
  const [goal, setGoal] = useState(typeof args.goal === 'string' ? args.goal : '');
  const [description, setDescription] = useState(
    typeof args.description === 'string' ? args.description : '',
  );
  const editor = useEditor();
  const editorInitializedRef = useRef(false);

  useEffect(() => {
    if (!editor || editorInitializedRef.current) return;
    const context = typeof args.context === 'string' ? args.context : '';
    if (context) {
      editor.setDocument('text', context);
      editorInitializedRef.current = true;
    }
  }, [args.context, editor]);

  const getContext = useCallback(() => {
    if (!editor) return typeof args.context === 'string' ? args.context : '';
    return (editor.getDocument('text') as unknown as string) || '';
  }, [args.context, editor]);

  const save = useCallback(async () => {
    await onArgsChange?.({
      context: getContext() || undefined,
      description,
      goal,
    });
  }, [description, getContext, goal, onArgsChange]);

  useEffect(() => {
    if (!registerBeforeApprove) return;
    return registerBeforeApprove('createPlan', save);
  }, [registerBeforeApprove, save]);

  const focusDescription = useCallback(() => {
    const el = document.querySelector<HTMLTextAreaElement>('[data-plan-description]');
    el?.focus();
  }, []);

  return (
    <Flexbox
      gap={12}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <InterventionSection
        description="批准前可编辑目标与说明，详细步骤在下方正文中修改。"
        title="执行计划"
      />
      <TextArea
        autoSize={{ minRows: 1 }}
        className={styles.title}
        placeholder="计划目标"
        style={{ padding: 0, resize: 'none' }}
        value={goal}
        variant="borderless"
        onChange={(e) => setGoal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            focusDescription();
          }
        }}
      />
      <TextArea
        autoSize={{ minRows: 1 }}
        className={styles.description}
        data-plan-description
        placeholder="计划说明"
        style={{ padding: 0, resize: 'none' }}
        value={description}
        variant="borderless"
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            editor?.focus();
          }
        }}
      />
      <InterventionPanel padded={false}>
        <div style={{ minHeight: 200, padding: '10px 12px' }}>
          <Editor
            content={typeof args.context === 'string' ? args.context : ''}
            editor={editor}
            lineEmptyPlaceholder="计划详情"
            placeholder="计划详情"
            plugins={PLAN_PLUGINS}
            style={{ minHeight: 200 }}
            type="text"
          />
        </div>
      </InterventionPanel>
    </Flexbox>
  );
});
