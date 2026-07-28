import { parsePluginJson } from './parsePluginJson';

export interface TodoPanelItem {
  activeForm?: string;
  content?: string;
  status?: 'completed' | 'in_progress' | 'pending';
}

export interface TodoUpdateItem {
  completed?: boolean;
  content?: string;
  id: string;
  label?: string;
}

type LinkloomItem = { status?: string; text?: string };
type LegacyTodo = { content?: string; completed?: boolean; status?: string };
type RawTodoUpdate = { id?: string; content?: string; completed?: boolean };

function mapLinkloomStatus(status?: string): TodoPanelItem['status'] {
  if (status === 'done' || status === 'completed') return 'completed';
  if (status === 'processing' || status === 'in_progress') return 'in_progress';
  return 'pending';
}

function mapLegacyTodo(todo: LegacyTodo): TodoPanelItem {
  const status = todo.completed ? 'completed' : mapLinkloomStatus(todo.status);
  return {
    content: todo.content ?? '',
    status,
    activeForm: status === 'in_progress' ? todo.content : undefined,
  };
}

function readPluginTodos(pluginState?: unknown, content?: string): LegacyTodo[] | undefined {
  const fromState = parsePluginJson<{ todos?: LegacyTodo[] }>(content, pluginState);
  return fromState?.todos?.length ? fromState.todos : undefined;
}

function resolveUpdateLabel(
  id: string,
  pluginState?: unknown,
  content?: string,
  resultTodos?: TodoPanelItem[],
): string | undefined {
  const pluginTodos = readPluginTodos(pluginState, content);
  const numericIndex = /^\d+$/.test(id) ? Number(id) : Number.NaN;

  if (!Number.isNaN(numericIndex)) {
    const fromPlugin = pluginTodos?.[numericIndex]?.content?.trim();
    if (fromPlugin) return fromPlugin;
    const fromResult = resultTodos?.[numericIndex]?.content?.trim();
    if (fromResult) return fromResult;
  }

  return pluginTodos?.find((todo, index) => String(index) === id || todo.content === id)?.content?.trim();
}

export function parseTodoUpdates(args?: Record<string, unknown>): TodoUpdateItem[] | undefined {
  const raw = Array.isArray(args?.updates) ? (args.updates as RawTodoUpdate[]) : undefined;
  if (!raw?.length) return undefined;

  return raw
    .map((item): TodoUpdateItem | null => {
      const id = typeof item?.id === 'string' ? item.id.trim() : String(item?.id ?? '').trim();
      if (!id) return null;
      const update: TodoUpdateItem = { id };
      if (typeof item.content === 'string') update.content = item.content;
      if (typeof item.completed === 'boolean') update.completed = item.completed;
      return update;
    })
    .filter((item): item is TodoUpdateItem => item != null);
}

export function enrichTodoUpdates(
  updates: TodoUpdateItem[],
  pluginState?: unknown,
  content?: string,
  resultTodos?: TodoPanelItem[],
): TodoUpdateItem[] {
  return updates.map((update) => ({
    ...update,
    label: update.content?.trim() || resolveUpdateLabel(update.id, pluginState, content, resultTodos),
  }));
}

export function readTodoUpdateSummary(pluginState?: unknown, content?: string): string | undefined {
  const fromState = parsePluginJson<{ summary?: string }>(content, pluginState);
  const summary = fromState?.summary?.trim();
  return summary || undefined;
}

/** Normalize linkloom-agent todos, legacy todos[], updates[], and plugin JSON payloads. */
export function normalizeTodoPanelItems(
  args?: Record<string, unknown>,
  pluginState?: unknown,
  content?: string,
): TodoPanelItem[] | undefined {
  const items = Array.isArray(args?.items) ? (args.items as LinkloomItem[]) : undefined;
  if (items?.length) {
    return items.map((item) => {
      const status = mapLinkloomStatus(item.status);
      return {
        content: item.text ?? '',
        status,
        activeForm: status === 'in_progress' ? item.text : undefined,
      };
    });
  }

  const adds = Array.isArray(args?.adds) ? (args.adds as string[]) : undefined;
  if (adds?.length) {
    return adds.map((text) => ({ content: text, status: 'pending' as const }));
  }

  const legacyTodos = Array.isArray(args?.todos) ? (args.todos as LegacyTodo[]) : undefined;
  if (legacyTodos?.length) {
    return legacyTodos.map(mapLegacyTodo);
  }

  const updates = parseTodoUpdates(args);
  if (updates?.length) {
    const pluginTodos = readPluginTodos(pluginState, content);
    const resultTodos = pluginTodos?.map(mapLegacyTodo);
    return enrichTodoUpdates(updates, pluginState, content, resultTodos).map((update) => ({
      content: update.label ?? update.content ?? `待办 #${update.id}`,
      status:
        update.completed === true
          ? ('completed' as const)
          : update.completed === false
            ? ('pending' as const)
            : ('pending' as const),
    }));
  }

  const fromState = parsePluginJson<{ todos?: LegacyTodo[]; items?: LinkloomItem[] }>(
    content,
    pluginState,
  );
  if (fromState?.items?.length) {
    return fromState.items.map((item) => {
      const status = mapLinkloomStatus(item.status);
      return {
        content: item.text ?? '',
        status,
        activeForm: status === 'in_progress' ? item.text : undefined,
      };
    });
  }
  if (fromState?.todos?.length) {
    return fromState.todos.map(mapLegacyTodo);
  }

  return undefined;
}
