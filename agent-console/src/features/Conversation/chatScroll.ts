let chatScrollEl: HTMLDivElement | null = null;

// Track whether the user is actively pinning to the bottom of the conversation.
let userPinnedToBottom = true;
// Timestamp of the last user-initiated scroll.
let lastUserScrollAt = 0;
// Single in-flight RAF handle for streaming "follow the bottom" updates.
let followRafId: number | null = null;
// After bulk content swaps (topic switch, API refresh) suppress incremental
// follow-scroll so ResizeObserver doesn't animate the viewport down frame by
// frame while markdown/images hydrate.
let suppressFollowUntil = 0;

export function registerChatScrollEl(el: HTMLDivElement | null): void {
  chatScrollEl = el;
  if (el) {
    userPinnedToBottom = true;
  }
}

/** Mark that the user just touched the scroll surface. */
export function markUserScroll(): void {
  lastUserScrollAt = Date.now();
}

/** Update pinned-to-bottom from a scroll event. */
export function syncPinnedFromScroll(threshold = 120): void {
  if (!chatScrollEl) return;
  const dist = chatScrollEl.scrollHeight - chatScrollEl.scrollTop - chatScrollEl.clientHeight;
  const wasPinned = userPinnedToBottom;
  userPinnedToBottom = dist <= threshold;
  if (wasPinned && !userPinnedToBottom) {
    lastUserScrollAt = Date.now();
  }
}

/**
 * Instant snap to the bottom — never animates. Use for streaming follow,
 * topic switch, and post-refresh pin. Direct scrollTop assignment bypasses
 * CSS scroll-behavior entirely.
 */
export function instantScrollToBottom(): void {
  if (!chatScrollEl) return;
  userPinnedToBottom = true;
  chatScrollEl.scrollTop = chatScrollEl.scrollHeight;
}

/**
 * Scroll to bottom. When smooth=true, only the BackBottom button should call
 * this — explicit scrollTo({ behavior: 'smooth' }) on the element.
 */
export function scrollChatToBottom(smooth = true): void {
  if (!chatScrollEl) return;
  userPinnedToBottom = true;
  if (smooth) {
    chatScrollEl.scrollTo({
      top: chatScrollEl.scrollHeight,
      behavior: 'smooth',
    });
  } else {
    instantScrollToBottom();
  }
}

/** Suppress incremental follow-scroll briefly (topic switch / API refresh). */
export function suppressAutoFollow(ms = 400): void {
  suppressFollowUntil = Date.now() + ms;
}

/** Coalesced per-frame follow during streaming. */
export function followStreamBottom(): void {
  if (!chatScrollEl) return;
  if (!userPinnedToBottom) return;
  if (Date.now() < suppressFollowUntil) return;
  if (Date.now() - lastUserScrollAt < 240) return;
  if (followRafId != null) return;
  followRafId = requestAnimationFrame(() => {
    followRafId = null;
    if (!chatScrollEl) return;
    if (!userPinnedToBottom) return;
    if (Date.now() < suppressFollowUntil) return;
    chatScrollEl.scrollTop = chatScrollEl.scrollHeight;
  });
}

export function cancelFollowStream(): void {
  if (followRafId != null) {
    cancelAnimationFrame(followRafId);
    followRafId = null;
  }
}

export function isChatNearBottom(threshold = 120): boolean {
  if (!chatScrollEl) return true;
  const dist = chatScrollEl.scrollHeight - chatScrollEl.scrollTop - chatScrollEl.clientHeight;
  return dist <= threshold;
}

export function isUserPinnedToBottom(): boolean {
  return userPinnedToBottom;
}

/**
 * Topic switch / hydration: reset pin state and snap instantly before paint.
 * Suppresses incremental follow so ResizeObserver doesn't fight the snap.
 */
export function resetScrollState(snapToBottom = true): void {
  cancelFollowStream();
  suppressAutoFollow(400);
  userPinnedToBottom = true;
  lastUserScrollAt = 0;
  if (snapToBottom) {
    instantScrollToBottom();
  }
}

/** Snap to bottom before paint when bulk message list was replaced. */
export function snapIfPinned(): void {
  if (!userPinnedToBottom) return;
  instantScrollToBottom();
}

/** index.html `getIndicatorWidth` */
export function getMinimapIndicatorWidth(text: string): number {
  const len = (text || '').length;
  const ratio = Math.min(Math.sqrt(len / 80), 1);
  return 5 + (16 - 5) * ratio;
}

export function getMinimapPreviewFromBubble(el: Element): string {
  const bubble = el.querySelector('.bubble[data-editable], .bubble');
  if (!bubble) return '';
  const plain = (bubble as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
  if (!plain) return '';
  return plain.length > 100 ? `${plain.slice(0, 100)}…` : plain;
}

/** index.html `updateMinimapActiveFromScroll` */
export function getMinimapActiveIndexFromScroll(userEls: ArrayLike<Element>): number {
  if (!chatScrollEl || userEls.length === 0) return 0;
  const anchor = chatScrollEl.getBoundingClientRect().top + 80;
  let activePos = 0;
  for (let i = 0; i < userEls.length; i += 1) {
    const el = userEls[i];
    if (el && el.getBoundingClientRect().top <= anchor) activePos = i;
  }
  return activePos;
}

export function jumpToUserMessageEl(el: Element): void {
  if (!chatScrollEl || !el) return;
  const containerRect = chatScrollEl.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  chatScrollEl.scrollTo({
    top: chatScrollEl.scrollTop + (elRect.top - containerRect.top) - 24,
    behavior: 'smooth',
  });
}
