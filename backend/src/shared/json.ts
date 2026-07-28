/**
 * 统一的 JSON 解析工具集。
 *
 * 该模块把原来散落在 `utils/helpers.ts`、`services/repositories/searchUtils.ts`、
 * `services/repositories/BaseRepository.ts`、`services/aiBuilder/AiBuilderUtils.ts`
 * 中的 4 套 JSON 解析逻辑收敛为一处实现，所有调用方应优先 import 自此文件。
 *
 * 设计原则：
 * - 仅暴露纯函数（无 IO、无副作用）。
 * - LLM 友好：能处理带 Markdown 围栏、AI_BUILD 标记、控制字符的脏字符串。
 * - 不抛业务异常；上层若需要 strict 校验，请自行包装。
 */

/** 移除字符串首尾的 Markdown 代码块标记（```json / ```markdown / ```）。 */
export function removeMarkdownCodeBlock(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();

  const jsonFence = '```json';
  const markdownFence = '```markdown';
  const genericFence = '```';

  if (cleaned.startsWith(jsonFence)) {
    cleaned = cleaned.substring(jsonFence.length);
  } else if (cleaned.startsWith(markdownFence)) {
    cleaned = cleaned.substring(markdownFence.length);
  } else if (cleaned.startsWith(genericFence)) {
    cleaned = cleaned.substring(genericFence.length);
  }

  if (cleaned.endsWith(genericFence)) {
    cleaned = cleaned.substring(0, cleaned.length - genericFence.length);
  }
  return cleaned.trim();
}

/**
 * 将 JSON 字符串字面量中的裸控制字符（换行/制表/0x00-0x1F）转义为合法形式，
 * 修复 LLM 经常吐出的非法 JSON。
 */
export function sanitizeJsonStringLiterals(json: string): string {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      result += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString) {
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        if (ch === '\n') result += '\\n';
        else if (ch === '\r') result += '\\r';
        else if (ch === '\t') result += '\\t';
        else result += `\\u${code.toString(16).padStart(4, '0')}`;
        continue;
      }
    }
    result += ch;
  }
  return result;
}

function looksLikeJsonPayload(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

/** 从 LLM 回复中截取最外层 JSON 片段（去 Markdown 围栏）。 */
export function sliceJsonPayload(text: string): string {
  const original = (text || '').trim();
  let raw = original;
  const fence = original.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const inner = fence[1].trim();
    // 围栏内若不是 JSON（例如误贴了正则片段），继续在全文里找 { / [
    if (looksLikeJsonPayload(inner)) {
      raw = inner;
    }
  }
  const jsonStart = raw.indexOf('{');
  const arrStart = raw.indexOf('[');
  if (jsonStart >= 0 && (arrStart < 0 || jsonStart < arrStart)) {
    raw = raw.slice(jsonStart);
  } else if (arrStart >= 0) {
    raw = raw.slice(arrStart);
  } else if (!looksLikeJsonPayload(raw) && raw !== original) {
    // 围栏提取失败时回退到原始文本再试一次
    const oStart = original.indexOf('{');
    const oArr = original.indexOf('[');
    if (oStart >= 0 && (oArr < 0 || oStart < oArr)) return original.slice(oStart);
    if (oArr >= 0) return original.slice(oArr);
  }
  return raw;
}

/** 宽松解析 JSON：先标准 parse，失败则消毒控制字符后再 parse。 */
export function parseJsonLenient<T = unknown>(text: string): T {
  const raw = sliceJsonPayload(text);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return JSON.parse(sanitizeJsonStringLiterals(raw)) as T;
  }
}

/**
 * 尝试从文本中提取并解析 JSON 数据。
 * 优先匹配最外层的 `[ ]` 或 `{ }`；适合处理 LLM 杂乱输出。
 */
export function extractJson<T = any>(text: string): T | null {
  if (!text) return null;

  const cleaned = removeMarkdownCodeBlock(text).trim();
  try {
    return parseJsonLenient<T>(cleaned);
  } catch {
    // 继续走正则提取
  }

  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return parseJsonLenient<T>(arrayMatch[0]);
    } catch {
      /* ignore */
    }
  }

  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return parseJsonLenient<T>(objectMatch[0]);
    } catch {
      /* ignore */
    }
  }

  return null;
}

/**
 * AI Builder 专用：识别 `AI_BUILD_PLAN_JSON` 前缀标记的对象 JSON。
 * 与 `extractJson` 的区别：要求结果必须为对象，且支持 marker 锚定。
 * 解析失败抛 Error，让调用方决定如何处理。
 */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^\uFEFF/, '');
  if (!trimmed) throw new Error('AI returned empty content');

  const markerIndex = trimmed.lastIndexOf('AI_BUILD_PLAN_JSON');
  const searchArea =
    markerIndex >= 0
      ? trimmed
          .slice(markerIndex)
          .replace(/^AI_BUILD_PLAN_JSON\s*/i, '')
          .trim()
      : trimmed;

  const fenced = searchArea.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [
    fenced?.[1]?.trim(),
    searchArea.startsWith('{') || searchArea.startsWith('[') ? searchArea : null
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(candidate.slice(start, end + 1));
        } catch {
          /* try next candidate */
        }
      }
    }
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error('AI response does not contain valid JSON');
}

/** 将数据库 JSON 列里的 JSON 数组容错解析为 string[]，失败返回 []。 */
export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (!value || typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** 将数据库 JSON 列里的 JSON 对象容错解析为 Record，失败返回 {}。 */
export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (!value || typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** 通用 JSON 列解析；空值返回 fallback，否则直接 JSON.parse（不做消毒）。 */
export function parseJsonOrFallback<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === 'object') return value as T;
  return JSON.parse(String(value)) as T;
}
