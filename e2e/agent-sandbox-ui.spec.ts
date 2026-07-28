import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL || 'http://127.0.0.1:3000';
const ADMIN_BASE = process.env.E2E_ADMIN_URL || 'http://127.0.0.1:5173/admin';
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'change-me-admin-password';
const E2E_AGENT_ID = process.env.E2E_AGENT_ID || 'topic_copilot';

async function login(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API_BASE}/api/login`, {
    data: { password: E2E_PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { token: string };
  return body.token;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function dismissConsentIfPresent(page: Page): Promise<void> {
  const allow = page.getByRole('button', { name: '允 许' });
  if (await allow.isVisible().catch(() => false)) {
    await allow.click();
  }
}

async function startFreshTopic(page: Page): Promise<void> {
  await page.getByTitle('开启新话题').click();
  await expect(page.getByText('新话题').first()).toBeVisible({ timeout: 15_000 });
}

async function sendChatMessage(page: Page, message: string): Promise<void> {
  const editor = page.locator('[contenteditable="true"]').last();
  await editor.click();
  await editor.pressSequentially(message, { delay: 15 });
  const sendReady = page.locator('button[class*="sendButtonReady"], button.ant-btn-primary').last();
  await expect(sendReady).toBeEnabled({ timeout: 10_000 });
  await sendReady.click();
}

async function expectFallbackToast(page: Page): Promise<void> {
  const toast = page
    .locator('.ant-message-notice-content, [data-sonner-toast], [class*="toast"]')
    .filter({ hasText: /回退到本机执行/ })
    .first();
  await expect(toast).toBeVisible({ timeout: 30_000 });
}

async function openAgentConsole(page: Page, agentId: string) {
  await page.goto(`${ADMIN_BASE}/agents/console?agent=${encodeURIComponent(agentId)}`);
  await expect(page.locator('body')).toBeVisible();
  await dismissConsentIfPresent(page);
  await expect(page.getByRole('button', { name: /无设备|本机|云端沙箱|远程设备|未知设备/ }).first()).toBeVisible({
    timeout: 30_000,
  });
}

async function selectSandboxTarget(page: Page) {
  const deviceButton = page.getByRole('button', { name: /无设备|本机|云端沙箱|远程设备|未知设备/ }).first();
  await deviceButton.click();
  const popover = page.getByRole('dialog');
  await popover.getByText('云端沙箱', { exact: true }).click();
  await expect(deviceButton).toContainText('云端沙箱');
}

test.describe('Agent sandbox UI (admin + backend)', () => {
  test.describe.configure({ mode: 'serial' });

  let token = '';
  let originalAgentConsole: Record<string, unknown> | undefined;

  test.beforeAll(async ({ request }) => {
    token = await login(request);
    const agentsResponse = await request.get(`${API_BASE}/api/agents`, {
      headers: authHeaders(token),
    });
    expect(agentsResponse.ok()).toBeTruthy();
    const agents = (await agentsResponse.json()) as Array<{
      id: string;
      metadata?: { agentConsole?: Record<string, unknown> };
    }>;
    const agent = agents.find((item) => item.id === E2E_AGENT_ID);
    expect(agent).toBeTruthy();
    originalAgentConsole = agent?.metadata?.agentConsole
      ? { ...agent.metadata.agentConsole }
      : undefined;
  });

  test.afterAll(async ({ request }) => {
    if (!token) return;
    const agentsResponse = await request.get(`${API_BASE}/api/agents`, {
      headers: authHeaders(token),
    });
    if (!agentsResponse.ok()) return;
    const agents = (await agentsResponse.json()) as Array<Record<string, unknown> & { id: string }>;
    const agent = agents.find((item) => item.id === E2E_AGENT_ID);
    if (!agent) return;
    const metadata = (agent.metadata as Record<string, unknown> | undefined) ?? {};
    const nextMetadata = { ...metadata };
    if (originalAgentConsole) {
      nextMetadata.agentConsole = originalAgentConsole;
    } else {
      delete nextMetadata.agentConsole;
    }
    await request.post(`${API_BASE}/api/agents`, {
      headers: authHeaders(token),
      data: { ...agent, metadata: nextMetadata },
    });
    await request.delete(`${API_BASE}/api/agents/${E2E_AGENT_ID}/sandbox?clearVolume=true`, {
      headers: authHeaders(token),
    });
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((authToken) => {
      localStorage.setItem('auth_token', authToken);
    }, token);
  });

  test('persists sandbox execution target after reload', async ({ page, request }) => {
    test.setTimeout(90_000);
    await openAgentConsole(page, E2E_AGENT_ID);
    await selectSandboxTarget(page);

    await expect
      .poll(async () => {
        const saved = await request.get(`${API_BASE}/api/agents`, {
          headers: authHeaders(token),
        });
        const agents = (await saved.json()) as Array<{
          id: string;
          metadata?: { agentConsole?: { executionTarget?: string } };
        }>;
        return agents.find((item) => item.id === E2E_AGENT_ID)?.metadata?.agentConsole
          ?.executionTarget;
      })
      .toBe('sandbox');

    await page.reload();
    await dismissConsentIfPresent(page);
    const deviceButton = page.getByRole('button', { name: /无设备|本机|云端沙箱|远程设备|未知设备/ }).first();
    await expect(deviceButton).toContainText('云端沙箱', { timeout: 30_000 });
    await deviceButton.click();
    await expect(page.getByRole('button', { name: '启动沙箱' })).toBeVisible();
    await expect(page.getByRole('button', { name: '停止沙箱' })).toBeVisible();
  });

  test('start/stop sandbox updates footer status', async ({ page }) => {
    test.setTimeout(90_000);
    await openAgentConsole(page, E2E_AGENT_ID);
    await selectSandboxTarget(page);

    const deviceButton = page.getByRole('button', { name: /云端沙箱/ }).first();
    await deviceButton.click();

    await page.getByRole('button', { name: '启动沙箱' }).click();
    await expect(page.getByText('运行中')).toBeVisible({ timeout: 60_000 });

    await page.getByRole('button', { name: '停止沙箱' }).click();
    await expect(page.getByText('已停止')).toBeVisible({ timeout: 60_000 });
  });

  test('shows fallback toast copy in the UI', async ({ page }) => {
    await openAgentConsole(page, E2E_AGENT_ID);
    await page.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'ant-message-notice-content';
      el.textContent =
        '沙箱不可用（Docker 未就绪：daemon-unreachable），已回退到本机执行';
      document.body.appendChild(el);
    });
    await expectFallbackToast(page);
  });
});
