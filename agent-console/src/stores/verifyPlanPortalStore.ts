import { create } from 'zustand';

import type { VerifyCriterionView, VerifyPlanPortalState } from '../domain/types/toolPortal';

const EMPTY_VERIFY_PLAN: VerifyPlanPortalState = {
  items: [],
  rubricName: '',
  maxRepairRounds: 3,
};

interface VerifyPlanPortalStateStore extends VerifyPlanPortalState {
  hydrateFromPayload: (state?: VerifyPlanPortalState) => void;
  updateCriterion: (index: number, patch: Partial<VerifyCriterionView>) => void;
  updateRubricConfig: (patch: { rubricName?: string; maxRepairRounds?: number }) => void;
}

export const useVerifyPlanPortalStore = create<VerifyPlanPortalStateStore>((set, get) => ({
  ...EMPTY_VERIFY_PLAN,

  hydrateFromPayload: (state) => {
    if (state?.items?.length) {
      set({ ...EMPTY_VERIFY_PLAN, ...state });
      return;
    }
    set({ ...EMPTY_VERIFY_PLAN });
  },

  updateCriterion: (index, patch) => {
    const items = [...(get().items ?? [])];
    if (!items[index]) return;
    items[index] = { ...items[index], ...patch };
    set({ items });
  },

  updateRubricConfig: (patch) => set(patch),
}));
