import { Icon } from '@lobehub/ui';
import type { DropdownItem } from '@lobehub/ui';
import { SkillsIcon } from '@lobehub/ui/icons';
import { cssVar, cx } from 'antd-style';
import {
  Brain,
  CheckIcon,
  Cloud,
  CloudCog,
  FileUp,
  Globe,
  LibraryBig,
  SearchCheck,
  Settings2Icon,
  TypeIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useAgentModelMeta } from '../../../../hooks/useAgentModelMeta';
import {
  useAgentStore,
  useConfigStore,
  useInputStore,
  useLayoutStore,
  useWorkingSidebarStore,
} from '../../../../stores';
import { plusStrings } from '../../plusStrings';
import { plusMenuStyles } from './plusMenuStyles';
import { AgentBindingCategoryPicker } from './AgentBindingCategoryPicker';
import { useAgentBindingControls, type AgentBindingPickerState } from './useAgentBindingControls';
import { useKnowledgeControls } from './useKnowledgeControls';

function renderLabelWithCount(label: string, count: number, prefix?: string) {
  if (count <= 0 && !prefix) return label;
  return (
    <span className={plusMenuStyles.labelWithChip}>
      <span>{label}</span>
      <span className={plusMenuStyles.countChip}>
        {prefix ? `${prefix} | ${count}` : count}
      </span>
    </span>
  );
}

function renderActive(label: string, active: boolean) {
  if (!active) return label;
  return (
    <div className={cx(plusMenuStyles.activeLabel)}>
      <span>{label}</span>
      <Icon icon={CheckIcon} size={14} />
    </div>
  );
}

function renderSearchOption(
  icon: ReactNode,
  title: string,
  description: string,
  active: boolean,
) {
  return (
    <div className={cx(plusMenuStyles.searchOptionRow)}>
      <div className={plusMenuStyles.searchIconBox}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="title">{title}</div>
        {description ? <div className="desc">{description}</div> : null}
      </div>
      {active ? <Icon icon={CheckIcon} size={14} /> : null}
    </div>
  );
}

export function usePlusMenuItems({
  closeDropdown,
  onUploadClick,
}: {
  closeDropdown: () => void;
  onUploadClick: () => void;
}): { items: DropdownItem[]; categoryPicker: ReactNode } {
  const [pickerRequest, setPickerRequest] = useState<AgentBindingPickerState | null>(null);
  const enableKnowledgeBase = useConfigStore((s) => s.enableKnowledgeBase);
  const enableGatewayMode = useConfigStore((s) => s.enableGatewayMode);
  const enableFC = useConfigStore((s) => s.enableFC);
  const { showProviderSearch } = useAgentModelMeta();

  const chatConfig = useAgentStore((s) => s.getChatConfig());
  const isAgentModeEnabled = useAgentStore((s) => s.isAgentModeEnabled());
  const updateAgentChatConfig = useAgentStore((s) => s.updateAgentChatConfig);

  const typoBarVisible = useInputStore((s) => s.typoBarVisible);
  const setTypoBarVisible = useInputStore((s) => s.setTypoBarVisible);

  const workingTab = useWorkingSidebarStore((s) => s.tab);
  const openWorkingSidebar = useWorkingSidebarStore((s) => s.openWorkingSidebar);
  const rightCollapsed = useLayoutStore((s) => s.rightCollapsed);
  const setRightPanelOpen = useLayoutStore((s) => s.setRightPanelOpen);

  const isParamsPanelActive = !rightCollapsed && workingTab === 'params';
  const isMemoryEnabled = chatConfig.memory.enabled;
  const isGatewayModeEnabled = chatConfig.disableGatewayMode !== true;

  const activeSearchOption: 'off' | 'app' | 'provider' =
    chatConfig.searchMode === 'off'
      ? 'off'
      : chatConfig.useModelBuiltinSearch
        ? 'provider'
        : 'app';

  const handleViewMoreKb = useCallback(() => closeDropdown(), [closeDropdown]);

  const {
    enabledCount: knowledgeEnabledCount,
    footer: knowledgeFooter,
    items: knowledgeItems,
  } = useKnowledgeControls({ onViewMore: handleViewMoreKb });

  const {
    confirmCategoryEnable,
    enabledCount: bindingEnabledCount,
    marketHeader: bindingHeader,
    marketItems: bindingItems,
  } = useAgentBindingControls({
    onRequestCategoryPicker: setPickerRequest,
  });

  const handleSelectSearch = useCallback(
    (option: 'off' | 'app' | 'provider') => {
      if (option === 'off') {
        updateAgentChatConfig({ searchMode: 'off', useModelBuiltinSearch: false });
      } else if (option === 'app') {
        updateAgentChatConfig({ searchMode: 'auto', useModelBuiltinSearch: false });
      } else {
        updateAgentChatConfig({ searchMode: 'auto', useModelBuiltinSearch: true });
      }
    },
    [updateAgentChatConfig],
  );

  const handleToggleParams = useCallback(() => {
    closeDropdown();
    if (isParamsPanelActive) {
      setRightPanelOpen(false);
      return;
    }
    openWorkingSidebar({ tab: 'params' });
    setRightPanelOpen(true);
  }, [closeDropdown, isParamsPanelActive, openWorkingSidebar, setRightPanelOpen]);

  const menuItems = useMemo(() => {
    const uploadItems: DropdownItem[] = [
      {
        icon: <Icon icon={FileUp} size={20} />,
        key: 'upload-file-or-image',
        label: (
          <span className={plusMenuStyles.uploadLabel} onClick={onUploadClick}>
            {plusStrings.upload}
          </span>
        ),
        onClick: onUploadClick,
      },
    ];

    const toolsItems: DropdownItem[] =
      isAgentModeEnabled && enableFC
        ? [
            {
              children: bindingItems,
              header: bindingHeader,
              icon: SkillsIcon,
              key: 'tools',
              label: renderLabelWithCount(plusStrings.tools, bindingEnabledCount),
            },
            { type: 'divider' },
          ]
        : [];

    const capabilityItems: DropdownItem[] = [
      {
        checked: Boolean(isMemoryEnabled),
        icon: Brain,
        key: 'memory',
        label: plusStrings.memory,
        onCheckedChange: (checked) => updateAgentChatConfig({ memory: { enabled: checked } }),
        type: 'switch',
      },
      ...(showProviderSearch
        ? [
            {
              children: [
                {
                  key: 'search-off',
                  label: renderSearchOption(
                    <Icon icon={Globe} size={18} />,
                    plusStrings.searchOff,
                    plusStrings.searchOffDesc,
                    activeSearchOption === 'off',
                  ),
                  onClick: () => handleSelectSearch('off'),
                },
                {
                  key: 'search-app',
                  label: renderSearchOption(
                    <Icon
                      color={activeSearchOption === 'app' ? cssVar.colorInfo : undefined}
                      icon={SearchCheck}
                      size={18}
                    />,
                    plusStrings.searchApp,
                    plusStrings.searchAppDesc,
                    activeSearchOption === 'app',
                  ),
                  onClick: () => handleSelectSearch('app'),
                },
                {
                  key: 'search-provider',
                  label: renderSearchOption(
                    <Icon
                      color={activeSearchOption === 'provider' ? cssVar.colorInfo : undefined}
                      icon={CloudCog}
                      size={18}
                    />,
                    plusStrings.searchProvider,
                    plusStrings.searchProviderDesc,
                    activeSearchOption === 'provider',
                  ),
                  onClick: () => handleSelectSearch('provider'),
                },
              ],
              icon:
                activeSearchOption === 'off' ? (
                  <Icon icon={Globe} size={16} />
                ) : (
                  <Icon color={cssVar.colorInfo} icon={Globe} size={16} />
                ),
              key: 'search-group',
              label: plusStrings.search,
            } as DropdownItem,
          ]
        : [
            {
              checked: activeSearchOption !== 'off',
              icon: Globe,
              key: 'search-toggle',
              label: plusStrings.search,
              onCheckedChange: (checked) => handleSelectSearch(checked ? 'app' : 'off'),
              type: 'switch',
            } as DropdownItem,
          ]),
      ...(enableGatewayMode
        ? [
            {
              checked: isGatewayModeEnabled,
              icon: isGatewayModeEnabled ? (
                <Icon color={cssVar.colorInfo} icon={Cloud} size={16} />
              ) : (
                Cloud
              ),
              key: 'gateway-mode',
              label: plusStrings.gateway,
              onCheckedChange: (checked) =>
                updateAgentChatConfig({ disableGatewayMode: checked ? false : true }),
              type: 'switch',
            } as DropdownItem,
          ]
        : []),
      { type: 'divider' },
      ...toolsItems,
      {
        checked: Boolean(typoBarVisible),
        icon: TypeIcon,
        key: 'typo',
        label: plusStrings.typo,
        onCheckedChange: (checked) => setTypoBarVisible(checked),
        type: 'switch',
      },
      {
        icon: Settings2Icon,
        key: 'params',
        label: renderActive(plusStrings.params, isParamsPanelActive),
        onClick: handleToggleParams,
      },
    ];

    const attachmentsItems: DropdownItem[] = enableKnowledgeBase
      ? [
          {
            children: [
              ...uploadItems,
              ...(knowledgeItems.length > 0
                ? [{ type: 'divider' as const }, ...knowledgeItems]
                : []),
            ],
            footer: knowledgeFooter,
            icon: LibraryBig,
            key: 'attachments',
            label: renderLabelWithCount(plusStrings.addAttachments, knowledgeEnabledCount),
          },
        ]
      : uploadItems;

    return [...attachmentsItems, ...capabilityItems];
  }, [
    activeSearchOption,
    bindingEnabledCount,
    bindingHeader,
    bindingItems,
    enableFC,
    enableGatewayMode,
    enableKnowledgeBase,
    handleSelectSearch,
    handleToggleParams,
    isAgentModeEnabled,
    isGatewayModeEnabled,
    isMemoryEnabled,
    isParamsPanelActive,
    knowledgeEnabledCount,
    knowledgeFooter,
    knowledgeItems,
    onUploadClick,
    setTypoBarVisible,
    showProviderSearch,
    typoBarVisible,
    updateAgentChatConfig,
  ]);

  const categoryPicker = (
    <AgentBindingCategoryPicker
      request={pickerRequest}
      onClose={() => setPickerRequest(null)}
      onConfirm={(toolId, categoryIds) => {
        void confirmCategoryEnable(toolId, categoryIds);
      }}
    />
  );

  return { categoryPicker, items: menuItems };
}
