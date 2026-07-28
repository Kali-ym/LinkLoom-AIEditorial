import { Flexbox } from '@lobehub/ui';
import { type FC, useState } from 'react';

import { useConfigStore } from '../../../../stores/configStore';
import { useEnabledChatModels } from '../../../../hooks/useEnabledChatModels';
import type { EnabledProviderWithModels } from '../../../../domain/types/aiModel';
import { DEFAULT_WIDTH } from '../const';
import { usePanelSize } from '../hooks/usePanelSize';
import { usePanelState } from '../hooks/usePanelState';
import { DevResizablePanel } from './DevResizablePanel';
import { List } from './List';
import { Toolbar } from './Toolbar';

interface PanelContentProps {
  enabledList?: EnabledProviderWithModels[];
  model?: string;
  onModelChange?: (params: { model: string; provider: string }) => void | Promise<void>;
  onOpenChange?: (open: boolean) => void;
  provider?: string;
}

export const PanelContent: FC<PanelContentProps> = ({
  enabledList: enabledListProp,
  model,
  onModelChange,
  onOpenChange,
  provider,
}) => {
  const chatEnabledList = useEnabledChatModels();
  const enabledList = enabledListProp ?? chatEnabledList;
  const [searchKeyword, setSearchKeyword] = useState('');
  const isDevMode = useConfigStore((s) => s.isDevMode);
  const { groupMode, handleGroupModeChange } = usePanelState();
  const { handlePanelWidthChange, panelHeight, panelWidth } = usePanelSize(enabledList.length);

  const panelBody = (
    <Flexbox
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: panelHeight,
        position: 'relative',
        width: isDevMode ? '100%' : DEFAULT_WIDTH,
      }}
    >
      <Toolbar
        groupMode={groupMode}
        searchKeyword={searchKeyword}
        showGroupModeSwitch={isDevMode}
        onGroupModeChange={handleGroupModeChange}
        onSearchKeywordChange={setSearchKeyword}
      />
      <List
        enabledList={enabledList}
        groupMode={isDevMode ? groupMode : 'byModel'}
        model={model}
        provider={provider}
        searchKeyword={searchKeyword}
        onModelChange={onModelChange}
        onOpenChange={onOpenChange}
      />
    </Flexbox>
  );

  if (isDevMode) {
    return (
      <DevResizablePanel
        height={panelHeight}
        width={panelWidth}
        onWidthChange={handlePanelWidthChange}
      >
        {panelBody}
      </DevResizablePanel>
    );
  }

  return panelBody;
};
