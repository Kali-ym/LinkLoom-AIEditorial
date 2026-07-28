import {
  Accordion,
  Center,
  Empty,
  Flexbox,
  Input,
  Markdown,
  Modal,
  Text,
} from '@lobehub/ui';
import { confirmModal } from '@lobehub/ui/base-ui';
import { SkillsIcon } from '@lobehub/ui/icons';
import { cx } from 'antd-style';
import { EyeIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { memo, useCallback, useMemo, useState, type CSSProperties, type DragEvent } from 'react';

import { filterBindingsByPlugins } from '../../../domain/utils/agentPluginBindings';
import { showToast } from '../../../services/ui/toast';
import { useAgentStore, useWorkspaceStore, useWorkingSidebarStore } from '../../../stores';
import type { ResourceFilter } from '../../../stores/types';
import { openPortalView } from '../../Portal';
import { DocumentsPanel } from '../Documents/DocumentsPanel';
import { SKILL_DRAG_MIME } from '../../shared/skillDrag';
import { SkillSection, SkillsList, type SkillListItem, type SkillRowAction } from '../SkillsList';
import { WebPanel } from '../WebPanel';
import { resourceStyles as styles } from './resourceStyles';

const FILTER_OPTIONS: { key: ResourceFilter; label: string }[] = [
  { key: 'skills', label: '技能' },
  { key: 'documents', label: '文档' },
  { key: 'web', label: '网页' },
];

interface AgentDocumentsGroupProps {
  showProjectSkills: boolean;
  style?: CSSProperties;
  workingDirectory?: string;
}

/** §C.27*/
export const AgentDocumentsGroup = memo(function AgentDocumentsGroup({
  showProjectSkills,
  style,
  workingDirectory,
}: AgentDocumentsGroupProps) {
  const filter = useWorkingSidebarStore((s) => s.resourceFilter);
  const setFilter = useWorkingSidebarStore((s) => s.setResourceFilter);
  const skillCatalog = useWorkspaceStore((s) => s.skillCatalog);
  const plusPlugins = useAgentStore((s) => s.getActivePlusState().plugins);
  const removeAgentSkill = useWorkspaceStore((s) => s.removeAgentSkill);
  const removeUserSkill = useWorkspaceStore((s) => s.removeUserSkill);
  const renameAgentSkill = useWorkspaceStore((s) => s.renameAgentSkill);
  const renameUserSkill = useWorkspaceStore((s) => s.renameUserSkill);

  const [detailSkill, setDetailSkill] = useState<SkillListItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<{
    id: string;
    name: string;
    source: 'agent' | 'user';
  } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const agentItems = useMemo<SkillListItem[]>(
    () =>
      filterBindingsByPlugins(skillCatalog.agentSkills, plusPlugins).map((skill) => ({
        description: skill.description,
        fileCount: skill.fileCount ?? skill.files?.length,
        files: skill.files,
        id: skill.id,
        name: skill.name,
      })),
    [skillCatalog.agentSkills, plusPlugins],
  );

  const projectItems = useMemo<SkillListItem[]>(
    () =>
      filterBindingsByPlugins(skillCatalog.projectSkills, plusPlugins).map((skill) => ({
        description: skill.description,
        id: skill.id,
        name: skill.name,
      })),
    [skillCatalog.projectSkills, plusPlugins],
  );

  const userItems = useMemo<SkillListItem[]>(
    () =>
      filterBindingsByPlugins(skillCatalog.userSkills, plusPlugins).map((skill) => ({
        description: skill.description,
        id: skill.id,
        name: skill.name,
      })),
    [skillCatalog.userSkills, plusPlugins],
  );

  const openAgentSkill = useCallback(
    (item: SkillListItem) => {
      const skill = skillCatalog.agentSkills.find((s) => s.id === item.id);
      const path = skill?.files?.includes('SKILL.md') ? 'SKILL.md' : skill?.files?.[0];
      openPortalView('Document', { path: path ?? item.id, title: item.name });
    },
    [skillCatalog.agentSkills],
  );

  const openAgentFile = useCallback((_item: SkillListItem, relativePath: string) => {
    openPortalView('Document', {
      path: relativePath,
      title: relativePath.split('/').pop() ?? relativePath,
    });
  }, []);

  const getAgentSkillActions = useCallback(
    (_item: SkillListItem): SkillRowAction[] => [
      {
        icon: EyeIcon,
        key: 'view',
        label: '查看',
        onClick: openAgentSkill,
      },
      {
        icon: PencilIcon,
        key: 'rename',
        label: '重命名',
        onClick: (row) => {
          setRenameTarget({ id: row.id, name: row.name, source: 'agent' });
          setRenameValue(row.name);
        },
      },
      {
        danger: true,
        icon: Trash2Icon,
        key: 'delete',
        label: '删除',
        onClick: (row) => {
          confirmModal({
            cancelText: '取消',
            content: `确定从 Agent 文档中移除「${row.name}」？`,
            okButtonProps: { danger: true },
            okText: '删除',
            onOk: () => {
              removeAgentSkill(row.id);
              showToast(`已删除：${row.name}`);
            },
            title: '删除技能',
          });
        },
      },
    ],
    [openAgentSkill, removeAgentSkill],
  );

  const getProjectSkillActions = useCallback((): SkillRowAction[] => {
    return [
      {
        disabled: true,
        icon: EyeIcon,
        key: 'view',
        label: '查看',
        onClick: () => {},
        tooltip: '即将推出',
      },
      {
        disabled: true,
        icon: PencilIcon,
        key: 'rename',
        label: '重命名',
        onClick: () => {},
        tooltip: '即将推出',
      },
      {
        disabled: true,
        icon: Trash2Icon,
        key: 'delete',
        label: '删除',
        onClick: () => {},
        tooltip: '即将推出',
      },
    ];
  }, []);

  const getUserSkillActions = useCallback(
    (item: SkillListItem): SkillRowAction[] => {
      const userSkill = skillCatalog.userSkills.find((s) => s.id === item.id);
      const canRename = userSkill?.source === 'user';
      return [
        {
          icon: EyeIcon,
          key: 'view',
          label: '查看',
          onClick: setDetailSkill,
        },
        {
          disabled: !canRename,
          icon: PencilIcon,
          key: 'rename',
          label: '重命名',
          onClick: (row) => {
            if (!canRename) return;
            setRenameTarget({ id: row.id, name: row.name, source: 'user' });
            setRenameValue(row.name);
          },
          tooltip: canRename ? undefined : '市场导入技能不可重命名',
        },
        {
          danger: true,
          icon: Trash2Icon,
          key: 'delete',
          label: '删除',
          onClick: (row) => {
            confirmModal({
              cancelText: '取消',
              content: `确定删除用户技能「${row.name}」？`,
              okButtonProps: { danger: true },
              okText: '删除',
              onOk: () => {
                removeUserSkill(row.id);
                showToast(`已删除：${row.name}`);
              },
              title: '删除技能',
            });
          },
        },
      ];
    },
    [removeUserSkill, skillCatalog.userSkills],
  );

  const onAgentDragStart = useCallback((item: SkillListItem, event: DragEvent) => {
    event.dataTransfer.setData(
      SKILL_DRAG_MIME,
      JSON.stringify({ category: 'agentSkill', label: item.name, type: item.id }),
    );
    event.dataTransfer.effectAllowed = 'copy';
  }, []);

  const onProjectDragStart = useCallback((item: SkillListItem, event: DragEvent) => {
    event.dataTransfer.setData(
      SKILL_DRAG_MIME,
      JSON.stringify({ category: 'projectSkill', label: item.name, type: item.name }),
    );
    event.dataTransfer.effectAllowed = 'copy';
  }, []);

  const onUserDragStart = useCallback((item: SkillListItem, event: DragEvent) => {
    event.dataTransfer.setData(
      SKILL_DRAG_MIME,
      JSON.stringify({ category: 'skill', label: item.name, type: item.id }),
    );
    event.dataTransfer.effectAllowed = 'copy';
  }, []);

  const renderAgentSkillsList = () => (
    <SkillsList
      getRowActions={getAgentSkillActions}
      items={agentItems}
      onOpenFile={openAgentFile}
      onOpenSkill={openAgentSkill}
      onSkillDragStart={onAgentDragStart}
    />
  );

  const renderProjectSkillsList = () => (
    <SkillsList
      getRowActions={() => getProjectSkillActions()}
      items={projectItems}
      onOpenSkill={(item) => {
        if (workingDirectory) {
          openPortalView('Document', {
            path: `${workingDirectory}/.agents/skills/${item.name}/SKILL.md`,
            title: item.name,
          });
        }
      }}
      onSkillDragStart={onProjectDragStart}
    />
  );

  const renderUserSkillsList = () => (
    <SkillsList
      getRowActions={getUserSkillActions}
      items={userItems}
      onOpenSkill={setDetailSkill}
      onSkillDragStart={onUserDragStart}
    />
  );

  const renderSkills = () => {
    const hasAgent = agentItems.length > 0;
    const hasProject = showProjectSkills && projectItems.length > 0;
    const hasUser = userItems.length > 0;
    const activeCount = (hasAgent ? 1 : 0) + (hasProject ? 1 : 0) + (hasUser ? 1 : 0);

    if (activeCount === 0) {
      return (
        <Center flex={1} paddingBlock={24}>
          <Empty description="暂无可用技能" icon={SkillsIcon} />
        </Center>
      );
    }

    const flat = activeCount === 1;

    if (flat) {
      return (
        <Flexbox gap={16} style={{ paddingBottom: 16 }}>
          {hasAgent ? renderAgentSkillsList() : null}
          {hasProject ? (
            <SkillSection sectionHeader={undefined}>{renderProjectSkillsList()}</SkillSection>
          ) : null}
          {hasUser ? (
            <SkillSection sectionHeader={undefined}>{renderUserSkillsList()}</SkillSection>
          ) : null}
        </Flexbox>
      );
    }

    const defaultExpandedKeys = [
      hasAgent ? 'skill-section-Agent 技能' : null,
      hasProject ? 'skill-section-项目技能' : null,
      hasUser ? 'skill-section-用户技能' : null,
    ].filter((key): key is string => key !== null);

    return (
      <Accordion defaultExpandedKeys={defaultExpandedKeys} gap={16} style={{ paddingBottom: 16 }}>
        {hasAgent ? (
          <SkillSection
            nestedInAccordion
            sectionHeader={{ count: agentItems.length, title: 'Agent 技能' }}
          >
            {renderAgentSkillsList()}
          </SkillSection>
        ) : null}
        {hasProject ? (
          <SkillSection
            nestedInAccordion
            sectionHeader={{ count: projectItems.length, title: '项目技能' }}
          >
            {renderProjectSkillsList()}
          </SkillSection>
        ) : null}
        {hasUser ? (
          <SkillSection
            nestedInAccordion
            sectionHeader={{ count: userItems.length, title: '用户技能' }}
          >
            {renderUserSkillsList()}
          </SkillSection>
        ) : null}
      </Accordion>
    );
  };

  const confirmRename = () => {
    if (!renameTarget || !renameValue.trim()) return;
    const name = renameValue.trim();
    if (renameTarget.source === 'agent') renameAgentSkill(renameTarget.id, name);
    else renameUserSkill(renameTarget.id, name);
    showToast(`已重命名为：${name}`);
    setRenameTarget(null);
  };

  const detailMarkdown = detailSkill
    ? `# ${detailSkill.name}\n\n${detailSkill.description ?? ''}\n\n在输入框输入 \`/${detailSkill.id}\` 或从右侧拖拽到输入区。`
    : '';

  return (
    <Flexbox className={styles.section} style={style}>
      <div className={styles.pills} id="resourcePills" role="tablist">
        {FILTER_OPTIONS.map((pill) => (
          <button
            key={pill.key}
            type="button"
            className={cx(styles.pillTab, filter === pill.key && styles.pillActive)}
            data-sub={pill.key === 'documents' ? 'docs' : pill.key}
            role="tab"
            aria-selected={filter === pill.key}
            onClick={() => setFilter(pill.key)}
          >
            {pill.label}
          </button>
        ))}
      </div>

      <div className={styles.content} id="skillsPanelMount">
        {filter === 'skills' ? renderSkills() : null}
        {filter === 'documents' ? <DocumentsPanel /> : null}
        {filter === 'web' ? <WebPanel /> : null}
      </div>

      <Modal
        allowFullscreen
        footer={null}
        open={!!detailSkill}
        title="技能详情"
        width={960}
        onCancel={() => setDetailSkill(null)}
      >
        {detailSkill ? (
          <div style={{ maxHeight: 'calc(100dvh - 200px)', overflow: 'auto', padding: '8px 0' }}>
            <Markdown variant="chat">{detailMarkdown}</Markdown>
          </div>
        ) : null}
      </Modal>

      <Modal
        cancelText="取消"
        okText="保存"
        open={!!renameTarget}
        title="重命名技能"
        width={400}
        onCancel={() => setRenameTarget(null)}
        onOk={confirmRename}
      >
        <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>
          技能名称
        </Text>
        <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
      </Modal>
    </Flexbox>
  );
});
