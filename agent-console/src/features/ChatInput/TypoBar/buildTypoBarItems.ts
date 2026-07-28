import { getHotkeyById, HotkeyEnum } from '@lobehub/editor';
import type { ChatInputActionsProps } from '@lobehub/editor/react';
import { useEditorState } from '@lobehub/editor/react';
import {
  BoldIcon,
  CodeXmlIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MessageSquareQuote,
  SigmaIcon,
  SquareDashedBottomCodeIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from 'lucide-react';

import { typoBarStrings } from './typoBarStrings';

export type TypoBarEditorState = ReturnType<typeof useEditorState>;

/** §C.57*/
export function buildTypoBarItems(
  editorState: TypoBarEditorState,
  canCreate = true,
): ChatInputActionsProps['items'] {
  const disabled = !canCreate;

  return [
    {
      active: editorState.isBold,
      disabled,
      icon: BoldIcon,
      key: 'bold',
      label: typoBarStrings.bold,
      onClick: editorState.bold,
      tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Bold).keys },
    },
    {
      active: editorState.isItalic,
      disabled,
      icon: ItalicIcon,
      key: 'italic',
      label: typoBarStrings.italic,
      onClick: editorState.italic,
      tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Italic).keys },
    },
    {
      active: editorState.isUnderline,
      disabled,
      icon: UnderlineIcon,
      key: 'underline',
      label: typoBarStrings.underline,
      onClick: editorState.underline,
      tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Underline).keys },
    },
    {
      active: editorState.isStrikethrough,
      disabled,
      icon: StrikethroughIcon,
      key: 'strikethrough',
      label: typoBarStrings.strikethrough,
      onClick: editorState.strikethrough,
      tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Strikethrough).keys },
    },
    { type: 'divider' },
    {
      disabled,
      icon: ListIcon,
      key: 'bulletList',
      label: typoBarStrings.bulletList,
      onClick: editorState.bulletList,
      tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.BulletList).keys },
    },
    {
      disabled,
      icon: ListOrderedIcon,
      key: 'numberlist',
      label: typoBarStrings.numberList,
      onClick: editorState.numberList,
      tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.NumberList).keys },
    },
    {
      disabled,
      icon: ListTodoIcon,
      key: 'tasklist',
      label: typoBarStrings.taskList,
      onClick: editorState.checkList,
    },
    { type: 'divider' },
    {
      active: editorState.isBlockquote,
      disabled,
      icon: MessageSquareQuote,
      key: 'blockquote',
      label: typoBarStrings.blockquote,
      onClick: editorState.blockquote,
    },
    { type: 'divider' },
    {
      disabled,
      icon: SigmaIcon,
      key: 'math',
      label: typoBarStrings.tex,
      onClick: editorState.insertMath,
    },
    {
      active: editorState.isCode,
      disabled,
      icon: CodeXmlIcon,
      key: 'code',
      label: typoBarStrings.code,
      onClick: editorState.code,
      tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.CodeInline).keys },
    },
    {
      disabled,
      icon: SquareDashedBottomCodeIcon,
      key: 'codeblock',
      label: typoBarStrings.codeblock,
      onClick: editorState.codeblock,
    },
  ] as ChatInputActionsProps['items'];
}
