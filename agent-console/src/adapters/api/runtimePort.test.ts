import { describe, expect, it } from 'vitest';

import { apiRuntimePort } from './runtimePort';

describe('apiRuntimePort', () => {
  it('enables Plus menu tool catalog (enableFC) in api mode', async () => {
    const config = await apiRuntimePort.getConsoleConfig();
    expect(config.enableFC).toBe(true);
    expect(config.enableKnowledgeBase).toBe(true);
  });
});
