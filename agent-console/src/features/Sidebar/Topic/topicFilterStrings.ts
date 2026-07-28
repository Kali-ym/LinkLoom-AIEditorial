import { t } from '../../../i18n';
import type { TopicGroupMode, TopicSortBy } from '../../../stores/types';

/** §C.8 / §C.33* 子集 */
export const topicFilterStrings = {
  filterAria: t('topicFilter.filterAria'),
  organize: t('topicFilter.organize'),
  sort: t('topicFilter.sort'),
  filter: t('topicFilter.filter'),
  showCompleted: t('topicFilter.showCompleted'),
  groupMode: {
    byStatus: t('topicFilter.groupMode.byStatus'),
    byTime: t('topicFilter.groupMode.byTime'),
    byProject: t('topicFilter.groupMode.byProject'),
    flat: t('topicFilter.groupMode.flat'),
  } satisfies Record<TopicGroupMode, string>,
  sortBy: {
    createdAt: t('topicFilter.sortBy.createdAt'),
    updatedAt: t('topicFilter.sortBy.updatedAt'),
  } satisfies Record<TopicSortBy, string>,
} as const;
