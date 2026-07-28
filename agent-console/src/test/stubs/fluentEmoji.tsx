import type { FC, ReactNode } from 'react';

export interface FluentEmojiProps {
  children?: ReactNode;
  emoji?: string;
  size?: number;
  type?: string;
}

export const FluentEmoji: FC<FluentEmojiProps> = () => null;

export function getEmoji() {
  return undefined;
}

export function getEmojiNameByCharacter() {
  return undefined;
}

export function getFluentEmojiCDN() {
  return '';
}

export default FluentEmoji;
