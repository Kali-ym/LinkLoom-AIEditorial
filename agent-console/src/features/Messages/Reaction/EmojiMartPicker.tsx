import data from '@emoji-mart/data';
import zh from '@emoji-mart/data/i18n/zh.json';
import Picker from '@emoji-mart/react';
import { useTheme } from 'antd-style';
import { memo } from 'react';

interface EmojiMartSelection {
  native?: string;
}

interface EmojiMartPickerProps {
  onSelect: (emoji: string) => void;
}

/** §C.25*/
export const EmojiMartPicker = memo(function EmojiMartPicker({ onSelect }: EmojiMartPickerProps) {
  const { isDarkMode } = useTheme();

  return (
    <Picker
      data={data}
      i18n={zh}
      previewPosition="none"
      skinTonePosition="search"
      theme={isDarkMode ? 'dark' : 'light'}
      onEmojiSelect={(emoji: EmojiMartSelection) => {
        if (emoji.native) onSelect(emoji.native);
      }}
    />
  );
});
