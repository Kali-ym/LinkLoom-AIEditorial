import { Avatar } from '@lobehub/ui';
import { Command } from 'cmdk';
import {
  Bot,
  Brain,
  ChevronRight,
  FileText,
  Folder,
  Library,
  MessageCircle,
  MessageSquare,
  Plug,
  Puzzle,
  Sparkles,
  Users,
} from 'lucide-react';
import { memo, type ReactNode } from 'react';

import { CommandItem } from './components';
import { commandStrings } from './commandStrings';
import { getSearchResultSubtitle } from './getSearchResultSubtitle';
import { commandMenuStyles as styles } from './styles';
import type { CommandSearchResult } from './types';
import type { ValidSearchType } from './utils/queryParser';
import { useCommandMenu } from './useCommandMenu';

const TYPE_LABELS: Record<ValidSearchType, string> = {
  agent: commandStrings.search.agent,
  chatGroup: commandStrings.search.chatGroup,
  communityAgent: commandStrings.search.communityAgent,
  file: commandStrings.search.file,
  folder: commandStrings.search.folder,
  knowledgeBase: commandStrings.search.knowledgeBase,
  mcp: commandStrings.search.mcp,
  memory: commandStrings.search.memory,
  message: commandStrings.search.message,
  page: commandStrings.search.page,
  plugin: commandStrings.search.plugin,
  topic: commandStrings.search.topic,
};

const TYPE_ICONS: Record<ValidSearchType, typeof MessageSquare> = {
  agent: Sparkles,
  chatGroup: Users,
  communityAgent: Bot,
  file: FileText,
  folder: Folder,
  knowledgeBase: Library,
  mcp: Puzzle,
  memory: Brain,
  message: MessageCircle,
  page: FileText,
  plugin: Plug,
  topic: MessageSquare,
};

const SEARCH_TYPES = Object.keys(TYPE_LABELS) as ValidSearchType[];

interface SearchResultsProps {
  isLoading: boolean;
  onSetTypeFilter: (type: ValidSearchType | undefined) => void;
  results: CommandSearchResult[];
  searchQuery: string;
  typeFilter: ValidSearchType | undefined;
}

function getItemValue(result: CommandSearchResult): string {
  const subtitle = getSearchResultSubtitle(result);
  const meta = [result.title, subtitle, result.description, result.identifier, result.agentName, result.topicTitle]
    .filter(Boolean)
    .join(' ');
  return `search-result ${result.type} ${result.id} ${meta}`.trim();
}

function resolveSearchItemIcon(
  result: CommandSearchResult,
  DefaultIcon: typeof MessageSquare,
): ReactNode {
  if (
    result.avatar &&
    (result.type === 'topic' || result.type === 'agent' || result.type === 'chatGroup')
  ) {
    return (
      <Avatar
        avatar={result.avatar}
        background={result.backgroundColor}
        shape="square"
        size={18}
      />
    );
  }
  return <DefaultIcon />;
}

/** §C.41 搜索结果*/
export const SearchResults = memo(function SearchResults({
  isLoading,
  onSetTypeFilter,
  results,
  searchQuery,
  typeFilter,
}: SearchResultsProps) {
  const { handleSearchResultSelect } = useCommandMenu();

  const grouped = results.reduce<Record<ValidSearchType, CommandSearchResult[]>>(
    (acc, item) => {
      acc[item.type].push(item);
      return acc;
    },
    {
      agent: [],
      chatGroup: [],
      communityAgent: [],
      file: [],
      folder: [],
      knowledgeBase: [],
      mcp: [],
      memory: [],
      message: [],
      page: [],
      plugin: [],
      topic: [],
    },
  );

  if (isLoading) {
    return (
      <Command.Group>
        {[0, 1, 2].map((i) => (
          <div className={styles.skeletonItem} key={i}>
            <div className={styles.skeleton} style={{ width: 20 }} />
            <div className={styles.skeleton} style={{ flex: 1 }} />
          </div>
        ))}
      </Command.Group>
    );
  }

  const types = SEARCH_TYPES.filter((type) => grouped[type].length > 0);

  return (
    <>
      {types.map((type) => {
        const Icon = TYPE_ICONS[type];
        const items = grouped[type];
        const typeLabel = TYPE_LABELS[type];
        return (
          <Command.Group heading={typeLabel} key={type}>
            {items.map((result) => (
              <CommandItem
                forceMount
                key={`${result.type}-${result.id}`}
                description={getSearchResultSubtitle(result)}
                icon={resolveSearchItemIcon(result, Icon)}
                title={result.title}
                trailingLabel={typeLabel}
                value={getItemValue(result)}
                variant="detailed"
                onSelect={() => handleSearchResultSelect(result)}
              />
            ))}
            {!typeFilter && items.length >= 5 ? (
              <Command.Item
                keywords={[`zzz-action-${type}`]}
                value={`zzz-action-${type}-search-more`}
                onSelect={() => onSetTypeFilter(type)}
              >
                <ChevronRight className={styles.icon} />
                <div className={styles.itemContent}>
                  <div className={styles.itemLabel}>
                    {commandStrings.searchMore(searchQuery, typeLabel)}
                  </div>
                </div>
              </Command.Item>
            ) : null}
          </Command.Group>
        );
      })}
    </>
  );
});
