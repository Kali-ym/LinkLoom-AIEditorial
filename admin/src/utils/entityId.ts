/** 与后端存储键一致：字母、数字、下划线、连字符，1～80 字符 */
const ENTITY_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

export function getEntityIdFormatError(id: string): string | null {
  const t = id.trim();
  if (!t) return 'ID 不能为空';
  if (!ENTITY_ID_PATTERN.test(t)) {
    return 'ID 仅允许字母、数字、下划线与连字符，长度 1～80';
  }
  return null;
}

/**
 * 判断 newId 是否与列表中已有项冲突。
 * @param originalId 打开编辑弹窗时的 ID；新建时为 null
 */
export function isResourceIdTaken(
  items: { id: string }[],
  newId: string,
  originalId: string | null
): boolean {
  const t = newId.trim();
  const matches = items.filter((x) => x.id === t);
  if (matches.length === 0) return false;
  if (originalId === null) return true;
  if (t === originalId) return matches.length > 1;
  return true;
}
