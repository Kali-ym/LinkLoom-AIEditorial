import type { ISlashMenuOption, ISlashOption } from '@lobehub/editor';
import { LOBE_THEME_APP_ID as THEME_PORTAL_ROOT_ID } from '@lobehub/ui';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type FC, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import CategoryView from './CategoryView';
import HomeView from './HomeView';
import SearchView from './SearchView';
import { styles } from './style';
import {
  CATEGORY_KEY_PREFIX,
  getCategoryIdFromKey,
  isCategoryEntry,
  type MentionCategory,
  type MentionCategoryId,
  type MentionMenuState,
} from './types';
import { useKeyboardNav } from './useKeyboardNav';
import { useMenuPosition } from './useMenuPosition';

const RECENT_COUNT = 8;

interface MenuRenderProps {
  activeKey: string | null;
  loading?: boolean;
  onSelect?: (option: ISlashMenuOption) => void;
  open?: boolean;
  options: Array<ISlashOption>;
  setActiveKey: (key: string | null) => void;
}

const getRecentItems = (options: ISlashMenuOption[], count: number): ISlashMenuOption[] =>
  [...options]
    .sort((a, b) => {
      const ta = (a.metadata as { timestamp?: number } | undefined)?.timestamp ?? 0;
      const tb = (b.metadata as { timestamp?: number } | undefined)?.timestamp ?? 0;
      return tb - ta;
    })
    .slice(0, count);

const buildCategoryEntries = (categories: MentionCategory[]): ISlashMenuOption[] =>
  categories
    .filter((c) => c.items.length > 0)
    .map((cat) => ({
      icon: cat.icon,
      key: `${CATEGORY_KEY_PREFIX}${cat.id}`,
      label: cat.label,
      metadata: { categoryId: cat.id, count: cat.items.length, type: '__category__' },
    }));

export const createMentionMenu = (
  stateRef: RefObject<MentionMenuState>,
  categoriesRef: RefObject<MentionCategory[]>,
): FC<MenuRenderProps> => {
  const MentionMenu: FC<MenuRenderProps> = memo(
    ({ activeKey, onSelect, open, options, setActiveKey }) => {
      const menuRef = useRef<HTMLDivElement>(null);
      const [viewMode, setViewMode] = useState<'home' | 'category'>('home');
      const [selectedCategoryId, setSelectedCategoryId] = useState<MentionCategoryId | null>(null);

      const isSearch = stateRef.current.isSearch;
      const categories = categoriesRef.current;

      const position = useMenuPosition(menuRef, !!open);

      useEffect(() => {
        if (open) {
          setViewMode('home');
          setSelectedCategoryId(null);
        }
      }, [open]);

      const menuOptions = useMemo(
        () => options.filter((o): o is ISlashMenuOption => 'key' in o && !!o.key),
        [options],
      );

      const categoryEntries = useMemo(() => buildCategoryEntries(categories), [categories]);

      const visibleItems = useMemo((): ISlashMenuOption[] => {
        if (isSearch) return menuOptions;

        if (viewMode === 'category' && selectedCategoryId) {
          const cat = categories.find((c) => c.id === selectedCategoryId);
          return cat?.items ?? [];
        }

        const recent = getRecentItems(menuOptions, RECENT_COUNT);
        return [...recent, ...categoryEntries];
      }, [menuOptions, isSearch, viewMode, selectedCategoryId, categories, categoryEntries]);

      useEffect(() => {
        if (open && visibleItems.length > 0) {
          const nextKey = String(visibleItems[0]!.key);
          if (activeKey !== nextKey) {
            setActiveKey(nextKey);
          }
        }
      }, [activeKey, open, viewMode, selectedCategoryId, isSearch, visibleItems, setActiveKey]);

      const handleSelectCategory = useCallback((id: MentionCategoryId) => {
        setViewMode('category');
        setSelectedCategoryId(id);
      }, []);

      const handleBack = useCallback(() => {
        setViewMode('home');
        setSelectedCategoryId(null);
      }, []);

      const handleSelectItem = useCallback(
        (item: ISlashMenuOption) => {
          const key = String(item.key);
          if (isCategoryEntry(key)) {
            handleSelectCategory(getCategoryIdFromKey(key));
            return;
          }
          onSelect?.(item);
        },
        [onSelect, handleSelectCategory],
      );

      const effectiveMode = isSearch ? 'search' : viewMode;

      useKeyboardNav({
        activeKey,
        mode: effectiveMode === 'search' ? 'search' : viewMode,
        onBack: handleBack,
        onSelect: handleSelectItem,
        open: !!open,
        setActiveKey,
        visibleItems,
      });

      const themePortalRoot = useMemo(
        () => document.getElementById(THEME_PORTAL_ROOT_ID) ?? document.body,
        [],
      );
      if (!open) return null;

      const selectedCategory = selectedCategoryId
        ? categories.find((c) => c.id === selectedCategoryId)
        : null;

      const recentCount =
        effectiveMode === 'home' ? visibleItems.length - categoryEntries.length : 0;

      const menu = (
        <div
          aria-activedescendant={activeKey ? `mention-item-${activeKey}` : undefined}
          className={styles.container}
          ref={menuRef}
          role="listbox"
          style={{
            left: position.x,
            opacity: position.visible ? 1 : 0,
            pointerEvents: position.visible ? 'auto' : 'none',
            top: position.y,
            visibility: position.visible ? 'visible' : 'hidden',
          }}
        >
          {effectiveMode === 'home' ? (
            <HomeView
              activeKey={activeKey}
              dividerIndex={recentCount}
              visibleItems={visibleItems}
              onSelectItem={handleSelectItem}
            />
          ) : null}
          {effectiveMode === 'category' && selectedCategory ? (
            <CategoryView
              activeKey={activeKey}
              category={selectedCategory}
              onBack={handleBack}
              onSelectItem={handleSelectItem}
            />
          ) : null}
          {effectiveMode === 'search' ? (
            <SearchView
              activeKey={activeKey}
              options={visibleItems}
              onSelectItem={handleSelectItem}
            />
          ) : null}
        </div>
      );

      return createPortal(menu, themePortalRoot);
    },
  );

  MentionMenu.displayName = 'MentionMenu';
  return MentionMenu;
};
