/** Best-effort partial JSON parse for streaming tool arguments (§C.43). */
export function safeParsePartialJSON(raw?: string): Record<string, unknown> {
  if (!raw?.trim()) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    // Heuristic: close open braces/brackets for in-flight JSON
    let attempt = raw.trim();
    for (let i = 0; i < 8; i += 1) {
      try {
        const parsed = JSON.parse(attempt) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // ignore
      }
      if (attempt.endsWith('{') || attempt.endsWith('[') || attempt.endsWith(',')) {
        attempt = `${attempt}}`;
      } else {
        attempt = `${attempt}}`;
      }
    }
    return {};
  }
}
