import { describe, expect, it } from 'vitest';

import { mapTopicMessagesToRunContext } from './runContext';

describe('mapTopicMessagesToRunContext', () => {
  it('maps visible user and assistant turns without empty content', () => {
    expect(
      mapTopicMessagesToRunContext([
        {
          id: 'u-1',
          role: 'user',
          content: '第一条',
          createdAt: '08:00',
        },
        {
          id: 'a-1',
          role: 'assistant',
          content: '回复一',
          createdAt: '08:01',
        },
      ]),
    ).toEqual([
      { role: 'user', content: '第一条' },
      { role: 'assistant', content: '回复一' },
    ]);
  });
});
