import { expect, test } from '@playwright/test';

test('public health and homepage are reachable', async ({ page, request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);

  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
});

test('admin login rejects bad password', async ({ request }) => {
  const response = await request.post('/api/login', {
    data: { password: 'definitely-wrong-password' }
  });
  expect(response.status()).toBe(401);
});
