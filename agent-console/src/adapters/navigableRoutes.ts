import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Bot,
  BrainCircuit,
  CalendarClock,
  FilePen,
  FileText,
  History,
  Image,
  LibraryBig,
  Newspaper,
  Settings,
  Shapes,
  Video,
} from 'lucide-react';

import { commandStrings } from '../features/CommandMenu/commandStrings';

export interface NavigableRoute {
  cmdkKey: keyof typeof commandStrings.routes;
  icon: LucideIcon;
  id: string;
  keywords: string[];
  path: string;
  pathPrefix: string;
}

/** Upstream `getNavigableRoutes()` — Admin 外链/演示路由 */
export const NAVIGABLE_ROUTES: NavigableRoute[] = [
  {
    cmdkKey: 'community',
    icon: Shapes,
    id: 'community',
    keywords: ['community', '社区', 'discover'],
    path: 'https://example.com/community',
    pathPrefix: '/community',
  },
  {
    cmdkKey: 'video',
    icon: Video,
    id: 'video',
    keywords: ['video', 'ai video', '视频'],
    path: 'https://example.com/video',
    pathPrefix: '/video',
  },
  {
    cmdkKey: 'image',
    icon: Image,
    id: 'image',
    keywords: ['image', 'picture', '图片', '绘画'],
    path: 'https://example.com/image',
    pathPrefix: '/image',
  },
  {
    cmdkKey: 'resource',
    icon: LibraryBig,
    id: 'resource',
    keywords: ['resource', 'library', '资源', '知识库'],
    path: '/knowledge',
    pathPrefix: '/resource',
  },
  {
    cmdkKey: 'page',
    icon: FilePen,
    id: 'page',
    keywords: ['page', 'document', '文稿'],
    path: 'https://example.com/page',
    pathPrefix: '/page',
  },
  {
    cmdkKey: 'memory',
    icon: BrainCircuit,
    id: 'memory',
    keywords: ['memory', 'preferences', '记忆'],
    path: 'https://example.com/memory',
    pathPrefix: '/memory',
  },
  {
    cmdkKey: 'scheduling',
    icon: CalendarClock,
    id: 'scheduling',
    keywords: ['scheduling', '调度', 'cron', '定时'],
    path: '/scheduling',
    pathPrefix: '/scheduling',
  },
  {
    cmdkKey: 'selection',
    icon: Newspaper,
    id: 'selection',
    keywords: ['selection', '筛选', '新闻', '评分'],
    path: '/selection',
    pathPrefix: '/selection',
  },
  {
    cmdkKey: 'generation',
    icon: FileText,
    id: 'generation',
    keywords: ['generation', '日报', '生成', '发布'],
    path: '/generation',
    pathPrefix: '/generation',
  },
  {
    cmdkKey: 'ops',
    icon: Activity,
    id: 'ops',
    keywords: ['ops', '运维', '工作流', '审批'],
    path: '/ops',
    pathPrefix: '/ops',
  },
  {
    cmdkKey: 'history',
    icon: History,
    id: 'history',
    keywords: ['history', '历史', '存档'],
    path: '/history',
    pathPrefix: '/history',
  },
  {
    cmdkKey: 'agents',
    icon: Bot,
    id: 'agents',
    keywords: ['agents', '智能体', '技能', '工具'],
    path: '/agents',
    pathPrefix: '/agents',
  },
  {
    cmdkKey: 'settings',
    icon: Settings,
    id: 'settings',
    keywords: ['settings', '设置', '配置'],
    path: '/settings',
    pathPrefix: '/settings',
  },
];

export function getNavigableRoutes(): NavigableRoute[] {
  return NAVIGABLE_ROUTES;
}

export function getSettingsRoutePath(): string {
  return '/settings';
}
