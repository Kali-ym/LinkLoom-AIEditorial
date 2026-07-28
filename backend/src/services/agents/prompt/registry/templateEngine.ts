import type { RenderOptions, RenderResult } from './types.js';

/**
 * 模板引擎:负责变量替换与 fragment 引用展开。
 * 与 PromptService 旧的 split/join 替换保持向后兼容,并扩展:
 *   {{varName}}            -> variables[varName]
 *   {{#fragment:fragId}}   -> fragment 正文(递归展开)
 *
 * 设计要点:
 * - 用 split/join 替换变量,避免 $ 在 replacement string 中被特殊解析
 * - fragment 引用单独走正则扫描 + 递归,带 maxDepth 防循环
 * - 不变量: 若 variables/fragments 缺失,占位符保留原样并产生 warning
 */

const FRAGMENT_PATTERN = /\{\{#fragment:([\w.-]+)\}\}/g;
const VAR_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

/** 占位符正则,用于检测未替换变量(仅在 expandFragments=false 或变量缺失时报警) */
const ANY_PLACEHOLDER_PATTERN = /\{\{[#\w.\s-]+\}\}/g;

export function renderTemplate(
  template: string,
  options: RenderOptions = {},
  fragmentResolver?: (id: string) => string | undefined
): RenderResult {
  const variables = options.variables ?? {};
  const expandFragments = options.expandFragments !== false;
  const onMissing = options.onMissingFragment ?? 'warn';
  const maxDepth = options.maxDepth ?? 3;
  const warnings: string[] = [];
  const usedSet: Set<string> = new Set();

  // Step 1: fragment 展开(递归)
  let text = template;
  if (expandFragments && fragmentResolver) {
    text = expandFragmentsRecursively(text, fragmentResolver, {
      depth: 0,
      maxDepth,
      onMissing,
      usedSet,
      warnings,
      stack: [],
    });
  } else if (expandFragments && !fragmentResolver) {
    // 没有 resolver 但允许展开:仅扫描出引用,记 warning
    let m: RegExpExecArray | null;
    FRAGMENT_PATTERN.lastIndex = 0;
    while ((m = FRAGMENT_PATTERN.exec(template))) {
      warnings.push(`fragment resolver not provided, skip {{#fragment:${m[1]}}}`);
    }
  }

  // Step 2: 变量替换(split/join,避免 $ 被错误解析)
  for (const [key, value] of Object.entries(variables)) {
    text = text.split(`{{${key}}}`).join(value);
    // 兼容带空格写法 {{ key }}
    text = text.split(`{{ ${key} }}`).join(value);
  }

  // Step 3: 检测剩余占位符,产生 warning
  if (warnings.length < 10) {
    let m: RegExpExecArray | null;
    ANY_PLACEHOLDER_PATTERN.lastIndex = 0;
    let count = 0;
    while ((m = ANY_PLACEHOLDER_PATTERN.exec(text))) {
      if (count < 5) {
        warnings.push(`unresolved placeholder: ${m[0]}`);
      }
      count++;
    }
    if (count > 5) {
      warnings.push(`... and ${count - 5} more unresolved placeholders`);
    }
  }

  return { text, usedFragments: Array.from(usedSet), warnings };
}

interface ExpandContext {
  depth: number;
  maxDepth: number;
  onMissing: 'warn' | 'throw' | 'ignore';
  usedSet: Set<string>;
  warnings: string[];
  /** 当前展开路径栈,用于检测循环引用(id 在祖先链上出现即循环) */
  stack: string[];
}

function expandFragmentsRecursively(
  text: string,
  resolver: (id: string) => string | undefined,
  ctx: ExpandContext
): string {
  if (ctx.depth >= ctx.maxDepth) {
    ctx.warnings.push(`max fragment depth ${ctx.maxDepth} reached, stop expanding`);
    return text;
  }

  let result = text;
  let m: RegExpExecArray | null;
  FRAGMENT_PATTERN.lastIndex = 0;
  const matches: Array<{ id: string; index: number; full: string }> = [];
  while ((m = FRAGMENT_PATTERN.exec(text))) {
    matches.push({ id: m[1], index: m.index, full: m[0] });
  }

  for (const match of matches) {
    const body = resolver(match.id);
    if (body === undefined) {
      if (ctx.onMissing === 'throw') {
        throw new Error(`fragment not found: ${match.id}`);
      }
      if (ctx.onMissing === 'warn') {
        ctx.warnings.push(`fragment not found: ${match.id}`);
      }
      // throw/warn/ignore 都不替换占位符,保留原文
      continue;
    }

    // 循环引用检测:id 出现在当前祖先栈上即循环
    if (ctx.stack.includes(match.id)) {
      ctx.warnings.push(`cyclic fragment reference: ${match.id}`);
      continue;
    }
    ctx.usedSet.add(match.id);

    // 递归展开 fragment 正文里的引用
    const expandedBody = expandFragmentsRecursively(body, resolver, {
      ...ctx,
      depth: ctx.depth + 1,
      stack: [...ctx.stack, match.id],
    });

    result = result.split(match.full).join(expandedBody);
  }

  return result;
}

/** 仅扫描 fragment 引用,不做替换。用于静态分析 */
export function scanFragmentRefs(text: string): string[] {
  const refs: string[] = [];
  let m: RegExpExecArray | null;
  FRAGMENT_PATTERN.lastIndex = 0;
  while ((m = FRAGMENT_PATTERN.exec(text))) {
    refs.push(m[1]);
  }
  return refs;
}

/** 仅扫描变量引用,不做替换。用于静态分析 */
export function scanVariables(text: string): string[] {
  const vars: string[] = [];
  let m: RegExpExecArray | null;
  VAR_PATTERN.lastIndex = 0;
  while ((m = VAR_PATTERN.exec(text))) {
    if (!m[0].startsWith('{{#')) {
      vars.push(m[1].trim());
    }
  }
  return vars;
}
