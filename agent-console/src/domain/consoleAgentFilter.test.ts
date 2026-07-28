import { describe, expect, it } from 'vitest';

import { APPLICATION_CONSOLE_AGENT_IDS } from './applicationConsoleAgents';
import { filterAgentsForConsole } from './consoleAgentFilter';
import { resolvePrimaryAgentId } from './resolvePrimaryAgent';
import type { Agent } from './types';

const agents: Agent[] = [
  {
    id: 'topic_copilot',
    name: '选题 Copilot',
    description: '',
    gradient: '',
    isPrimary: true,
    consoleVisible: true,
  },
  {
    id: 'super_admin',
    name: '超级管理员',
    description: '',
    gradient: '',
    consoleVisible: true,
  },
  {
    id: 'code',
    name: '代码助手',
    description: '',
    gradient: '',
    consoleVisible: true,
  },
];

describe('consoleAgentFilter', () => {
  it('only keeps application console agents', () => {
    expect(filterAgentsForConsole(agents).map((a) => a.id)).toEqual([
      'topic_copilot',
      'super_admin',
    ]);
  });

  it('application allowlist is topic_copilot + super_admin', () => {
    expect(APPLICATION_CONSOLE_AGENT_IDS).toEqual(['topic_copilot', 'super_admin']);
  });

  it('keeps allowlisted agents when consoleVisible is unset', () => {
    const unset: Agent[] = [
      {
        id: 'super_admin',
        name: '超级管理员',
        description: '',
        gradient: '',
      },
    ];
    expect(filterAgentsForConsole(unset).map((a) => a.id)).toEqual(['super_admin']);
  });
});

describe('resolvePrimaryAgentId', () => {
  it('prefers isPrimary among visible application agents', () => {
    expect(resolvePrimaryAgentId(agents)).toBe('topic_copilot');
  });

  it('falls back to first visible application agent', () => {
    const withoutPrimary = agents.filter((a) => !a.isPrimary);
    expect(resolvePrimaryAgentId(withoutPrimary)).toBe('super_admin');
  });
});
