import { Reply } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';

import type { FollowUpChip } from '../../../domain/types/followUp';
import { useChatStore, useInputStore } from '../../../stores';
import { useActiveTopicStreaming } from '../../../services/streaming/streamingScope';
import {
  followUpSlotKey,
  useFollowUpActionStore,
} from '../../../stores/followUpActionStore';
import { followUpStyles } from './followUpStyles';

const EMPTY_CHIPS: FollowUpChip[] = [];

/** §C.59 FollowUpChips*/
export const FollowUpChips = memo(function FollowUpChips({
  conversationKey,
  messageId,
}: {
  conversationKey: string;
  messageId: string;
}) {
  const slot = useMemo(() => followUpSlotKey(conversationKey, messageId), [conversationKey, messageId]);
  const chips = useFollowUpActionStore((s) => s.chipsBySlot[slot] ?? EMPTY_CHIPS);
  const isStreaming = useActiveTopicStreaming();
  const streamingMessageId = useChatStore((s) => s.streamingByTopicId[conversationKey]?.id);

  const handleClick = useCallback((chip: FollowUpChip) => {
    const editor = useInputStore.getState().mainEditor;
    useInputStore.getState().clearDraft();
    editor?.setDocument('text', '');
    useInputStore.getState().setDraft(chip.message);
    editor?.setDocument('text', chip.message);
    editor?.focus();
  }, []);

  if (chips.length === 0 || isStreaming || streamingMessageId === messageId) return null;

  return (
    <div className={followUpStyles.root}>
      {chips.map((chip, index) => (
        <button
          key={`${messageId}-${chip.label}`}
          aria-label={chip.label}
          className={followUpStyles.chip}
          style={{ animationDelay: `${index * 60}ms` }}
          type="button"
          onClick={() => handleClick(chip)}
        >
          <Reply className={`${followUpStyles.chipIcon} followup-icon`} size={14} />
          <span>{chip.label}</span>
        </button>
      ))}
    </div>
  );
});
