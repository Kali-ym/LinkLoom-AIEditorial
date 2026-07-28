import { Flexbox } from '@lobehub/ui';
import { type FC, useCallback, useLayoutEffect, useMemo, useRef } from 'react';

import { useEnabledChatModels } from '../../../../../hooks/useEnabledChatModels';
import type { EnabledProviderWithModels } from '../../../../../domain/types/aiModel';
import { FOOTER_HEIGHT, MAX_PANEL_HEIGHT, TOOLBAR_HEIGHT } from '../../const';
import { useBuildListItems } from '../../hooks/useBuildListItems';
import { usePanelHandlers } from '../../hooks/usePanelHandlers';
import { styles } from '../../styles';
import type { GroupMode } from '../../types';
import { menuKey } from '../../utils';
import { ListItemRenderer } from './ListItemRenderer';

interface ListProps {
  enabledList?: EnabledProviderWithModels[];
  groupMode: GroupMode;
  model?: string;
  onModelChange?: (params: { model: string; provider: string }) => void | Promise<void>;
  onOpenChange?: (open: boolean) => void;
  provider?: string;
  searchKeyword?: string;
}

export const List: FC<ListProps> = ({
  enabledList: enabledListProp,
  groupMode,
  model: modelProp,
  onModelChange,
  onOpenChange,
  provider: providerProp,
  searchKeyword = '',
}) => {
  const chatEnabledList = useEnabledChatModels();
  const enabledList = enabledListProp ?? chatEnabledList;
  const model = modelProp ?? '';
  const provider = providerProp ?? '';
  const { handleClose, handleModelChange } = usePanelHandlers({ onModelChange, onOpenChange });
  const listItems = useBuildListItems(enabledList, groupMode, searchKeyword);

  const panelHeight = useMemo(
    () => (enabledList.length === 0 ? TOOLBAR_HEIGHT + 32 + FOOTER_HEIGHT : MAX_PANEL_HEIGHT),
    [enabledList.length],
  );

  const activeKey = menuKey(provider, model);
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeNodeRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedPositionRef = useRef(false);

  const activeItemRef = useCallback((node: HTMLDivElement | null) => {
    activeNodeRef.current = node;
  }, []);

  const listHeight = panelHeight - TOOLBAR_HEIGHT - FOOTER_HEIGHT;

  const scrollListenersRef = useRef(new Set<() => void>());
  const subscribeScroll = useCallback((cb: () => void) => {
    scrollListenersRef.current.add(cb);
    return () => scrollListenersRef.current.delete(cb);
  }, []);
  const handleListScroll = useCallback(() => {
    scrollListenersRef.current.forEach((cb) => cb());
  }, []);

  useLayoutEffect(() => {
    if (hasInitializedPositionRef.current) return;
    const container = listRef.current;
    const activeNode = activeNodeRef.current;
    if (!container || !activeNode) return;
    const targetScrollTop =
      activeNode.offsetTop - (container.clientHeight - activeNode.offsetHeight) / 2;
    container.scrollTop = Math.max(0, targetScrollTop);
    hasInitializedPositionRef.current = true;
  }, [listHeight, activeKey]);

  return (
    <Flexbox
      className={styles.list}
      flex={1}
      ref={listRef}
      style={{ height: listHeight }}
      onScroll={handleListScroll}
    >
      {listItems.map((item, index) => {
        const itemKey = menuKey(
          'provider' in item && item.provider ? item.provider.id : '',
          'model' in item && item.model
            ? item.model.id
            : 'data' in item && item.data
              ? item.data.model.id
              : `${item.type}-${index}`,
        );

        const isActive =
          (item.type === 'provider-model-item' &&
            menuKey(item.provider.id, item.model.id) === activeKey) ||
          (item.type === 'model-item-single' &&
            menuKey(item.data.providers[0].id, item.data.model.id) === activeKey) ||
          (item.type === 'model-item-multiple' &&
            item.data.providers.some((p) => menuKey(p.id, item.data.model.id) === activeKey));

        const rendered = (
          <ListItemRenderer
            activeKey={activeKey}
            item={item}
            subscribeScroll={subscribeScroll}
            onClose={handleClose}
            onModelChange={handleModelChange}
          />
        );

        return isActive ? (
          <div key={itemKey} ref={activeItemRef}>
            {rendered}
          </div>
        ) : (
          <div key={itemKey}>{rendered}</div>
        );
      })}
    </Flexbox>
  );
};
