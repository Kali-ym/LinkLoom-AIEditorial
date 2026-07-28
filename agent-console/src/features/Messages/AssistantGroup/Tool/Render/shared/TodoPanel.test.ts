import { describe, expect, it } from 'vitest';

import {
  enrichTodoUpdates,
  normalizeTodoPanelItems,
  parseTodoUpdates,
} from './todoPanelNormalize';

describe('todo panel normalization', () => {
  it('parses updateTodos updates payload', () => {
    expect(
      parseTodoUpdates({
        updates: [{ id: '0', completed: true }],
      }),
    ).toEqual([{ id: '0', completed: true }]);
  });

  it('renders updateTodos as panel items instead of raw args', () => {
    expect(
      normalizeTodoPanelItems(
        { updates: [{ id: '0', completed: true }] },
        { todos: [{ content: '玩一局游戏', completed: true }] },
      ),
    ).toEqual([
      {
        content: '玩一局游戏',
        status: 'completed',
      },
    ]);
  });

  it('enriches update labels from plugin state todos', () => {
    expect(
      enrichTodoUpdates(
        [{ id: '0', completed: true }],
        { todos: [{ content: '整理组件映射', completed: true }] },
      ),
    ).toEqual([{ id: '0', completed: true, label: '整理组件映射' }]);
  });
});
