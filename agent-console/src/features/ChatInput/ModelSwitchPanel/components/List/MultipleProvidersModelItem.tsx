import {
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuItemIcon,
  DropdownMenuItemLabel,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuSubmenuRoot,
  DropdownMenuSubmenuTrigger,
  menuSharedStyles,
} from '@lobehub/ui';
import { cx } from 'antd-style';
import { Check } from 'lucide-react';
import { memo, useState } from 'react';

import { modelStrings } from '../../modelStrings';
import { styles } from '../../styles';
import type { ModelWithProviders } from '../../types';
import { menuKey } from '../../utils';
import { ModelDetailPanel } from '../ModelDetailPanel';
import { ModelItemRender } from '../ModelItemRender';
import { ProviderItemRender } from '../ProviderItemRender';

interface MultipleProvidersModelItemProps {
  activeKey: string;
  data: ModelWithProviders;
  onClose: () => void;
  onModelChange: (modelId: string, providerId: string) => void;
}

export const MultipleProvidersModelItem = memo(function MultipleProvidersModelItem({
  activeKey,
  data,
  onClose,
  onModelChange,
}: MultipleProvidersModelItemProps) {
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const activeProvider = data.providers.find((p) => menuKey(p.id, data.model.id) === activeKey);
  const isActive = !!activeProvider;
  const defaultProvider = data.providers[0];

  return (
    <DropdownMenuSubmenuRoot open={submenuOpen} onOpenChange={setSubmenuOpen}>
      <DropdownMenuSubmenuTrigger
        className={cx(menuSharedStyles.item, isActive && styles.menuItemActive)}
        style={{ paddingBlock: 8, paddingInline: 8 }}
        onClick={() => {
          if (!defaultProvider) {
            onClose();
            return;
          }
          setSubmenuOpen(false);
          onModelChange(data.model.id, defaultProvider.id);
          onClose();
        }}
      >
        <ModelItemRender
          {...data.model}
          {...data.model.abilities}
          displayName={data.displayName}
          id={data.model.id}
        />
      </DropdownMenuSubmenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPositioner anchor={null} placement="right" sideOffset={12}>
          <DropdownMenuPopup className={cx(styles.detailPopup, styles.dropdownMenu)}>
            <ModelDetailPanel
              model={data.model.id}
              provider={(activeProvider ?? defaultProvider).id}
            />
            <DropdownMenuGroup>
              <DropdownMenuGroupLabel>{modelStrings.useModelFrom}</DropdownMenuGroupLabel>
              {data.providers.map((p) => {
                const key = menuKey(p.id, data.model.id);
                const isProviderActive = isActive ? activeKey === key : p.id === data.providers[0]?.id;
                return (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => {
                      setSubmenuOpen(false);
                      onClose();
                      onModelChange(data.model.id, p.id);
                    }}
                  >
                    <DropdownMenuItemIcon>
                      {isProviderActive ? <Check size={16} /> : null}
                    </DropdownMenuItemIcon>
                    <DropdownMenuItemLabel>
                      <ProviderItemRender logo={p.logo} name={p.name} provider={p.id} size={20} />
                    </DropdownMenuItemLabel>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </DropdownMenuPopup>
        </DropdownMenuPositioner>
      </DropdownMenuPortal>
    </DropdownMenuSubmenuRoot>
  );
});
