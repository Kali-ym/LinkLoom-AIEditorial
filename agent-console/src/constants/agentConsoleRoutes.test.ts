import { describe, expect, it } from 'vitest';

import {
  agentConsoleAgentPath,
  agentConsolePopupPath,
  agentConsoleTaskPath,
  agentConsoleTopicPath,
  agentConsoleTopicsPath,
  buildAgentConsoleUrl,
  isAgentConsolePopupRoute,
  isAgentSubRoute,
  parseAgentConsolePath,
} from './agentConsoleRoutes';

describe('agent console routes', () => {
  it('builds canonical chat and topic paths', () => {
    expect(buildAgentConsoleUrl({ agentId: 'topic_copilot' }, 'https://app.test')).toBe(
      '/console/topic_copilot',
    );
    expect(
      buildAgentConsoleUrl(
        { agentId: 'topic_copilot', topicId: 'tpc_abc' },
        'https://app.test',
      ),
    ).toBe('/console/topic_copilot/t/tpc_abc');
    expect(
      buildAgentConsoleUrl(
        { agentId: 'topic_copilot', topicId: 'tpc_abc', popup: true },
        'https://app.test',
      ),
    ).toBe('/console/popup/topic_copilot/t/tpc_abc');
  });

  it('parses agent-scoped paths', () => {
    expect(parseAgentConsolePath('/console/topic_copilot')).toEqual({
      agentId: 'topic_copilot',
      section: 'chat',
    });
    expect(parseAgentConsolePath('/console/topic_copilot/t/tpc_abc')).toEqual({
      agentId: 'topic_copilot',
      topicId: 'tpc_abc',
      section: 'chat',
    });
    expect(parseAgentConsolePath('/console/topic_copilot/topics')).toEqual({
      agentId: 'topic_copilot',
      section: 'topics',
    });
    expect(parseAgentConsolePath('/console/topic_copilot/task/run-1')).toEqual({
      agentId: 'topic_copilot',
      section: 'task',
      taskId: 'run-1',
    });
  });

  it('detects popup and sub-routes', () => {
    expect(isAgentConsolePopupRoute('/console/popup/topic_copilot')).toBe(true);
    expect(isAgentSubRoute('/console/topic_copilot/topics')).toBe(true);
    expect(isAgentSubRoute('/console/topic_copilot/t/tpc_abc')).toBe(false);
  });

  it('exposes path helpers', () => {
    expect(agentConsoleAgentPath('topic_copilot')).toBe('/console/topic_copilot');
    expect(agentConsoleTopicPath('topic_copilot', 'tpc_abc')).toBe(
      '/console/topic_copilot/t/tpc_abc',
    );
    expect(agentConsoleTopicsPath('super_admin')).toBe(
      '/console/super_admin/topics',
    );
    expect(agentConsoleTaskPath('topic_copilot', 'run-1')).toBe(
      '/console/topic_copilot/task/run-1',
    );
    expect(agentConsolePopupPath('topic_copilot', 'tpc_abc')).toBe(
      '/console/popup/topic_copilot/t/tpc_abc',
    );
  });
});
