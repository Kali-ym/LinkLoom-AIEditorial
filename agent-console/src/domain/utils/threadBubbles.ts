import type { Message } from '../types';

export interface ThreadBubble {
  role: 'user' | 'assistant';
  html: string;
}

/** Pure transform: portal thread bubbles → domain messages (no fixture dependency). */
export function threadBubblesToMessages(bubbles: ThreadBubble[], threadId: string): Message[] {
  return bubbles.map((bubble, index) => ({
    id: `thread-bubble-${threadId}-${index}`,
    role: bubble.role,
    content: bubble.html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''),
    createdAt: `13:${String(index).padStart(2, '0')}`,
    threadId,
  }));
}
