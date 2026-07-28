/** §C.44 — Topic 分组标题（mock 期硬编码 zh-CN，接 i18n 时替换为 `topic.json` keys） */
export const topicGroupStrings = {
  favorite: '收藏',
  loadMore: '更多',
  noProject: '无目录',
  byStatus: {
    active: '活跃',
    archived: '已归档',
    completed: '已完成',
    paused: '已暂停',
    pending: '待处理',
    running: '进行中',
  },
  byTime: {
    month: '本月',
    today: '今天',
    week: '本周',
    yesterday: '昨天',
  },
  projectStatus: {
    failed: (count: number) => `${count} 个失败`,
    loading: (count: number) => `${count} 个进行中`,
    waitingForHuman: (count: number) => `${count} 个待输入`,
  },
  addNewTopicInProject: (directory: string) => `在 ${directory} 中开启新话题`,
} as const;

export function formatTimeGroupTitle(id: string, title?: string): string {
  if (title) return title;
  const fixed = topicGroupStrings.byTime[id as keyof typeof topicGroupStrings.byTime];
  if (fixed) return fixed;
  if (/^\d{4}-\d{2}$/.test(id)) {
    const [year, month] = id.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(year, month - 1, 1));
  }
  return id;
}
