/** Extracted from index.html WorkingSidebar FILE_TREE + REVIEW_FILES. */

import type { FileTreeNode, GitStatus, ReviewFile } from '../domain/types/workspace';
import { countFiles, inferLanguage, toUnifiedPatch } from '../utils/fileTree';

export type { GitStatus };

/** @deprecated use FileTreeNode from domain/types */
export type MockFileTreeNode = FileTreeNode;

/** @deprecated use ReviewFile from domain/types */
export type MockReviewFile = ReviewFile;

export const WORKING_DIR = '~/linkloom';

export const MOCK_FILE_TREE: FileTreeNode[] = [
  {
    id: 'linkloom/',
    name: 'linkloom',
    type: 'folder',
    children: [
      { id: 'linkloom/package.json', name: 'package.json', type: 'file', git: 'M' },
      {
        id: 'linkloom/studio/',
        name: 'studio',
        type: 'folder',
        children: [
          { id: 'linkloom/studio/package.json', name: 'package.json', type: 'file' },
          {
            id: 'linkloom/studio/src/',
            name: 'src',
            type: 'folder',
            children: [
              { id: 'linkloom/studio/src/App.tsx', name: 'App.tsx', type: 'file', git: 'M' },
              { id: 'linkloom/studio/src/main.tsx', name: 'main.tsx', type: 'file' },
              {
                id: 'linkloom/studio/src/features/',
                name: 'features',
                type: 'folder',
                children: [
                  {
                    id: 'linkloom/studio/src/features/WorkingSidebar/',
                    name: 'WorkingSidebar',
                    type: 'folder',
                    children: [
                      {
                        id: 'linkloom/studio/src/features/WorkingSidebar/index.tsx',
                        name: 'index.tsx',
                        type: 'file',
                        git: 'A',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'linkloom/packages/',
        name: 'packages',
        type: 'folder',
        children: [
          {
            id: 'linkloom/packages/web/',
            name: 'web',
            type: 'folder',
            children: [{ id: 'linkloom/packages/web/package.json', name: 'package.json', type: 'file' }],
          },
        ],
      },
    ],
  },
];

export const MOCK_REVIEW_FILES: ReviewFile[] = [
  {
    path: 'studio/src/App.tsx',
    add: 18,
    del: 4,
    diff: [
      '@@ -1,6 +1,8 @@',
      '-import { ThemeProvider } from "./theme";',
      '+import { ThemeProvider } from "@lobehub/ui";',
      '+import WorkingSidebar from "./features/WorkingSidebar";',
      ' import AgentConsole from "./pages/AgentConsole";',
      ' ',
      ' export default function App() {',
    ],
  },
  {
    path: 'studio/src/features/WorkingSidebar/index.tsx',
    add: 124,
    del: 0,
    diff: [
      '@@ -0,0 +1,8 @@',
      '+import { DraggablePanel } from "@lobehub/ui";',
      '+',
      '+export default function WorkingSidebar() {',
      '+  return <DraggablePanel>...</DraggablePanel>;',
      '+}',
    ],
  },
  {
    path: 'package.json',
    add: 2,
    del: 0,
    diff: [
      '@@ -12,6 +12,8 @@',
      '   "dependencies": {',
      '+    "@lobehub/editor": "^1.0.0",',
      '     "@lobehub/ui": "5.15.16"',
    ],
  },
];

/** @deprecated use countFiles from utils/fileTree */
export const countMockFiles = countFiles;

/** @deprecated use toUnifiedPatch from utils/fileTree */
export { toUnifiedPatch };

/** @deprecated use inferLanguage from utils/fileTree */
export { inferLanguage };
