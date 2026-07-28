import { describe, expect, it, vi, beforeEach } from 'vitest';
import { settingsTools } from '../src/plugins/builtin/tools/admin/settingsTools.js';
import type { ToolExecutionContext } from '../src/services/ToolExecutionContext.js';

const {
  mockGetSettings,
  mockSaveSettings,
  mockTestProvider,
  mockCreateApiKey,
} = vi.hoisted(() => ({
  mockGetSettings: vi.fn(),
  mockSaveSettings: vi.fn(),
  mockTestProvider: vi.fn(),
  mockCreateApiKey: vi.fn(),
}));

vi.mock('../src/services/api/SettingsRouteService.js', () => ({
  SettingsRouteService: class MockSettingsRouteService {
    getSettings = mockGetSettings;
    saveSettings = mockSaveSettings;
    createApiKey = mockCreateApiKey;
  },
}));

vi.mock('../src/services/api/DashboardRouteService.js', () => ({
  DashboardRouteService: class MockDashboardRouteService {
    testProvider = mockTestProvider;
  },
}));

function ctx(): ToolExecutionContext {
  return { store: {}, services: {} } as unknown as ToolExecutionContext;
}

describe('admin settings tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockReturnValue({
      ACTIVE_AI_PROVIDER_ID: 'p1',
      AI_PROVIDERS: [{ id: 'p1', type: 'OPENAI', apiKey: 'sk-test' }],
    });
    mockSaveSettings.mockResolvedValue({ status: 'success' });
    mockTestProvider.mockResolvedValue({ status: 'success', message: 'ok' });
    mockCreateApiKey.mockResolvedValue({ id: 'key1', key: 'sk_pf_abcdefghijklmnop' });
  });

  it('get_settings returns masked settings', async () => {
    const t = settingsTools.find((x) => x.id === 'get_settings')!;
    const r = await t.handler({}, ctx());
    expect(r.ok).toBe(true);
    expect(r.settings.AI_PROVIDERS).toHaveLength(1);
    expect(mockGetSettings).toHaveBeenCalled();
  });

  it('get_settings is read-only (no execution policy)', () => {
    const t = settingsTools.find((x) => x.id === 'get_settings')!;
    expect(t.execution).toBeUndefined();
  });

  it('update_settings calls saveSettings with patch', async () => {
    const t = settingsTools.find((x) => x.id === 'update_settings')!;
    const patch = { ACTIVE_AI_PROVIDER_ID: 'p2' };
    const r = await t.handler({ patch }, ctx());
    expect(r.ok).toBe(true);
    expect(mockSaveSettings).toHaveBeenCalledWith(patch);
  });

  it('update_settings has high execution policy', () => {
    const t = settingsTools.find((x) => x.id === 'update_settings')!;
    expect(t.execution).toEqual({ readonly: false, riskLevel: 'high' });
  });

  it('test_ai_provider with providerId looks up from settings', async () => {
    const t = settingsTools.find((x) => x.id === 'test_ai_provider')!;
    const r = await t.handler({ providerId: 'p1' }, ctx());
    expect(r.ok).toBe(true);
    expect(mockTestProvider).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
    );
  });

  it('test_ai_provider with providerConfig passes config directly', async () => {
    const t = settingsTools.find((x) => x.id === 'test_ai_provider')!;
    const config = { id: 'custom', type: 'GEMINI', apiKey: 'k' };
    const r = await t.handler({ providerConfig: config }, ctx());
    expect(r.ok).toBe(true);
    expect(mockTestProvider).toHaveBeenCalledWith(config);
  });

  it('test_ai_provider returns NOT_FOUND for unknown providerId', async () => {
    const t = settingsTools.find((x) => x.id === 'test_ai_provider')!;
    const r = await t.handler({ providerId: 'missing' }, ctx());
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('NOT_FOUND');
  });

  it('create_api_key returns full key and masked message', async () => {
    const t = settingsTools.find((x) => x.id === 'create_api_key')!;
    const r = await t.handler({ name: 'CI Key' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.key).toBe('sk_pf_abcdefghijklmnop');
    expect(r.message).toContain('...');
    expect(r.message).toContain('仅显示一次');
    expect(mockCreateApiKey).toHaveBeenCalledWith(false, 'CI Key');
  });

  it('settingsTools has exactly 4 tools', () => {
    expect(settingsTools).toHaveLength(4);
  });
});
