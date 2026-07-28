import {
  ActionIcon,
  Block,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuSubmenuRoot,
  DropdownMenuSubmenuTrigger,
  Flexbox,
  Icon,
  menuSharedStyles,
} from '@lobehub/ui';
import { cssVar, cx } from 'antd-style';
import { ArrowRight, Settings } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { modelStrings } from '../../modelStrings';
import { styles } from '../../styles';
import type { ListItem } from '../../types';
import { menuKey } from '../../utils';
import { ModelDetailPanel } from '../ModelDetailPanel';
import { ModelItemRender } from '../ModelItemRender';
import { ProviderItemRender } from '../ProviderItemRender';
import { MultipleProvidersModelItem } from './MultipleProvidersModelItem';
import { SingleProviderModelItem } from './SingleProviderModelItem';

interface ListItemRendererProps {
  activeKey: string;
  item: ListItem;
  onClose: () => void;
  onModelChange: (modelId: string, providerId: string) => void;
  subscribeScroll?: (cb: () => void) => () => void;
}

export const ListItemRenderer = memo(function ListItemRenderer({
  activeKey,
  item,
  onClose,
  onModelChange,
  subscribeScroll,
}: ListItemRendererProps) {
  const navigate = useNavigate();
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => subscribeScroll?.(() => setDetailOpen(false)), [subscribeScroll]);

  switch (item.type) {
    case 'no-provider':
      return (
        <Block
          clickable
          horizontal
          className={styles.menuItem}
          gap={8}
          variant="borderless"
          style={{ color: cssVar.colorTextTertiary }}
          onClick={() => {
            onClose();
            navigate('/settings');
          }}
        >
          {modelStrings.emptyProvider}
          <Icon icon={ArrowRight} />
        </Block>
      );

    case 'group-header':
      return (
        <Flexbox
          horizontal
          className={styles.groupHeader}
          justify="space-between"
          key={`header-${item.provider.id}`}
          paddingBlock="12px 4px"
          paddingInline="12px 8px"
        >
          <ProviderItemRender
            logo={item.provider.logo}
            name={item.provider.name}
            provider={item.provider.id}
          />
          <ActionIcon
            icon={Settings}
            size="small"
            title={modelStrings.goToSettings}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
              navigate('/settings');
            }}
          />
        </Flexbox>
      );

    case 'empty-model':
      return (
        <Flexbox
          horizontal
          className={styles.menuItem}
          gap={8}
          style={{ color: cssVar.colorTextTertiary }}
          onClick={() => {
            onClose();
            navigate('/settings');
          }}
        >
          {modelStrings.emptyModel}
          <Icon icon={ArrowRight} />
        </Flexbox>
      );

    case 'provider-model-item': {
      const key = menuKey(item.provider.id, item.model.id);
      const isActive = key === activeKey;
      return (
        <Flexbox style={{ marginBlock: 1, marginInline: 4 }}>
          <DropdownMenuSubmenuRoot open={detailOpen} onOpenChange={setDetailOpen}>
            <DropdownMenuSubmenuTrigger
              className={cx(menuSharedStyles.item, isActive && styles.menuItemActive)}
              style={{ paddingBlock: 8, paddingInline: 8 }}
              onClick={(e) => {
                e.preventDefault();
                setDetailOpen(false);
                onClose();
                onModelChange(item.model.id, item.provider.id);
              }}
            >
              <ModelItemRender
                {...item.model}
                {...item.model.abilities}
                displayName={item.model.displayName}
                id={item.model.id}
              />
            </DropdownMenuSubmenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuPositioner anchor={null} placement="right" sideOffset={12}>
                <DropdownMenuPopup className={styles.detailPopup}>
                  <ModelDetailPanel model={item.model.id} provider={item.provider.id} />
                </DropdownMenuPopup>
              </DropdownMenuPositioner>
            </DropdownMenuPortal>
          </DropdownMenuSubmenuRoot>
        </Flexbox>
      );
    }

    case 'model-item-single': {
      const singleProvider = item.data.providers[0];
      const key = menuKey(singleProvider.id, item.data.model.id);
      const isActive = key === activeKey;
      return (
        <Flexbox style={{ marginBlock: 1, marginInline: 4 }}>
          <DropdownMenuSubmenuRoot open={detailOpen} onOpenChange={setDetailOpen}>
            <DropdownMenuSubmenuTrigger
              className={cx(menuSharedStyles.item, isActive && styles.menuItemActive)}
              style={{ paddingBlock: 8, paddingInline: 8 }}
              onClick={(e) => {
                e.preventDefault();
                setDetailOpen(false);
                onClose();
                onModelChange(item.data.model.id, singleProvider.id);
              }}
            >
              <SingleProviderModelItem data={item.data} />
            </DropdownMenuSubmenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuPositioner anchor={null} placement="right" sideOffset={16}>
                <DropdownMenuPopup className={styles.detailPopup}>
                  <ModelDetailPanel model={item.data.model.id} provider={singleProvider.id} />
                </DropdownMenuPopup>
              </DropdownMenuPositioner>
            </DropdownMenuPortal>
          </DropdownMenuSubmenuRoot>
        </Flexbox>
      );
    }

    case 'model-item-multiple':
      return (
        <MultipleProvidersModelItem
          activeKey={activeKey}
          data={item.data}
          onClose={onClose}
          onModelChange={onModelChange}
        />
      );

    default:
      return null;
  }
});
