/** Split a large text blob into smaller chunks for visible SSE streaming. */
export function splitTextForStreamEmission(
  text: string,
  maxPassthrough = 32,
  chunkSize = 18
): string[] {
  if (!text) return [];
  if (text.length <= maxPassthrough) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Yield reasoning chunks as an async generator.
 *
 * Pacing was removed: providers already return true streaming SSE
 * (see `iterateOpenAISseJson` in AIProvider), so artificially slicing
 * each delta into 18-char pieces with a 16ms sleep between them only
 * added latency on top of the real stream — long reasoning blocks
 * appeared to crawl even though the provider had already emitted them.
 * The generator shape is preserved so callers (ReActRuntime) need no
 * changes; it now yields the whole delta in one tick.
 */
export async function* emitPacedStreamChunks(
  text: string,
  _options?: { maxPassthrough?: number; chunkSize?: number; paceMs?: number }
): AsyncGenerator<string> {
  if (text) yield text;
}
