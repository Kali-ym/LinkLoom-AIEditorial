import { Flexbox, Icon, SearchBar, Segmented, stopPropagation } from '@lobehub/ui';
import { ProviderIcon } from '@lobehub/ui/icons';
import { Brain } from 'lucide-react';
import { memo } from 'react';

import { modelStrings } from '../modelStrings';
import { styles } from '../styles';
import type { GroupMode } from '../types';

interface ToolbarProps {
  groupMode?: GroupMode;
  onGroupModeChange?: (mode: GroupMode) => void;
  onSearchKeywordChange: (keyword: string) => void;
  searchKeyword: string;
  showGroupModeSwitch?: boolean;
}

export const Toolbar = memo(function Toolbar({
  groupMode,
  onGroupModeChange,
  searchKeyword,
  onSearchKeywordChange,
  showGroupModeSwitch,
}: ToolbarProps) {
  return (
    <Flexbox
      horizontal
      align="center"
      className={styles.toolbar}
      gap={4}
      paddingBlock={8}
      paddingInline={8}
      style={{ height: 40 }}
    >
      <SearchBar
        allowClear
        placeholder={modelStrings.searchPlaceholder}
        size="small"
        style={{ flex: 1 }}
        value={searchKeyword}
        variant="borderless"
        onChange={(e) => onSearchKeywordChange(e.target.value)}
        onKeyDown={stopPropagation}
      />
      {showGroupModeSwitch ? (
        <Segmented
          options={[
            { icon: <Icon icon={Brain} />, title: modelStrings.byModel, value: 'byModel' },
            {
              icon: <Icon icon={ProviderIcon} />,
              title: modelStrings.byProvider,
              value: 'byProvider',
            },
          ]}
          size="small"
          value={groupMode}
          onChange={(value) => onGroupModeChange?.(value as GroupMode)}
        />
      ) : null}
    </Flexbox>
  );
});
