/** Canonical workspace artifact paths for plan / todos (file-first agent UX). */
export const LINKLOOM_DIR = '.linkloom';
export const LINKLOOM_PLAN_PATH = '.linkloom/plan.md';
export const LINKLOOM_TODOS_PATH = '.linkloom/todos.json';

export function normalizeLinkloomPath(inputPath: string): string {
  return inputPath
    .trim()
    .replace(/^\/workspace\//, '')
    .replace(/^\.\//, '')
    .replace(/\\/g, '/');
}

export function isLinkloomPlanPath(inputPath: string): boolean {
  return normalizeLinkloomPath(inputPath) === LINKLOOM_PLAN_PATH;
}

export function isLinkloomTodosPath(inputPath: string): boolean {
  return normalizeLinkloomPath(inputPath) === LINKLOOM_TODOS_PATH;
}

export function formatPlanMarkdown(plan: { goal?: string; context?: string }): string {
  const goal = plan.goal?.trim() || '';
  const context = plan.context?.trim() || '';
  const lines = ['# Plan', ''];
  if (goal) {
    lines.push(`## Goal`, '', goal, '');
  }
  if (context) {
    lines.push(`## Context`, '', context, '');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function parsePlanMarkdown(content: string): { goal?: string; context?: string } {
  const text = content.replace(/\r\n/g, '\n').trim();
  if (!text) return {};

  const goalMatch = text.match(/##\s*Goal\s*\n+([\s\S]*?)(?=\n##\s|\s*$)/i);
  const contextMatch = text.match(/##\s*Context\s*\n+([\s\S]*?)(?=\n##\s|\s*$)/i);
  if (goalMatch || contextMatch) {
    return {
      goal: goalMatch?.[1]?.trim() || undefined,
      context: contextMatch?.[1]?.trim() || undefined,
    };
  }

  // Fallback: first non-empty line as goal, rest as context
  const lines = text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (lines.length === 0) return {};
  return {
    goal: lines[0]!.trim(),
    context: lines.slice(1).join('\n').trim() || undefined,
  };
}

export interface LinkloomTodoItem {
  id: string;
  content: string;
  completed?: boolean;
}

export function parseTodosJson(content: string): LinkloomTodoItem[] {
  const trimmed = content.trim();
  if (!trimmed || trimmed === '[]') return [];
  const parsed = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('todos.json must be a JSON array');
  }
  return parsed.map((item, index) => {
    if (typeof item === 'string') {
      return { id: `todo-${index + 1}`, content: item, completed: false };
    }
    const row = item as Record<string, unknown>;
    return {
      id: String(row.id ?? `todo-${index + 1}`),
      content: String(row.content ?? row.label ?? ''),
      completed: row.completed === true || row.done === true,
    };
  });
}

export function formatTodosJson(todos: LinkloomTodoItem[]): string {
  return `${JSON.stringify(todos, null, 2)}\n`;
}
