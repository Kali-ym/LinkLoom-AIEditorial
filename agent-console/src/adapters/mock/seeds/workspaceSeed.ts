import {
  PORTAL_ARTIFACT_CODE,
  PORTAL_ARTIFACT_PREVIEW,
  PORTAL_DOCUMENT_DEFAULT,
  PORTAL_FILE_PREVIEW_DEFAULT,
  PORTAL_GROUP_THREADS,
  PORTAL_HOME_ARTIFACT,
  PORTAL_HOME_FILES,
  PORTAL_HOME_TOOL,
  PORTAL_LOCAL_FILE_TABS,
  PORTAL_NOTEBOOK_DOCS,
  PORTAL_THREAD_BUBBLES,
} from '../../../fixtures/portalMockData';
import {
  MOCK_FILE_TREE,
  MOCK_REVIEW_FILES,
  WORKING_DIR,
} from '../../../fixtures/mockFiles';
import { MOCK_DOCUMENTS, MOCK_TODOS, MOCK_WEB_PAGES } from '../../../mock/data';
import { SKILL_CATALOG } from '../../../fixtures/mockCatalogs';
import type { PortalContentData } from '../../../domain/types';

const FILE_PREVIEW_BY_PATH: Record<string, string> = {
  'studio/src/App.tsx': PORTAL_FILE_PREVIEW_DEFAULT,
  'linkloom/studio/src/App.tsx': PORTAL_FILE_PREVIEW_DEFAULT,
  'linkloom/studio/src/features/WorkingSidebar/index.tsx': `// studio/src/features/WorkingSidebar/index.tsx
import { DraggablePanel } from '@lobehub/ui';

export default function WorkingSidebar() {
  return <DraggablePanel>...</DraggablePanel>;
}`,
  'docs/studio-full-mock-design.md': `# Studio Full Mock Design

Agent 控制台三栏布局与 Portal view stack 设计说明。`,
  'demo/preview.html': `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="utf-8"><title>Portal HTML Preview</title></head>
<body><h1>HTML 预览演示</h1><p>§C.21 FilePreview · HtmlPreview</p></body>
</html>`,
};

export function getMockSkillCatalog() {
  return SKILL_CATALOG;
}

export function getMockDocuments() {
  return MOCK_DOCUMENTS;
}

export function getMockWebPages() {
  return MOCK_WEB_PAGES;
}

export function getMockFileTree() {
  return MOCK_FILE_TREE;
}

export function getMockReviewFiles() {
  return MOCK_REVIEW_FILES;
}

export function getMockWorkingDirectory() {
  return WORKING_DIR;
}

export function getMockTodos() {
  return MOCK_TODOS;
}

export function getMockPortalContent(): PortalContentData {
  return {
    homeFiles: PORTAL_HOME_FILES,
    homeArtifact: PORTAL_HOME_ARTIFACT,
    homeTool: PORTAL_HOME_TOOL,
    notebookDocs: PORTAL_NOTEBOOK_DOCS,
    groupThreads: PORTAL_GROUP_THREADS,
    threadBubbles: PORTAL_THREAD_BUBBLES,
    localFileTabs: PORTAL_LOCAL_FILE_TABS,
    artifactPreview: PORTAL_ARTIFACT_PREVIEW,
    artifactCode: PORTAL_ARTIFACT_CODE,
    documentDefault: PORTAL_DOCUMENT_DEFAULT,
    filePreviewDefault: PORTAL_FILE_PREVIEW_DEFAULT,
    filePreviewByPath: FILE_PREVIEW_BY_PATH,
  };
}
