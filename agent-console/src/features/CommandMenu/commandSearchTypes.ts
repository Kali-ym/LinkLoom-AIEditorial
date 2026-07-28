import type { ReactNode } from 'react';

import type { CommandSearchResult as DomainCommandSearchResult } from '../../domain/types/commandSearch';

/** UI 层搜索结果（avatar 可为 React 节点，经 enrichCommandSearchResults 注入）。 */
export type CommandSearchResult = Omit<DomainCommandSearchResult, 'avatar'> & {
  avatar?: string | ReactNode;
};
