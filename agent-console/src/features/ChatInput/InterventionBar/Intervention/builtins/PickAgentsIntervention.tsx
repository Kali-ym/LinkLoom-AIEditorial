import { Avatar, Flexbox } from '@lobehub/ui';
import { cx } from 'antd-style';
import { type KeyboardEvent, memo, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import type { BuiltinInterventionProps } from '../types';
import { InteractionActionDock } from '../../InteractionActionDock';
import { interventionStyles } from '../../interventionStyles';
import { pickAgentsStyles as styles } from './pickAgentsStyles';

type AgentCategory = 'all' | 'coding' | 'productivity' | 'research';

interface AgentTemplate {
  avatar: string;
  category: Exclude<AgentCategory, 'all'>;
  description: string;
  id: string;
  title: string;
}

const MOCK_TEMPLATES: AgentTemplate[] = [
  {
    avatar: '📋',
    category: 'productivity',
    description: '任务规划、拆解与跟进，适合复杂项目推进',
    id: 'tpl-planner',
    title: '规划助理',
  },
  {
    avatar: '✍️',
    category: 'productivity',
    description: '会议纪要、周报与文档润色',
    id: 'tpl-writer',
    title: '写作助理',
  },
  {
    avatar: '💻',
    category: 'coding',
    description: '代码审查、重构建议与单元测试生成',
    id: 'tpl-coder',
    title: '编码助理',
  },
  {
    avatar: '🧪',
    category: 'coding',
    description: 'CI 排错、测试策略与发布检查清单',
    id: 'tpl-qa',
    title: '质量助理',
  },
  {
    avatar: '🔍',
    category: 'research',
    description: '信息检索、竞品分析与摘要整理',
    id: 'tpl-research',
    title: '研究助理',
  },
  {
    avatar: '📊',
    category: 'research',
    description: '数据解读、图表说明与洞察提炼',
    id: 'tpl-analyst',
    title: '分析助理',
  },
];

const CATEGORY_LABELS: Record<AgentCategory, string> = {
  all: '全部',
  coding: '编程',
  productivity: '效率',
  research: '研究',
};

/** §C.36*/
export const PickAgentsIntervention = memo(function PickAgentsIntervention({
  args,
  interactionMode,
  actionsPortalTarget,
  onInteractionAction,
}: BuiltinInterventionProps) {
  const isCustom = interactionMode === 'custom';
  const prompt = typeof args.prompt === 'string' ? args.prompt : '选择要安装的助理模板';
  const description = typeof args.description === 'string' ? args.description : undefined;
  const categoryHints = Array.isArray(args.categoryHints)
    ? (args.categoryHints as string[])
    : undefined;

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<AgentCategory>('all');

  const availableCategories = useMemo(() => {
    const hinted = new Set<AgentCategory>(['all']);
    const pool =
      categoryHints && categoryHints.length > 0
        ? MOCK_TEMPLATES.filter((tpl) => categoryHints.includes(tpl.category))
        : MOCK_TEMPLATES;
    for (const tpl of pool) hinted.add(tpl.category);
    return (['all', 'productivity', 'coding', 'research'] as const).filter((cat) => hinted.has(cat));
  }, [categoryHints]);

  const filteredTemplates = useMemo(() => {
    const pool =
      categoryHints && categoryHints.length > 0
        ? MOCK_TEMPLATES.filter((tpl) => categoryHints.includes(tpl.category))
        : MOCK_TEMPLATES;
    if (activeCategory === 'all') return pool;
    return pool.filter((tpl) => tpl.category === activeCategory);
  }, [activeCategory, categoryHints]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!onInteractionAction || selected.size === 0) return;
    setSubmitting(true);
    try {
      await onInteractionAction({
        payload: {
          categoryHints,
          requestId: args.requestId,
          selectedTemplateIds: [...selected],
        },
        type: 'submit',
      });
    } finally {
      setSubmitting(false);
    }
  }, [args.categoryHints, args.requestId, categoryHints, onInteractionAction, selected]);

  const handleSkip = useCallback(async () => {
    if (!onInteractionAction) return;
    await onInteractionAction({
      payload: { categoryHints, requestId: args.requestId },
      type: 'skip',
    });
  }, [args.requestId, categoryHints, onInteractionAction]);

  const handleCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, id: string) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle(id);
      }
    },
    [toggle],
  );

  if (!isCustom) {
    return (
      <Flexbox gap={8}>
        <p className={interventionStyles.leadTitle}>{prompt}</p>
        {description ? <p className={interventionStyles.leadDesc}>{description}</p> : null}
        <div className={interventionStyles.metaRow}>
          <span className={interventionStyles.metaChip}>{filteredTemplates.length} 个可选模板</span>
        </div>
      </Flexbox>
    );
  }

  const showEmpty = filteredTemplates.length === 0;

  const actions = (
    <InteractionActionDock
      primaryDisabled={selected.size === 0}
      primaryLabel={`确认 (${selected.size})`}
      primaryLoading={submitting}
      secondaryLabel="跳过"
      onPrimary={() => void handleSubmit()}
      onSecondary={() => void handleSkip()}
    />
  );

  return (
    <Flexbox className={styles.root} gap={12}>
      <div className={styles.header}>
        <p className={interventionStyles.leadTitle}>{prompt}</p>
        {description ? <p className={interventionStyles.leadDesc}>{description}</p> : null}
      </div>

      <div className={styles.container}>
        <div aria-orientation="horizontal" className={styles.tabBar} role="tablist">
          {availableCategories.map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                aria-selected={isActive}
                className={cx(styles.categoryItem, isActive && styles.categoryItemActive)}
                key={category}
                role="tab"
                type="button"
                onClick={() => setActiveCategory(category)}
              >
                {CATEGORY_LABELS[category]}
              </button>
            );
          })}
        </div>

        <div className={styles.content}>
          {showEmpty ? (
            <div className={styles.empty}>暂无可用模板</div>
          ) : (
            <div className={styles.grid}>
              {filteredTemplates.map((tpl) => {
                const isSelected = selected.has(tpl.id);
                return (
                  <div
                    aria-pressed={isSelected}
                    className={cx(styles.card, isSelected && styles.cardSelected)}
                    key={tpl.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggle(tpl.id)}
                    onKeyDown={(event) => handleCardKeyDown(event, tpl.id)}
                  >
                    <div className={styles.cardHeader}>
                      <Avatar avatar={tpl.avatar} shape="square" size={36} />
                      <div className={styles.cardTitle}>{tpl.title}</div>
                    </div>
                    {tpl.description ? (
                      <div className={styles.cardDescription}>{tpl.description}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {actionsPortalTarget ? createPortal(actions, actionsPortalTarget) : actions}
    </Flexbox>
  );
});
