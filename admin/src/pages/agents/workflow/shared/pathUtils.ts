import type { WorkflowInputField } from '../../../../services/agentService';

export interface FieldGroup {
  name?: string;
  fields: WorkflowInputField[];
}

/** 按 field.group 分组；未声明分组归到「基础」。 */
export function groupFields(fields: WorkflowInputField[]): FieldGroup[] {
  const map = new Map<string, FieldGroup>();
  for (const field of fields) {
    const groupName = field.group || '基础';
    if (!map.has(groupName)) {
      map.set(groupName, { name: groupName, fields: [] });
    }
    map.get(groupName)!.fields.push(field);
  }
  return Array.from(map.values());
}

/** 按点分路径读取嵌套对象。 */
export function getByPath(obj: Record<string, unknown> | undefined | null, path: string): unknown {
  if (!obj) return undefined;
  const parts = path.split('.');
  let cur: any = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

/** 按点分路径不可变地写入嵌套对象。value 为 undefined 时删除该 key。 */
export function setByPath(
  obj: Record<string, unknown> | undefined | null,
  path: string,
  value: unknown
): Record<string, unknown> {
  const root: Record<string, unknown> = obj ? { ...obj } : {};
  const parts = path.split('.');
  let cur: any = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof cur[part] !== 'object' || cur[part] === null) {
      cur[part] = {};
    } else {
      cur[part] = { ...cur[part] };
    }
    cur = cur[part];
  }
  const lastKey = parts[parts.length - 1];
  if (value === undefined) {
    delete cur[lastKey];
  } else {
    cur[lastKey] = value;
  }
  return root;
}

/** 判断一个值是否是工作流表达式字符串（$.foo / ${bar}）。 */
export function isExpressionString(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.startsWith('$.') || trimmed.startsWith('${');
}
