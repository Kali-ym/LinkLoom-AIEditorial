import { extractJson, parseJsonLenient } from '../../utils/helpers.js';

export type WorkflowScope = Record<string, unknown>;

export function parsePath(path: string): Array<string | number> {
  const clean = String(path || '')
    .trim()
    .replace(/^\$\.?/, '');
  if (!clean) return [];
  const out: Array<string | number> = [];
  const re = /([^[.\]]+)|\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    if (m[1] !== undefined) out.push(m[1]);
    else if (m[2] !== undefined) out.push(Number(m[2]));
  }
  return out;
}

export function getByPath(source: unknown, path: string): unknown {
  const parts = parsePath(path);
  let cur = source as any;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (part === 'length' && (Array.isArray(cur) || typeof cur === 'string')) {
      cur = cur.length;
      continue;
    }
    cur = cur[part as any];
  }
  return cur;
}

export function setByPath(target: any, path: string, value: unknown): any {
  const parts = parsePath(path);
  if (parts.length === 0) return value;
  let cur = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    if (cur[part as any] === undefined || cur[part as any] === null) {
      cur[part as any] = typeof nextPart === 'number' ? [] : {};
    }
    cur = cur[part as any];
  }
  cur[parts[parts.length - 1] as any] = value;
  return target;
}

export function deepClone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function truncateString(value: string, maxChars: number): string {
  if (!Number.isFinite(maxChars) || maxChars < 0) return value;
  if (value.length <= maxChars) return value;
  if (maxChars <= 1) return value.slice(0, Math.max(0, maxChars));
  return `${value.slice(0, maxChars - 1)}…`;
}

export function truncateFields(value: unknown, limits: Record<string, number>, path = ''): unknown {
  if (!limits || Object.keys(limits).length === 0) return value;
  if (Array.isArray(value)) return value.map((item) => truncateFields(item, limits, path));
  if (!value || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key;
    const maxChars = limits[childPath] ?? limits[key];
    if (typeof raw === 'string' && typeof maxChars === 'number') {
      out[key] = truncateString(raw, maxChars);
    } else {
      out[key] = truncateFields(raw, limits, childPath);
    }
  }
  return out;
}

function projectItem(
  raw: unknown,
  fields: string[],
  fieldLimits?: Record<string, number>
): Record<string, unknown> {
  const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const picked: Record<string, unknown> = {};
  for (const field of fields) {
    setByPath(picked, field, getByPath(item, field));
  }
  return truncateFields(picked, fieldLimits || {}) as Record<string, unknown>;
}

export function resolveRef(ref: unknown, scope: WorkflowScope): unknown {
  if (typeof ref !== 'string') return ref;
  if (ref.startsWith('$')) return getByPath(scope, ref);
  return ref;
}

export function renderTemplateString(template: string, scope: WorkflowScope): string {
  return String(template ?? '').replace(
    /\{\{\s*([^}]+?)\s*\}\}|\$\{\s*([^}]+?)\s*\}/g,
    (_m, braceExpr, dollarExpr) => {
      const rawExpr = String(braceExpr ?? dollarExpr ?? '').trim();
      const expr = rawExpr.startsWith('$') ? rawExpr : `$.${rawExpr}`;
      const value = resolveRef(expr, scope);
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    }
  );
}

export function renderTemplate(value: unknown, scope: WorkflowScope): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\$[.[]/.test(trimmed)) return resolveRef(trimmed, scope);
    const fullPlaceholder = trimmed.match(/^\{\{\s*([^}]+?)\s*\}\}$|^\$\{\s*([^}]+?)\s*\}$/);
    if (fullPlaceholder) {
      const rawExpr = String(fullPlaceholder[1] ?? fullPlaceholder[2] ?? '').trim();
      const expr = rawExpr.startsWith('$') ? rawExpr : `$.${rawExpr}`;
      const resolved = resolveRef(expr, scope);
      return resolved === null || resolved === undefined ? '' : resolved;
    }
    return renderTemplateString(value, scope);
  }
  if (Array.isArray(value)) return value.map((item) => renderTemplate(item, scope));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        renderTemplate(val, scope)
      ])
    );
  }
  return value;
}

function truthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

function compare(value: unknown, op: string, expected: unknown): boolean {
  if (op === 'exists') return value !== undefined && value !== null;
  if (op === 'notExists') return value === undefined || value === null;
  if (op === 'eq') return value === expected;
  if (op === 'ne') return value !== expected;
  if (op === 'includes') return String(value ?? '').includes(String(expected ?? ''));
  if (op === 'match') return new RegExp(String(expected ?? '')).test(String(value ?? ''));
  if (op === 'gt') return Number(value) > Number(expected);
  if (op === 'gte') return Number(value) >= Number(expected);
  if (op === 'lt') return Number(value) < Number(expected);
  if (op === 'lte') return Number(value) <= Number(expected);
  return truthy(value);
}

export function evalCondition(condition: unknown, itemScope: WorkflowScope): boolean {
  if (!condition || typeof condition !== 'object') return true;
  const c = condition as Record<string, unknown>;
  const value = resolveRef(c.path, itemScope);
  return compare(value, String(c.op || 'truthy'), resolveRef(c.value, itemScope));
}

function sortByPath(items: unknown[], path: string, direction = 'asc') {
  return [...items].sort((a, b) => {
    const av = getByPath(a, path);
    const bv = getByPath(b, path);
    const cmp = Number(av) - Number(bv);
    const out =
      Number.isFinite(cmp) && cmp !== 0 ? cmp : String(av ?? '').localeCompare(String(bv ?? ''));
    return direction === 'desc' ? -out : out;
  });
}

export type WorkflowTransformStep = Record<string, unknown>;

export function runTransform(
  input: unknown,
  operations: WorkflowTransformStep[] = [],
  baseScope: WorkflowScope = {}
): unknown {
  let current = deepClone(input);
  const scope = { ...baseScope, input: current, current };

  const refresh = () => {
    scope.input = current;
    scope.current = current;
  };

  for (const op of operations) {
    const type = String(op.op || op.type || '');
    if (type === 'parseJson') {
      const source = op.path ? getByPath(scope, String(op.path)) : current;
      if (typeof source === 'string') {
        const trimmed = source.trim();
        if (!trimmed) {
          current = source;
        } else {
          const parsed = extractJson(trimmed);
          if (parsed === null) {
            try {
              current = parseJsonLenient(trimmed);
            } catch (err) {
              const preview = trimmed.slice(0, 120).replace(/\s+/g, ' ');
              throw new Error(
                `工作流输入不是合法 JSON（需要 {"items":[...]} 等对象/数组）。解析失败: ${
                  err instanceof Error ? err.message : String(err)
                }；内容预览: ${preview}`
              );
            }
          } else {
            current = parsed;
          }
        }
      } else {
        current = source;
      }
      refresh();
    } else if (type === 'stringifyJson') {
      const source = op.path ? getByPath(scope, String(op.path)) : current;
      current = JSON.stringify(source);
      refresh();
    } else if (type === 'set') {
      current = current && typeof current === 'object' ? current : {};
      setByPath(current, String(op.path || ''), resolveRef(op.value, scope));
      refresh();
    } else if (type === 'copy') {
      current = current && typeof current === 'object' ? current : {};
      setByPath(current, String(op.to || ''), resolveRef(op.from, scope));
      refresh();
    } else if (type === 'merge') {
      const value = resolveRef(op.value, scope);
      current = {
        ...(current && typeof current === 'object' && !Array.isArray(current) ? current : {}),
        ...(value && typeof value === 'object' && !Array.isArray(value) ? value : {})
      };
      refresh();
    } else if (type === 'pick') {
      const fields = Array.isArray(op.fields) ? (op.fields as string[]) : [];
      current = Object.fromEntries(fields.map((field) => [field, getByPath(scope, field)]));
      refresh();
    } else if (type === 'default') {
      const path = String(op.path || '');
      if (getByPath(current, path) === undefined) {
        current = current && typeof current === 'object' ? current : {};
        setByPath(current, path, resolveRef(op.value, scope));
        refresh();
      }
    } else if (type === 'template') {
      current = renderTemplate(op.template ?? current, scope);
      refresh();
    } else if (type === 'jsonPath') {
      current = getByPath(scope, String(op.path || ''));
      refresh();
    } else if (type === 'filterArray') {
      const arr = resolveRef(op.path || '$.current', scope);
      current = Array.isArray(arr)
        ? arr.filter((item, index) => evalCondition(op.where, { ...scope, item, index }))
        : [];
      refresh();
    } else if (type === 'mapArray') {
      const arr = resolveRef(op.path || '$.current', scope);
      current = Array.isArray(arr)
        ? arr.map((item, index) =>
            renderTemplate(op.template ?? '$.item', {
              ...scope,
              item,
              index,
              index1: index + 1,
              count: arr.length
            })
          )
        : [];
      refresh();
    } else if (type === 'projectArray') {
      const arr = resolveRef(op.path || '$.current', scope);
      const fields = Array.isArray(op.fields) ? op.fields.map(String) : [];
      const limits =
        op.fieldLimits && typeof op.fieldLimits === 'object'
          ? (op.fieldLimits as Record<string, number>)
          : {};
      current = Array.isArray(arr) ? arr.map((item) => projectItem(item, fields, limits)) : [];
      refresh();
    } else if (type === 'truncateFields') {
      const limits =
        op.fieldLimits && typeof op.fieldLimits === 'object'
          ? (op.fieldLimits as Record<string, number>)
          : {};
      current = truncateFields(current, limits);
      refresh();
    } else if (type === 'sortArray') {
      const arr = resolveRef(op.path || '$.current', scope);
      current = Array.isArray(arr)
        ? sortByPath(arr, String(op.by || ''), String(op.direction || 'asc'))
        : [];
      refresh();
    } else if (type === 'append') {
      const arr = Array.isArray(current) ? current : [];
      current = [...arr, resolveRef(op.value, scope)];
      refresh();
    } else if (type === 'wrapResult') {
      current = renderTemplate(op.template ?? op.value ?? {}, scope);
      refresh();
    }
  }

  return current;
}
