import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';

import type { CommandSearchResult } from './types';

dayjs.extend(relativeTime);

export function formatSearchRelativeTime(iso?: string): string | undefined {
  if (!iso) return undefined;
  const parsed = dayjs(iso);
  if (!parsed.isValid()) return undefined;
  return parsed.locale('zh-cn').fromNow();
}

/** §C.41*/
export function getSearchResultSubtitle(result: CommandSearchResult): string | undefined {
  if (result.subtitle?.trim()) return result.subtitle.trim();

  switch (result.type) {
    case 'topic': {
      const parts = [result.agentName, formatSearchRelativeTime(result.updatedAt)].filter(Boolean);
      return parts.length > 0 ? parts.join(' · ') : result.description;
    }
    case 'message': {
      const preview = result.description?.trim();
      const parts = [result.topicTitle, preview].filter(Boolean);
      if (parts.length > 0) return parts.join(' · ');
      return preview;
    }
    default:
      return result.description;
  }
}
