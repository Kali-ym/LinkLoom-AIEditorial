import React, { useEffect, useRef } from 'react';
import type { AiBuilderMention } from '../../../services/agentService';

interface InlineMentionEditorProps {
  draft: string;
  mentions: AiBuilderMention[];
  placeholder?: string;
  className?: string;
  sessionKey?: string;
  resetKey?: number;
  readOnly?: boolean;
  onChange: (draft: string, mentions: AiBuilderMention[]) => void;
  onAtQuery: (query: string, open: boolean) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  editorRef?: React.RefObject<HTMLDivElement | null>;
  mentionKey: (mention: AiBuilderMention) => string;
  mentionText: (mention: AiBuilderMention) => string;
  mentionIcon: (mention: AiBuilderMention) => string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildChipHtml(
  mention: AiBuilderMention,
  mentionKey: (mention: AiBuilderMention) => string,
  mentionText: (mention: AiBuilderMention) => string,
  mentionIcon: (mention: AiBuilderMention) => string
) {
  return `<span contenteditable="false" data-mention-key="${escapeHtml(mentionKey(mention))}" class="mx-0.5 inline-flex max-w-full align-baseline items-center gap-1 rounded-md border border-hairline-soft bg-surface-soft px-1.5 py-0.5 text-xs font-semibold text-text-charcoal shadow-subtle dark:border-white/10 dark:bg-canvas/[0.08] dark:text-slate-100"><span class="material-symbols-outlined inline-flex shrink-0 items-center justify-center text-[14px] leading-none text-text-slate" style="font-size:14px;width:14px;height:14px;font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 20">${mentionIcon(mention)}</span><span class="truncate">${escapeHtml(mentionText(mention))}</span><button type="button" data-remove-mention="1" class="inline-flex h-4 w-4 items-center justify-center rounded-full text-text-stone hover:bg-hairline hover:text-text-charcoal dark:hover:bg-canvas/10"><span class="material-symbols-outlined text-[12px] leading-none" style="font-size:12px;width:12px;height:12px;font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 20">close</span></button></span>`;
}

function buildEditorHtml(
  mentions: AiBuilderMention[],
  draft: string,
  mentionKey: (mention: AiBuilderMention) => string,
  mentionText: (mention: AiBuilderMention) => string,
  mentionIcon: (mention: AiBuilderMention) => string
) {
  const chips = mentions.map(mention => buildChipHtml(mention, mentionKey, mentionText, mentionIcon)).join('');
  const text = escapeHtml(draft).replace(/\n/g, '<br>');
  if (!chips && !text) return '';
  return `${chips}${chips && text ? '&#8203;' : ''}${text}`;
}

function fragmentText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node instanceof DocumentFragment) {
    return Array.from(node.childNodes).map(fragmentText).join('');
  }
  if (!(node instanceof HTMLElement)) return '';
  if (node.hasAttribute('data-mention-key')) return '';
  if (node.tagName === 'BR') return '\n';
  return Array.from(node.childNodes).map(fragmentText).join('');
}

function parseEditor(root: HTMLDivElement, mentionKey: (mention: AiBuilderMention) => string, mentions: AiBuilderMention[]) {
  const mentionByKey = new Map(mentions.map(mention => [mentionKey(mention), mention]));
  const nextMentions: AiBuilderMention[] = [];
  const textParts: string[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      textParts.push(node.textContent || '');
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const key = node.getAttribute('data-mention-key');
    if (key) {
      const mention = mentionByKey.get(key);
      if (mention) nextMentions.push(mention);
      return;
    }
    if (node.tagName === 'BR') {
      textParts.push('\n');
      return;
    }
    node.childNodes.forEach(walk);
  };

  root.childNodes.forEach(walk);
  return {
    draft: textParts.join('').replace(/\u200B/g, '').replace(/^\s+/, ''),
    mentions: nextMentions
  };
}

function getTextBeforeCursor(root: HTMLDivElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return '';
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) return '';

  const preRange = range.cloneRange();
  preRange.selectNodeContents(root);
  preRange.setEnd(range.startContainer, range.startOffset);
  return fragmentText(preRange.cloneContents()).replace(/\u200B/g, '');
}

function placeCaretAtEnd(root: HTMLDivElement) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function InlineMentionEditor({
  draft,
  mentions,
  placeholder = '输入 @ 引用资源，然后描述目标...',
  className = '',
  sessionKey,
  resetKey = 0,
  readOnly = false,
  onChange,
  onAtQuery,
  onKeyDown,
  editorRef,
  mentionKey,
  mentionText,
  mentionIcon
}: InlineMentionEditorProps) {
  const internalRef = useRef<HTMLDivElement | null>(null);
  const ref = editorRef || internalRef;
  const syncingRef = useRef(false);
  const composingRef = useRef(false);
  const lastSerializedRef = useRef('');
  const lastMentionKeysRef = useRef('');
  const lastResetKeyRef = useRef(resetKey);
  const suppressEmitRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || syncingRef.current) return;

    const mentionKeys = mentions.map(mentionKey).join(',');
    const serialized = `${sessionKey || ''}|${mentionKeys}|${draft}`;
    const mentionsChanged = mentionKeys !== lastMentionKeysRef.current;
    lastMentionKeysRef.current = mentionKeys;

    const resetTriggered = resetKey !== lastResetKeyRef.current;
    if (resetTriggered) {
      lastResetKeyRef.current = resetKey;
      suppressEmitRef.current = true;
      window.requestAnimationFrame(() => { suppressEmitRef.current = false; });
    }

    if (!resetTriggered && serialized === lastSerializedRef.current && el.innerHTML) return;
    if (!resetTriggered && document.activeElement === el && !mentionsChanged) return;

    lastSerializedRef.current = serialized;
    el.innerHTML = buildEditorHtml(mentions, draft, mentionKey, mentionText, mentionIcon);
    if (resetTriggered || document.activeElement === el || mentionsChanged) {
      placeCaretAtEnd(el);
    }
  }, [draft, mentions, sessionKey, resetKey, mentionKey, mentionText, mentionIcon, ref]);

  const detectAtQuery = (el: HTMLDivElement, draftText: string) => {
    const beforeCursor = getTextBeforeCursor(el);
    const source = beforeCursor || draftText;
    const atMatch = source.match(/@([^@\n]*)$/);
    onAtQuery(atMatch?.[1] || '', Boolean(atMatch));
  };

  const emitChange = () => {
    const el = ref.current;
    if (!el || readOnly || suppressEmitRef.current) return;
    syncingRef.current = true;
    const next = parseEditor(el, mentionKey, mentions);
    lastSerializedRef.current = `${sessionKey || ''}|${next.mentions.map(mentionKey).join(',')}|${next.draft}`;
    lastMentionKeysRef.current = next.mentions.map(mentionKey).join(',');
    onChange(next.draft, next.mentions);
    detectAtQuery(el, next.draft);
    syncingRef.current = false;
  };

  const handleInput = () => {
    if (composingRef.current || readOnly) return;
    emitChange();
  };

  const handleCompositionEnd = () => {
    composingRef.current = false;
    emitChange();
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-remove-mention]')) {
      window.requestAnimationFrame(() => {
        const el = ref.current;
        if (el) detectAtQuery(el, parseEditor(el, mentionKey, mentions).draft);
      });
      return;
    }
    event.preventDefault();
    const chip = target.closest('[data-mention-key]');
    if (!chip) return;
    chip.remove();
    emitChange();
    ref.current?.focus();
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === '@' || event.key === 'Backspace' || event.key === 'Delete') {
      emitChange();
    }
  };

  return (
    <div
      ref={ref}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      data-placeholder={placeholder}
      onInput={handleInput}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={handleCompositionEnd}
      onClick={handleClick}
      onKeyUp={handleKeyUp}
      onKeyDown={onKeyDown}
      className={`min-h-[56px] w-full whitespace-pre-wrap break-words px-0 py-0.5 text-sm leading-6 text-text-ink outline-none empty:before:text-text-stone empty:before:content-[attr(data-placeholder)] dark:text-white dark:empty:before:text-text-slate ${className}`}
    />
  );
}
