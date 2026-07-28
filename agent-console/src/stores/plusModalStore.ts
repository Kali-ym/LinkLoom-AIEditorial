import { create } from 'zustand';

interface PlusModalState {
  attachKnowledgeOpen: boolean;
  skillStoreOpen: boolean;
  setAttachKnowledgeOpen: (open: boolean) => void;
  setSkillStoreOpen: (open: boolean) => void;
}

export const usePlusModalStore = create<PlusModalState>((set) => ({
  attachKnowledgeOpen: false,
  skillStoreOpen: false,
  setAttachKnowledgeOpen: (open) => set({ attachKnowledgeOpen: open }),
  setSkillStoreOpen: (open) => set({ skillStoreOpen: open }),
}));
