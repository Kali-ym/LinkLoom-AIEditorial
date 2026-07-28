import { create } from 'zustand';

import { CHAT_INPUT_DEFAULT_HEIGHT } from '../constants/layoutTokens';
import {
  COMPACT_VIEWPORT_MAX,
  DEFAULT_NAV_PANEL_WIDTH,
  DEFAULT_PORTAL_WIDTH,
  DEFAULT_RIGHT_WIDTH,
  MOBILE_VIEWPORT_MAX,
  NAV_PANEL_MAX_WIDTH,
  NAV_PANEL_MIN_WIDTH,
  PORTAL_MOBILE_MAX,
  PORTAL_WIDTH_MAX,
  RIGHT_WIDTH_MAX,
  RIGHT_WIDTH_MIN,
  SMALL_VIEWPORT_MAX,
} from './types';
import { resolvePortalMinWidth } from '../utils/portalLayout';
import { usePortalStore } from './portalStore';

export interface LayoutState {
  sidebarCollapsed: boolean;
  rightCollapsed: boolean;
  portalOpen: boolean;
  navPanelWidth: number;
  rightWidth: number;
  portalWidth: number;
  chatInputHeight: number;
  wideScreen: boolean;
  zenMode: boolean;
  showTaskAgentPanel: boolean;
  backdropVisible: boolean;
  isCompactViewport: boolean;
  isMobileViewport: boolean;
  mobileTopicModalOpen: boolean;
  isPortalMobile: boolean;
  isSmallViewport: boolean;
  lastViewportCompact: boolean;
  viewportSynced: boolean;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
  setPortalOpen: (open: boolean) => void;
  setRightWidth: (width: number) => void;
  setPortalWidth: (width: number) => void;
  setNavPanelWidth: (width: number) => void;
  setChatInputHeight: (height: number) => void;
  toggleWideScreen: (newValue?: boolean) => void;
  toggleZenMode: () => void;
  setZenMode: (zen: boolean) => void;
  toggleTaskAgentPanel: (open?: boolean) => void;
  clampPortalWidthForView: () => void;
  setBackdropVisible: (visible: boolean) => void;
  setMobileTopicModalOpen: (open: boolean) => void;
  toggleMobileTopicModal: () => void;
  applyCssVars: () => void;
  syncLayoutBackdrops: () => void;
  syncViewport: (width: number) => void;
}

const LAYOUT_STORAGE_KEY = 'linkloom-agent-console-layout';

interface LayoutPrefs {
  chatInputHeight?: number;
  portalWidth?: number;
  wideScreen?: boolean;
}

function loadLayoutPrefs(): LayoutPrefs {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LayoutPrefs;
  } catch {
    return {};
  }
}

function persistLayoutPrefs(patch: Partial<LayoutPrefs>): void {
  try {
    const prev = loadLayoutPrefs();
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({ ...prev, ...patch }));
  } catch {
    /* ignore quota / private mode */
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function loadChatInputHeight(): number {
  const height = loadLayoutPrefs().chatInputHeight;
  if (typeof height === 'number') {
    return Math.max(CHAT_INPUT_DEFAULT_HEIGHT, Math.round(height));
  }
  return CHAT_INPUT_DEFAULT_HEIGHT;
}

function loadPortalWidth(): number {
  const width = loadLayoutPrefs().portalWidth;
  if (typeof width === 'number') {
    return clamp(width, DEFAULT_PORTAL_WIDTH, PORTAL_WIDTH_MAX);
  }
  return DEFAULT_PORTAL_WIDTH;
}

function loadWideScreen(): boolean {
  return Boolean(loadLayoutPrefs().wideScreen);
}

function viewportLabel(width: number): string {
  if (width <= MOBILE_VIEWPORT_MAX) return 'mobile';
  if (width <= COMPACT_VIEWPORT_MAX) return 'tablet';
  if (width <= 1279) return 'laptop';
  return 'desktop';
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  sidebarCollapsed: false,
  rightCollapsed: false,
  portalOpen: false,
  navPanelWidth: DEFAULT_NAV_PANEL_WIDTH,
  rightWidth: DEFAULT_RIGHT_WIDTH,
  portalWidth: loadPortalWidth(),
  chatInputHeight: loadChatInputHeight(),
  wideScreen: loadWideScreen(),
  zenMode: false,
  showTaskAgentPanel: true,
  backdropVisible: false,
  isCompactViewport: false,
  isMobileViewport: false,
  mobileTopicModalOpen: false,
  isPortalMobile: false,
  isSmallViewport: false,
  lastViewportCompact: false,
  viewportSynced: false,

  toggleSidebar: () => {
    const s = get();
    const opening = s.sidebarCollapsed;
    const nextCollapsed = !s.sidebarCollapsed;
    const patch: Partial<LayoutState> = { sidebarCollapsed: nextCollapsed };
    if (s.isCompactViewport) {
      if (opening) {
        patch.rightCollapsed = true;
        patch.backdropVisible = true;
      } else {
        patch.backdropVisible = false;
      }
    }
    set(patch);
    get().applyCssVars();
    get().syncLayoutBackdrops();
  },

  setSidebarCollapsed: (collapsed) => {
    const s = get();
    if (s.sidebarCollapsed === collapsed) return;
    const patch: Partial<LayoutState> = { sidebarCollapsed: collapsed };
    if (s.isCompactViewport && !collapsed) {
      patch.rightCollapsed = true;
      patch.backdropVisible = true;
    } else if (s.isCompactViewport && collapsed) {
      patch.backdropVisible = false;
    }
    set(patch);
    get().applyCssVars();
    get().syncLayoutBackdrops();
  },

  toggleRightPanel: () => {
    const s = get();
    const opening = s.rightCollapsed;
    const nextCollapsed = !s.rightCollapsed;
    const patch: Partial<LayoutState> = { rightCollapsed: nextCollapsed };
    if (s.isCompactViewport) {
      if (opening) {
        patch.sidebarCollapsed = true;
        patch.backdropVisible = true;
      } else {
        patch.backdropVisible = false;
      }
    }
    set(patch);
    get().applyCssVars();
    get().syncLayoutBackdrops();
  },

  setRightPanelOpen: (open) => {
    const s = get();
    const nextCollapsed = !open;
    if (s.rightCollapsed === nextCollapsed) return;
    const patch: Partial<LayoutState> = { rightCollapsed: nextCollapsed };
    if (s.isCompactViewport) {
      if (open) {
        patch.sidebarCollapsed = true;
        patch.backdropVisible = true;
      } else {
        patch.backdropVisible = false;
      }
    }
    set(patch);
    get().applyCssVars();
    get().syncLayoutBackdrops();
  },

  setPortalOpen: (open) => {
    set({ portalOpen: open });
    get().syncLayoutBackdrops();
  },

  setRightWidth: (width) => {
    set({ rightWidth: clamp(width, RIGHT_WIDTH_MIN, RIGHT_WIDTH_MAX) });
    get().applyCssVars();
  },

  setPortalWidth: (width) => {
    const current = usePortalStore.getState().currentView();
    const min = resolvePortalMinWidth(current?.type);
    const next = clamp(width, min, PORTAL_WIDTH_MAX);
    set({ portalWidth: next });
    persistLayoutPrefs({ portalWidth: next });
    get().applyCssVars();
  },

  setNavPanelWidth: (width) => {
    set({ navPanelWidth: clamp(width, NAV_PANEL_MIN_WIDTH, NAV_PANEL_MAX_WIDTH) });
    get().applyCssVars();
  },

  setChatInputHeight: (height) => {
    const next = Math.max(CHAT_INPUT_DEFAULT_HEIGHT, Math.round(height));
    set({ chatInputHeight: next });
    persistLayoutPrefs({ chatInputHeight: next });
  },

  toggleWideScreen: (newValue?: boolean) => {
    set((s) => {
      const wideScreen = newValue ?? !s.wideScreen;
      persistLayoutPrefs({ wideScreen });
      return { wideScreen };
    });
  },

  toggleZenMode: () => {
    set((s) => ({ zenMode: !s.zenMode }));
  },

  setZenMode: (zen) => set({ zenMode: zen }),

  toggleTaskAgentPanel: (open) => {
    set((s) => ({
      showTaskAgentPanel: typeof open === 'boolean' ? open : !s.showTaskAgentPanel,
    }));
  },

  clampPortalWidthForView: () => {
    const current = usePortalStore.getState().currentView();
    const min = resolvePortalMinWidth(current?.type);
    const { portalWidth } = get();
    if (portalWidth < min) {
      const next = min;
      set({ portalWidth: next });
      persistLayoutPrefs({ portalWidth: next });
      get().applyCssVars();
    }
  },

  setBackdropVisible: (visible) => set({ backdropVisible: visible }),

  setMobileTopicModalOpen: (open) => set({ mobileTopicModalOpen: open }),

  toggleMobileTopicModal: () => set((s) => ({ mobileTopicModalOpen: !s.mobileTopicModalOpen })),

  applyCssVars: () => {
    const {
      navPanelWidth,
      rightWidth,
      portalWidth,
      sidebarCollapsed,
      rightCollapsed,
      isCompactViewport,
    } = get();
    const root = document.documentElement;

    if (!isCompactViewport) {
      root.style.setProperty('--sidebar-w', sidebarCollapsed ? '0px' : `${navPanelWidth}px`);
      root.style.setProperty('--right-w', rightCollapsed ? '0px' : `${rightWidth}px`);
    } else {
      // Overlay side panels — fixed positioning; flex row must not reserve column width.
      root.style.setProperty('--sidebar-w', '0px');
      root.style.setProperty('--right-w', '0px');
    }

    root.style.setProperty('--portal-w', `${portalWidth}px`);

    const page = document.getElementById('agentPage') ?? document.querySelector('.agent-page');
    if (page) {
      page.setAttribute('data-viewport', viewportLabel(window.innerWidth));
    }
  },

  syncLayoutBackdrops: () => {
    const s = get();
    const sidebarOpen = s.isCompactViewport && !s.sidebarCollapsed;
    const rightOpen = s.isCompactViewport && !s.rightCollapsed;
    const portalSheet = s.isPortalMobile && s.portalOpen;
    const show = s.isCompactViewport && (sidebarOpen || rightOpen) && !portalSheet;
    set({ backdropVisible: show });
  },

  syncViewport: (width) => {
    const isCompactViewport = width <= COMPACT_VIEWPORT_MAX;
    const isMobileViewport = width <= MOBILE_VIEWPORT_MAX;
    const isSmallViewport = width <= SMALL_VIEWPORT_MAX;
    const isPortalMobile = width <= PORTAL_MOBILE_MAX;
    const s = get();

    let sidebarCollapsed = s.sidebarCollapsed;
    let rightCollapsed = s.rightCollapsed;

    if (!s.viewportSynced && isCompactViewport) {
      sidebarCollapsed = true;
      rightCollapsed = true;
    } else if (s.viewportSynced && isCompactViewport && !s.lastViewportCompact) {
      sidebarCollapsed = true;
      rightCollapsed = true;
    }

    set({
      isCompactViewport,
      isMobileViewport,
      isSmallViewport,
      isPortalMobile,
      lastViewportCompact: isCompactViewport,
      viewportSynced: true,
      sidebarCollapsed,
      rightCollapsed,
    });

    get().applyCssVars();
    get().syncLayoutBackdrops();
  },
}));

export function initLayoutListeners(): () => void {
  const sync = () => useLayoutStore.getState().syncViewport(window.innerWidth);
  sync();
  window.addEventListener('resize', sync);
  return () => window.removeEventListener('resize', sync);
}
