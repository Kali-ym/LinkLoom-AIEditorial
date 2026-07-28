import { Icon } from '@lobehub/ui';
import type { DropdownItem } from '@lobehub/ui';
import { SkillsIcon } from '@lobehub/ui/icons';
import {
  Search,
  Wrench,
  Globe,
  Database,
  Sparkles,
  Rocket,
  Terminal,
  Brain,
  Settings,
  Clock,
  Newspaper,
  ListTodo,
  Plug,
  Filter,
  GitBranch,
  Activity,
  History,
  Bot,
  BookOpen,
  SlidersHorizontal,
} from 'lucide-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { useAgentStore, useWorkspaceStore } from '../../../../stores';
import {
  agentToolNeedsCategoryPicker,
  setCategoryBindingIds,
} from '../../../../utils/agentConsoleToolBindings';
import { plusStrings } from '../../plusStrings';
import { getSkillPolicyFlags, SkillPolicyMenu } from './SkillPolicyMenu';
import { isAdminToolCategory } from '../../../../domain/constants/adminExclusiveTools';
import {
  buildAgentBindingRows,
  countEnabledBindings,
  groupAgentBindingRows,
  type AgentBindingRow,
  type ToolGroup,
} from './agentBindingCatalog';
import { TOOL_CATEGORY_MENU_STYLES } from '../../../../domain/types/skill';
import { plusMenuStyles } from './plusMenuStyles';

/** Maps ToolCategory.id → Lucide icon node. */
const CATEGORY_ICON_MAP: Record<string, ReactNode> = {
  'task-collab': <ListTodo size={13} />,
  'web-crawl': <Globe size={13} />,
  'data-query': <Database size={13} />,
  'content-processing': <Sparkles size={13} />,
  publishing: <Rocket size={13} />,
  workspace: <Terminal size={13} />,
  'knowledge-memory': <Brain size={13} />,
  'admin-query': <Settings size={13} />,
  'admin-schedule': <Clock size={13} />,
  'admin-selection': <Filter size={13} />,
  'admin-news-report': <Newspaper size={13} />,
  'admin-workflow': <GitBranch size={13} />,
  'admin-ops': <Activity size={13} />,
  'admin-history': <History size={13} />,
  'admin-agents': <Bot size={13} />,
  'admin-knowledge': <BookOpen size={13} />,
  'admin-settings': <SlidersHorizontal size={13} />,
};

function bindingIcon(kind: AgentBindingRow['kind']) {
  if (kind === 'tool') return Wrench;
  if (kind === 'mcp') return Plug;
  return SkillsIcon;
}

function bindingItem(
  row: AgentBindingRow,
  plugins: Record<string, boolean>,
  onToggle: (row: AgentBindingRow, checked: boolean) => void,
  catalog: ReturnType<typeof useWorkspaceStore.getState>['skillCatalog'],
  prefix: string,
): DropdownItem {
  const IconComponent = bindingIcon(row.kind);
  const { canConfigure, canUninstall } =
    row.kind === 'skill'
      ? getSkillPolicyFlags(row.id, catalog)
      : { canConfigure: false, canUninstall: false };
  const forcedEnabled = row.forcedEnabled === true;
  const checked = forcedEnabled ? true : (plugins[row.id] ?? false);
  const skillExtra =
    row.kind === 'skill' ? (
      <SkillPolicyMenu
        canConfigure={canConfigure}
        canUninstall={canUninstall}
        displayName={row.name}
        id={row.id}
        isPinned={row.pinned}
      />
    ) : undefined;
  const builtinExtra = forcedEnabled ? (
    <span className={plusMenuStyles.adminBuiltinBadge}>{plusStrings.adminBuiltinBadge}</span>
  ) : undefined;

  return {
    checked,
    extra: skillExtra ?? builtinExtra,
    icon: IconComponent,
    key: `${prefix}-${row.id}`,
    label: row.name,
    onCheckedChange: (nextChecked) => {
      if (forcedEnabled) return;
      onToggle(row, nextChecked);
    },
    type: 'switch',
  };
}

function groupHeader(label: string, icon: ReactNode, extra?: ReactNode): DropdownItem {
  return {
    key: `group-${label}`,
    label: (
      <div className={plusMenuStyles.groupHeader}>
        <span className={plusMenuStyles.labelWithChip}>
          {icon}
          {label}
        </span>
        {extra}
      </div>
    ),
    type: 'group',
  };
}

function categoryGroupHeader(
  group: ToolGroup,
  count: number,
): DropdownItem {
  const s = TOOL_CATEGORY_MENU_STYLES[group.color] ?? TOOL_CATEGORY_MENU_STYLES.slate;
  const lucideIcon = CATEGORY_ICON_MAP[group.id] ?? <Wrench size={13} />;
  return {
    key: `cat-group-${group.label}`,
    label: (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          paddingBlock: 2,
        }}
      >
        {/* Colored icon chip — Lucide icon in a tinted circle */}
        <span
          className={s.icon}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 6,
            flexShrink: 0,
          }}
        >
          {lucideIcon}
        </span>
        {/* Category label */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--color-text)',
            lineHeight: 1.4,
            flexShrink: 0,
          }}
        >
          {group.label}
        </span>
        {isAdminToolCategory(group.id) ? (
          <span className={plusMenuStyles.adminBuiltinBadge}>{plusStrings.adminCategoryBadge}</span>
        ) : null}
        {/* Count */}
        <span className={plusMenuStyles.countChip} style={{ marginInlineStart: 'auto' }}>
          {count}
        </span>
      </div>
    ),
    type: 'group',
  };
}

export interface AgentBindingPickerState {
  toolId: string;
  mode: 'enable';
}

export function useAgentBindingControls({
  onRequestCategoryPicker,
}: {
  onRequestCategoryPicker: (state: AgentBindingPickerState) => void;
}): {
  confirmCategoryEnable: (toolId: string, categoryIds: string[]) => Promise<void>;
  enabledCount: number;
  marketHeader: React.ReactNode;
  marketItems: DropdownItem[];
} {
  const [search, setSearch] = useState('');
  const skillCatalog = useWorkspaceStore((s) => s.skillCatalog);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const plusState = useAgentStore((s) => s.getActivePlusState());
  const skillActivateMode = plusState.chatConfig.skillActivateMode;
  const togglePlugin = useAgentStore((s) => s.togglePlugin);
  const commitAgentBindings = useAgentStore((s) => s.commitAgentBindings);
  const setSkillActivateMode = useAgentStore((s) => s.setSkillActivateMode);

  const confirmCategoryEnable = useCallback(
    async (toolId: string, categoryIds: string[]) => {
      await commitAgentBindings((prev) => {
        let next = setCategoryBindingIds(prev, toolId, categoryIds);
        next = { ...next, plugins: { ...next.plugins, [toolId]: true } };
        return next;
      });
    },
    [commitAgentBindings],
  );

  const handleToggle = useCallback(
    (row: AgentBindingRow, checked: boolean) => {
      if (row.forcedEnabled) return;
      if (row.kind === 'tool' && agentToolNeedsCategoryPicker(row.id)) {
        if (checked) {
          onRequestCategoryPicker({ toolId: row.id, mode: 'enable' });
          return;
        }
      }
      togglePlugin(row.id, checked);
    },
    [onRequestCategoryPicker, togglePlugin],
  );

  const { marketItems, enabledCount, marketHeader } = useMemo(() => {
    const rows = buildAgentBindingRows(skillCatalog, plusState.pinnedPlugins, activeAgentId);
    const query = search.trim().toLowerCase();
    const filtered = query
      ? rows.filter(
          (row) =>
            row.name.toLowerCase().includes(query) || row.id.toLowerCase().includes(query),
        )
      : rows;
    const { tools, skills, mcp } = groupAgentBindingRows(filtered);

    const skillModeChip = (
      <button
        type="button"
        aria-label={skillActivateMode === 'auto' ? '切换为手动' : '切换为自动'}
        className={plusMenuStyles.countChip}
        onClick={(e) => {
          e.stopPropagation();
          setSkillActivateMode(skillActivateMode === 'auto' ? 'manual' : 'auto');
        }}
      >
        {skillActivateMode === 'auto' ? plusStrings.skillAuto : plusStrings.skillManual}
      </button>
    );

    const items: DropdownItem[] = [];

    if (tools.length > 0) {
      items.push(
        groupHeader(plusStrings.bindingTools, <Icon icon={Wrench} size={14} />),
      );
      for (const group of tools) {
        items.push(categoryGroupHeader(group, group.items.length));
        for (const row of group.items) {
          items.push(
            bindingItem(row, plusState.plugins, handleToggle, skillCatalog, 'tool'),
          );
        }
      }
    }

    if (skills.length > 0) {
      items.push(
        groupHeader(
          plusStrings.bindingSkills,
          <Icon icon={SkillsIcon} size={14} />,
          skillModeChip,
        ),
        ...skills.map((row) =>
          bindingItem(row, plusState.plugins, handleToggle, skillCatalog, 'skill'),
        ),
      );
    }

    if (mcp.length > 0) {
      items.push(
        groupHeader(plusStrings.bindingMcp, <Icon icon={Plug} size={14} />),
        ...mcp.map((row) =>
          bindingItem(row, plusState.plugins, handleToggle, skillCatalog, 'mcp'),
        ),
      );
    }

    if (items.length === 0) {
      items.push({
        key: 'bindings-empty',
        label: plusStrings.bindingEmpty,
        disabled: true,
      });
    }

    const header = (
      <div className={plusMenuStyles.skillSearch}>
        <Icon icon={Search} size={14} />
        <input
          placeholder={plusStrings.bindingSearch}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>
    );

    return {
      enabledCount: countEnabledBindings(rows, plusState.plugins),
      marketHeader: header,
      marketItems: items,
    };
  }, [
    activeAgentId,
    handleToggle,
    plusState.plugins,
    plusState.pinnedPlugins,
    search,
    setSkillActivateMode,
    skillActivateMode,
    skillCatalog,
  ]);

  return {
    confirmCategoryEnable,
    enabledCount,
    marketHeader,
    marketItems,
  };
}
