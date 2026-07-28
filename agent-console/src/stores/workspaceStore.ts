import { create } from 'zustand';

import type { AgentConsoleSnapshot } from '../adapters/types';
import type {
  DocumentNode,
  FileTreeNode,
  InputMenuData,
  PortalContentData,
  ReviewFile,
  ShowcaseData,
  SkillCatalog,
  StaticConversation,
  TodoItem,
  WebPage,
  WorkspacePlan,
} from '../domain/types';
import { DEFAULT_TOPIC_ID } from './types';

type WorkspaceHydrate = Pick<
  AgentConsoleSnapshot,
  | 'activeAgentId'
  | 'todos'
  | 'documents'
  | 'webPages'
  | 'fileTree'
  | 'reviewFiles'
  | 'workingDir'
  | 'skillCatalog'
  | 'staticConversation'
  | 'portalContent'
  | 'inputMenu'
  | 'showcase'
>;

interface WorkspaceState {
  todosByTopicId: Record<string, TodoItem[]>;
  planByTopicId: Record<string, WorkspacePlan | undefined>;
  documentsByAgentId: Record<string, DocumentNode[]>;
  webPagesByTopicId: Record<string, WebPage[]>;
  fileTreeByTopicId: Record<string, FileTreeNode[]>;
  reviewFilesByTopicId: Record<string, ReviewFile[]>;
  workingDir: string;
  filesValidating: boolean;
  documentsValidating: boolean;
  skillCatalog: SkillCatalog;
  staticConversation: StaticConversation;
  portalContent: PortalContentData;
  inputMenu: InputMenuData;
  showcase: ShowcaseData;

  hydrate: (snapshot: WorkspaceHydrate, topicId?: string) => void;
  getTodos: (topicId: string) => TodoItem[];
  getPlan: (topicId: string) => WorkspacePlan | undefined;
  getDocuments: (agentId: string) => DocumentNode[];
  getWebPages: (topicId: string) => WebPage[];
  getFileTree: (topicId: string) => FileTreeNode[];
  getReviewFiles: (topicId: string) => ReviewFile[];
  setTodos: (topicId: string, todos: TodoItem[]) => void;
  setPlan: (topicId: string, plan: WorkspacePlan | undefined) => void;
  mergeWebPages: (topicId: string, pages: WebPage[]) => void;
  setInputMenu: (inputMenu: InputMenuData) => void;
  removeSkillFromCatalog: (skillId: string) => void;
  removeAgentSkill: (skillId: string) => void;
  removeUserSkill: (skillId: string) => void;
  renameAgentSkill: (skillId: string, name: string) => void;
  renameUserSkill: (skillId: string, name: string) => void;
  removeWebPage: (topicId: string, pageId: string) => void;
  refreshWorkspaceDocuments: (agentId: string) => Promise<void>;
  refreshFileTree: (topicId: string) => Promise<void>;
}

const emptySkillCatalog: SkillCatalog = {
  commands: [],
  agentSkills: [],
  projectSkills: [],
  userSkills: [],
  tools: [],
  agents: [],
};

const emptyPortalContent: PortalContentData = {
  homeFiles: [],
  homeArtifact: { id: '', title: '', meta: '' },
  homeTool: {},
  notebookDocs: [],
  groupThreads: [],
  threadBubbles: [],
  localFileTabs: [],
  artifactPreview: { title: '', description: '' },
  artifactCode: '',
  documentDefault: { title: '', paragraphs: [] },
  filePreviewDefault: '',
  filePreviewByPath: {},
};

const emptyInputMenu: InputMenuData = {
  mentionTopics: [],
  mentionFiles: [],
  mentionRecent: [],
};

const emptyShowcase: ShowcaseData = {
  reasoning: { title: '', demoFullText: '', blocks: [] },
  tools: {
    title: '',
    accordions: [],
    workflowCompleted: { tools: [], opts: {} },
    workflowStreaming: { tools: [], opts: {} },
  },
  grounding: { title: '', web: { citations: [] }, images: { citations: [] } },
  portal: { title: '', entries: [], verifyResult: {} },
  skills: { title: '', hint: '', tagDemos: [] },
  msgTypes: { title: '' },
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  todosByTopicId: {},
  planByTopicId: {},
  documentsByAgentId: {},
  webPagesByTopicId: {},
  fileTreeByTopicId: {},
  reviewFilesByTopicId: {},
  workingDir: '',
  filesValidating: false,
  documentsValidating: false,
  skillCatalog: emptySkillCatalog,
  staticConversation: {} as StaticConversation,
  portalContent: emptyPortalContent,
  inputMenu: emptyInputMenu,
  showcase: emptyShowcase,

  hydrate: (snapshot, topicId = DEFAULT_TOPIC_ID) =>
    set({
      todosByTopicId: { [topicId]: snapshot.todos },
      planByTopicId: {},
      documentsByAgentId: { [snapshot.activeAgentId]: snapshot.documents },
      webPagesByTopicId: { [topicId]: snapshot.webPages },
      fileTreeByTopicId: { [topicId]: snapshot.fileTree },
      reviewFilesByTopicId: { [topicId]: snapshot.reviewFiles },
      workingDir: snapshot.workingDir,
      skillCatalog: snapshot.skillCatalog,
      staticConversation: snapshot.staticConversation,
      portalContent: snapshot.portalContent,
      inputMenu: snapshot.inputMenu,
      showcase: snapshot.showcase,
    }),

  getTodos: (topicId) => get().todosByTopicId[topicId] ?? [],
  getPlan: (topicId) => get().planByTopicId[topicId],
  getDocuments: (agentId) => get().documentsByAgentId[agentId] ?? [],
  getWebPages: (topicId) => get().webPagesByTopicId[topicId] ?? [],
  getFileTree: (topicId) => get().fileTreeByTopicId[topicId] ?? [],
  getReviewFiles: (topicId) => get().reviewFilesByTopicId[topicId] ?? [],

  setTodos: (topicId, todos) =>
    set((s) => ({
      todosByTopicId: { ...s.todosByTopicId, [topicId]: todos },
    })),

  setPlan: (topicId, plan) =>
    set((s) => ({
      planByTopicId: { ...s.planByTopicId, [topicId]: plan },
    })),

  mergeWebPages: (topicId, pages) =>
    set((s) => {
      const existing = s.webPagesByTopicId[topicId] ?? [];
      const byUrl = new Map(existing.map((page) => [page.url, page]));
      for (const page of pages) {
        byUrl.set(page.url, page);
      }
      return {
        webPagesByTopicId: {
          ...s.webPagesByTopicId,
          [topicId]: [...byUrl.values()],
        },
      };
    }),

  setInputMenu: (inputMenu) => set({ inputMenu }),

  removeSkillFromCatalog: (skillId) =>
    set((s) => ({
      skillCatalog: {
        ...s.skillCatalog,
        agentSkills: s.skillCatalog.agentSkills.filter((item) => item.id !== skillId),
        projectSkills: s.skillCatalog.projectSkills.filter((item) => item.id !== skillId),
        tools: s.skillCatalog.tools.filter((item) => item.id !== skillId),
        userSkills: s.skillCatalog.userSkills.filter((item) => item.id !== skillId),
      },
    })),

  removeAgentSkill: (skillId) =>
    set((s) => ({
      skillCatalog: {
        ...s.skillCatalog,
        agentSkills: s.skillCatalog.agentSkills.filter((item) => item.id !== skillId),
      },
    })),

  removeUserSkill: (skillId) =>
    set((s) => ({
      skillCatalog: {
        ...s.skillCatalog,
        userSkills: s.skillCatalog.userSkills.filter((item) => item.id !== skillId),
      },
    })),

  renameAgentSkill: (skillId, name) =>
    set((s) => ({
      skillCatalog: {
        ...s.skillCatalog,
        agentSkills: s.skillCatalog.agentSkills.map((item) =>
          item.id === skillId ? { ...item, name } : item,
        ),
      },
    })),

  renameUserSkill: (skillId, name) =>
    set((s) => ({
      skillCatalog: {
        ...s.skillCatalog,
        userSkills: s.skillCatalog.userSkills.map((item) =>
          item.id === skillId ? { ...item, name } : item,
        ),
      },
    })),

  removeWebPage: (topicId, pageId) =>
    set((s) => ({
      webPagesByTopicId: {
        ...s.webPagesByTopicId,
        [topicId]: (s.webPagesByTopicId[topicId] ?? []).filter((page) => page.id !== pageId),
      },
    })),

  refreshWorkspaceDocuments: async (agentId) => {
    if (!agentId) return;
    if (agentId in get().documentsByAgentId) return;

    set({ documentsValidating: true });
    try {
      const { getAgentConsolePorts } = await import('../adapters/registry');
      const documents = await getAgentConsolePorts().workspace.getWorkspaceDocumentTree(agentId);
      set((s) => ({
        documentsByAgentId: { ...s.documentsByAgentId, [agentId]: documents },
      }));
    } catch (error) {
      const { isWorkspaceNotProvisionedError } = await import('../utils/workspaceProvision');
      if (isWorkspaceNotProvisionedError(error)) {
        set((s) => ({
          documentsByAgentId: { ...s.documentsByAgentId, [agentId]: [] },
        }));
        const { useWorkspaceControlsStore } = await import('./workspaceControlsStore');
        const sandboxKnown =
          useWorkspaceControlsStore.getState().sandboxStatusByAgentId[agentId] !== undefined;
        if (!sandboxKnown) {
          void useWorkspaceControlsStore.getState().fetchSandboxStatus(agentId);
        }
      }
    } finally {
      set({ documentsValidating: false });
    }
  },

  refreshFileTree: async (_topicId) => {
    set({ filesValidating: true });
    await new Promise((resolve) => setTimeout(resolve, 600));
    set((s) => ({
      filesValidating: false,
      fileTreeByTopicId: { ...s.fileTreeByTopicId },
    }));
  },
}));

export type { TodoItem, DocumentNode, WebPage, FileTreeNode, ReviewFile };
