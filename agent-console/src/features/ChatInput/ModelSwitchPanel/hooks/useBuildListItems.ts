import { useMemo } from 'react';

import type { EnabledProviderWithModels } from '../../../../domain/types/aiModel';
import type { GroupMode, ListItem, ModelWithProviders } from '../types';

export function useBuildListItems(
  enabledList: EnabledProviderWithModels[],
  groupMode: GroupMode,
  searchKeyword = '',
): ListItem[] {
  return useMemo(() => {
    if (enabledList.length === 0) {
      return [{ type: 'no-provider' }];
    }

    const matchesSearch = (text: string): boolean => {
      if (!searchKeyword.trim()) return true;
      return text.toLowerCase().includes(searchKeyword.toLowerCase().trim());
    };

    const sortedProviders = [...enabledList].sort((a, b) => {
      if (a.id === 'linkloom' && b.id !== 'linkloom') return -1;
      if (a.id !== 'linkloom' && b.id === 'linkloom') return 1;
      return 0;
    });

    if (groupMode === 'byModel') {
      const modelMap = new Map<string, ModelWithProviders>();

      for (const providerItem of sortedProviders) {
        for (const modelItem of providerItem.children) {
          const displayName = modelItem.displayName || modelItem.id;
          if (!matchesSearch(displayName) && !matchesSearch(providerItem.name)) continue;

          if (!modelMap.has(displayName)) {
            modelMap.set(displayName, {
              displayName,
              model: modelItem,
              providers: [],
            });
          }

          modelMap.get(displayName)!.providers.push({
            id: providerItem.id,
            logo: providerItem.logo,
            name: providerItem.name,
            source: providerItem.source,
          });
        }
      }

      return Array.from(modelMap.values()).map((data) => ({
        data,
        type: data.providers.length === 1 ? ('model-item-single' as const) : ('model-item-multiple' as const),
      }));
    }

    const items: ListItem[] = [];
    for (const providerItem of sortedProviders) {
      const filteredModels = providerItem.children.filter(
        (modelItem: EnabledProviderWithModels['children'][number]) =>
          matchesSearch(modelItem.displayName || modelItem.id) || matchesSearch(providerItem.name),
      );

      if (filteredModels.length > 0 || !searchKeyword.trim()) {
        items.push({ provider: providerItem, type: 'group-header' });
        if (filteredModels.length === 0) {
          items.push({ provider: providerItem, type: 'empty-model' });
        } else {
          for (const modelItem of filteredModels) {
            items.push({ model: modelItem, provider: providerItem, type: 'provider-model-item' });
          }
        }
      }
    }

    return items;
  }, [enabledList, groupMode, searchKeyword]);
}
