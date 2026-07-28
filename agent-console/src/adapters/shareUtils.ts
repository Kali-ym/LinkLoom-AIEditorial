export function makeShareId(topicId: string): string {
  return `share-${topicId.replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'demo'}`;
}
