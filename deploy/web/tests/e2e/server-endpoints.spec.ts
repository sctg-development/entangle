import { test, expect } from '@playwright/test';

test.describe('Server endpoints', () => {
  test('GET /health returns 200 with body "ok"', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);
    expect(await response.text()).toBe('ok');
  });

  test('unknown routes return 404', async ({ request }) => {
    const response = await request.get('/this-route-does-not-exist');
    expect(response.status()).toBe(404);
  });

  test('GET /sw.js returns JavaScript with no-cache header', async ({ request }) => {
    const response = await request.get('/sw.js');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/javascript');
    expect(response.headers()['cache-control']).toContain('no-cache');
  });
});

test.describe('GET /config.json', () => {
  test('exposes the self-hosted defaults', async ({ request }) => {
    const resp = await request.get('/config.json');
    expect(resp.status()).toBe(200);
    expect(resp.headers()['cache-control']).toBe('no-store');
    const cfg = await resp.json();
    expect(cfg.appId).toBe('github.com/sctg-development/entangle');
    expect(cfg.mailboxUrl).toBe('');
    expect(cfg.transitHint).toMatch(/^tcp:\/\/.+:4001$/);
    expect(cfg.entangleUrl).toContain('/releases/latest');
  });

  test('does not load third-party analytics', async ({ request }) => {
    const html = await (await request.get('/')).text();
    expect(html).not.toContain('umami');
    expect((await request.get('/a/script.js')).status()).toBe(404);
  });
});
