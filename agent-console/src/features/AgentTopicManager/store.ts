import { create } from 'zustand';

import type { GroupBy, SortBy, StatusFilter, TimeRangeFilter, ViewMode } from './types';

interface TopicsViewState {
  groupBy: GroupBy;
  groupIds: string[];
  search: string;
  selectedIds: string[];
  selectMode: boolean;
  sortBy: SortBy;
  status: StatusFilter;
  timeRange: TimeRangeFilter;
  viewMode: ViewMode;
}

interface TopicsViewActions {
  clearSelected: () => void;
  exitSelectMode: () => void;
  reset: () => void;
  selectAll: (ids: string[]) => void;
  setGroupBy: (groupBy: GroupBy) => void;
  setGroupIds: (groupIds: string[]) => void;
  setSearch: (search: string) => void;
  setSortBy: (sortBy: SortBy) => void;
  setStatus: (status: StatusFilter) => void;
  setTimeRange: (range: TimeRangeFilter) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleSelected: (id: string) => void;
  toggleSelectMode: () => void;
}

const initialState: TopicsViewState = {
  groupBy: 'byTime',
  groupIds: [],
  search: '',
  selectMode: false,
  selectedIds: [],
  sortBy: 'updatedAt',
  status: 'all',
  timeRange: 'all',
  viewMode: 'card',
};

/** §C.53*/
export const useTopicsViewStore = create<TopicsViewState & TopicsViewActions>((set) => ({
  ...initialState,
  clearSelected: () => set({ selectedIds: [] }),
  exitSelectMode: () => set({ selectMode: false, selectedIds: [] }),
  reset: () => set(initialState),
  selectAll: (ids) => set({ selectedIds: ids }),
  setGroupBy: (groupBy) => set({ groupBy }),
  setGroupIds: (groupIds) => set({ groupIds }),
  setSearch: (search) => set({ search }),
  setSortBy: (sortBy) => set({ sortBy }),
  setStatus: (status) => set({ status }),
  setTimeRange: (timeRange) => set({ timeRange }),
  setViewMode: (viewMode) => set({ viewMode }),
  toggleSelectMode: () =>
    set((s) => ({ selectMode: !s.selectMode, selectedIds: s.selectMode ? [] : s.selectedIds })),
  toggleSelected: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),
}));
