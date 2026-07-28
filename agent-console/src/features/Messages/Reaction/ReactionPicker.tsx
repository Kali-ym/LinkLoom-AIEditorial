import { ActionIcon, Flexbox, Popover } from '@lobehub/ui';
import { PlusIcon, SmilePlus } from 'lucide-react';
import { lazy, memo, Suspense, useState } from 'react';

import { usePermission } from '../../../hooks/usePermission';
import { useChatStore } from '../../../stores/chatStore';
import { messageActionStrings } from '../MessageActionBar/messageActionStrings';
import { QUICK_REACTIONS, reactionStyles } from './reactionStyles';

const EmojiMartPicker = lazy(() =>
  import('./EmojiMartPicker').then((m) => ({ default: m.EmojiMartPicker })),
);

/** §C.59 ReactionPicker — 10 快捷 emoji + emoji-mart 全量 */
export const ReactionPicker = memo(function ReactionPicker({ messageId }: { messageId: string }) {
  const { allowed: canEdit } = usePermission('edit_own_content');
  const addReaction = useChatStore((s) => s.addReaction);
  const [open, setOpen] = useState(false);
  const [showExtended, setShowExtended] = useState(false);

  if (!canEdit) return null;

  const handleSelect = (emoji: string) => {
    addReaction(messageId, emoji);
    setOpen(false);
    setShowExtended(false);
  };

  const content = showExtended ? (
    <div className={reactionStyles.emojiMartContainer}>
      <Suspense fallback={null}>
        <EmojiMartPicker onSelect={handleSelect} />
      </Suspense>
    </div>
  ) : (
    <Flexbox className={reactionStyles.pickerContainer} gap={4} horizontal wrap="wrap">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          className={reactionStyles.emojiButton}
          type="button"
          onClick={() => handleSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
      <button
        className={reactionStyles.moreButton}
        type="button"
        aria-label="更多表情"
        onClick={() => setShowExtended(true)}
      >
        <PlusIcon size={16} />
      </button>
    </Flexbox>
  );

  return (
    <Popover
      arrow={false}
      content={content}
      open={open}
      placement="top"
      styles={{ content: { padding: 0 } }}
      trigger="click"
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setShowExtended(false);
      }}
    >
      <span {...(open ? { 'data-popup-open': '' } : {})}>
        <ActionIcon
          icon={SmilePlus}
          size="small"
          title={messageActionStrings.reaction}
        />
      </span>
    </Popover>
  );
});
