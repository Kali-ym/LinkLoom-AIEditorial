import { create } from 'zustand';

import type { IEditor } from '@lobehub/editor';

import type { ChatAttachmentRef } from '../adapters/ports/IUploadPort';
import { revokeAttachmentPreview, revokeAttachmentPreviews } from '../utils/attachmentPreview';
import type { InputChip, MentionTab } from './types';

/** Uploaded files staged for the next user turn. */
export type ChatUploadItem = ChatAttachmentRef;

interface InputState {
  draft: string;
  chips: InputChip[];
  chatUploadFileList: ChatUploadItem[];
  slashMenuOpen: boolean;
  mentionMenuOpen: boolean;
  mentionMenuPinned: boolean;
  mentionTab: MentionTab;
  featureSlash: boolean;
  featureMention: boolean;
  slashPlacement: 'top' | 'bottom';
  ghostText: string;
  queueTrayVisible: boolean;
  typoBarVisible: boolean;
  inputExpanded: boolean;
  mainEditor: IEditor | null;
  markdownContent: string;

  setDraft: (draft: string) => void;
  addChip: (chip: InputChip) => void;
  removeChip: (id: string) => void;
  setSlashMenuOpen: (open: boolean) => void;
  setMentionMenuOpen: (open: boolean) => void;
  setMentionPinned: (pinned: boolean) => void;
  openMentionMenu: () => void;
  setMentionTab: (tab: MentionTab) => void;
  setGhostText: (text: string) => void;
  setQueueTrayVisible: (visible: boolean) => void;
  setTypoBarVisible: (visible: boolean) => void;
  setInputExpanded: (expanded: boolean) => void;
  setMainEditor: (editor: IEditor | null) => void;
  setMarkdownContent: (markdownContent: string) => void;
  addChatUploadFiles: (attachments: ChatUploadItem[]) => void;
  removeChatUploadFile: (uploadId: string) => void;
  clearChatUploadFileList: (options?: { revokePreviews?: boolean }) => void;
  clearDraft: () => void;
  clearChips: () => void;
}

export const useInputStore = create<InputState>((set) => ({
  draft: '',
  chips: [],
  chatUploadFileList: [],
  slashMenuOpen: false,
  mentionMenuOpen: false,
  mentionMenuPinned: false,
  mentionTab: 'recent',
  featureSlash: true,
  featureMention: true,
  slashPlacement: 'top',
  ghostText: '',
  queueTrayVisible: false,
  typoBarVisible: false,
  inputExpanded: false,
  mainEditor: null,
  markdownContent: '',

  setDraft: (draft) => set({ draft }),
  addChip: (chip) => set((s) => ({ chips: [...s.chips, chip] })),
  removeChip: (id) => set((s) => ({ chips: s.chips.filter((c) => c.id !== id) })),
  setSlashMenuOpen: (open) => set({ slashMenuOpen: open }),
  setMentionMenuOpen: (open) => set({ mentionMenuOpen: open }),
  setMentionPinned: (pinned) => set({ mentionMenuPinned: pinned }),
  openMentionMenu: () => set({ mentionMenuOpen: true, mentionMenuPinned: true }),
  setMentionTab: (tab) => set({ mentionTab: tab }),
  setGhostText: (text) => set({ ghostText: text }),
  setQueueTrayVisible: (visible) => set({ queueTrayVisible: visible }),
  setTypoBarVisible: (visible) => set({ typoBarVisible: visible }),
  setInputExpanded: (expanded) =>
    set((s) => (s.inputExpanded === expanded ? s : { inputExpanded: expanded })),
  setMainEditor: (mainEditor) =>
    set((s) => (s.mainEditor === mainEditor ? s : { mainEditor })),
  setMarkdownContent: (markdownContent) =>
    set((s) => (s.markdownContent === markdownContent ? s : { markdownContent })),
  addChatUploadFiles: (attachments) =>
    set((s) => ({ chatUploadFileList: [...s.chatUploadFileList, ...attachments] })),
  removeChatUploadFile: (uploadId) =>
    set((s) => {
      const target = s.chatUploadFileList.find((item) => item.uploadId === uploadId);
      if (target) revokeAttachmentPreview(target);
      return {
        chatUploadFileList: s.chatUploadFileList.filter((item) => item.uploadId !== uploadId),
      };
    }),
  clearChatUploadFileList: (options) =>
    set((s) => {
      if (options?.revokePreviews !== false) {
        revokeAttachmentPreviews(s.chatUploadFileList);
      }
      return { chatUploadFileList: [] };
    }),
  clearDraft: () =>
    set((s) => {
      revokeAttachmentPreviews(s.chatUploadFileList);
      return {
        draft: '',
        chips: [],
        ghostText: '',
        markdownContent: '',
        chatUploadFileList: [],
      };
    }),
  clearChips: () => set({ chips: [] }),
}));
