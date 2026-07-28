import type { IEditor, ISlashMenuOption } from '@lobehub/editor';
import { INSERT_MENTION_COMMAND } from '@lobehub/editor';
import Fuse from 'fuse.js';
import { useCallback, useMemo, useRef } from 'react';

import { useInputStore } from '../../../../stores';
import type { InsertActionTagPayload } from '../ActionTag/command';
import { INSERT_ACTION_TAG_COMMAND } from '../ActionTag/command';
import { INSERT_REFER_TOPIC_COMMAND } from '../ReferTopic';
import { createMentionMenu } from './createMentionMenu';
import { MENTION_FUSE_THRESHOLD } from './constants';
import { mentionMarkdownWriter } from './mentionMarkdownWriter';
import type { MentionMenuState } from './types';
import { useMentionCategories } from './useMentionCategories';

export function useMentionEditorOption() {
  const featureMention = useInputStore((s) => s.featureMention);
  const categories = useMentionCategories();
  const stateRef = useRef<MentionMenuState>({ isSearch: false, matchingString: '' });
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  const allMentionItems = useMemo(() => categories.flatMap((c) => c.items), [categories]);

  const fuse = useMemo(
    () =>
      new Fuse(allMentionItems, {
        keys: ['key', 'label', 'metadata.topicTitle', 'metadata.path', 'metadata.name'],
        threshold: MENTION_FUSE_THRESHOLD,
      }),
    [allMentionItems],
  );

  const searchRef = useRef({ allMentionItems, fuse });
  searchRef.current = { allMentionItems, fuse };

  const mentionItemsFn = useCallback(
    async (
      search: { leadOffset: number; matchingString: string; replaceableString: string } | null,
    ) => {
      const { allMentionItems: items, fuse: fuseIndex } = searchRef.current;
      if (search?.matchingString) {
        stateRef.current = { isSearch: true, matchingString: search.matchingString };
        return fuseIndex.search(search.matchingString).map((r) => r.item);
      }
      stateRef.current = { isSearch: false, matchingString: '' };
      return [...items];
    },
    [],
  );

  const MentionMenuComp = useMemo(() => createMentionMenu(stateRef, categoriesRef), []);

  const mentionOnSelect = useCallback((editor: IEditor, option: ISlashMenuOption) => {
    const metadata = option.metadata as Record<string, unknown> | undefined;
    if (metadata?.type === 'topic') {
      editor.dispatchCommand(INSERT_REFER_TOPIC_COMMAND, {
        topicId: String(metadata.topicId ?? ''),
        topicTitle: String(metadata.topicTitle ?? option.label ?? ''),
      });
    } else if (metadata?.type === 'skill' || metadata?.type === 'tool') {
      const payload: InsertActionTagPayload = {
        category: metadata.actionCategory as InsertActionTagPayload['category'],
        label: String(option.label ?? ''),
        type: String(metadata.actionType ?? ''),
      };
      editor.dispatchCommand(INSERT_ACTION_TAG_COMMAND, payload);
    } else if (metadata?.type === 'localFile') {
      editor.dispatchCommand(INSERT_MENTION_COMMAND, {
        label: String(option.label ?? ''),
        metadata,
      });
    } else {
      editor.dispatchCommand(INSERT_MENTION_COMMAND, {
        label: String(option.label ?? ''),
        metadata,
      });
    }
  }, []);

  const hasMentionItems = allMentionItems.length > 0;

  // Stable object identity
  const mentionOption = useMemo(
    () =>
      featureMention && hasMentionItems
        ? {
            items: mentionItemsFn,
            markdownWriter: mentionMarkdownWriter,
            maxLength: 50,
            onSelect: mentionOnSelect,
            renderComp: MentionMenuComp,
          }
        : undefined,
    [MentionMenuComp, featureMention, hasMentionItems, mentionItemsFn, mentionOnSelect],
  );

  return { mentionOption };
}
