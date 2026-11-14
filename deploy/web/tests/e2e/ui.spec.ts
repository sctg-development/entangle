import { test, expect } from '@playwright/test';
import { T, waitForWasm } from './support';

const LANGS: Array<[string, string, string]> = [
  ['en-US', 'Send', 'Receive'],
  ['fr-FR', 'Envoyer', 'Recevoir'],
  ['es-ES', 'Enviar', 'Recibir'],
  ['pt-PT', 'Enviar', 'Receber'],
  ['it-IT', 'Invia', 'Ricevi'],
];

test.describe('Page', () => {
  test('loads with title, SCTG logo, tabs and encryption badge', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('SCTG Wormhole');
    await expect(page.locator('h1')).toHaveText(/wormhole/i);
    await expect(page.locator('img[alt="SCTG"]')).toBeVisible();
    await expect(page.locator(T('main-tab-send'))).toBeVisible();
    await expect(page.locator(T('main-tab-receive'))).toBeVisible();
    await waitForWasm(page);
    await expect(page.locator(T('encryption-status'))).toContainText('End-to-end encrypted');
  });

  test('has no third-party requests', async ({ page, baseURL }) => {
    const hosts = new Set<string>();
    page.on('request', (r) => { const u = new URL(r.url()); if (u.protocol.startsWith('http')) hosts.add(u.host); });
    await page.goto('/');
    await waitForWasm(page);
    expect([...hosts]).toEqual([new URL(baseURL!).host]);
  });

  test('uses the Neutraface Text font', async ({ page }) => {
    await page.goto('/');
    await waitForWasm(page);
    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
    expect(loaded.join()).toContain('Neutraface Text');
  });

  test('send tab: dropzone is keyboard reachable, receive tab shows the code form', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(T('dropzone'))).toHaveAttribute('role', 'button');
    await page.locator(T('main-tab-receive')).click();
    await expect(page.locator(T('receive-code'))).toBeVisible();
    await expect(page.locator(T('receive-btn'))).toBeDisabled();
    await page.fill(T('receive-code'), '7-test-code');
    await expect(page.locator(T('receive-btn'))).toBeEnabled();
  });

  test('about section links to the latest entangle release', async ({ page }) => {
    await page.goto('/');
    await page.locator('summary').first().click();
    await expect(page.locator(T('entangle-link'))).toHaveAttribute('href', /entangle\/releases\/latest$/);
  });

  test('mobile viewport (375px): no horizontal scroll, controls visible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    await waitForWasm(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator(T('dropzone'))).toBeVisible();
    await expect(page.locator(T('theme-toggle'))).toBeVisible();
  });
});

test.describe('Languages', () => {
  for (const [code, send, receive] of LANGS) {
    test(`${code}: tabs are translated and <html lang> follows`, async ({ browser }) => {
      const ctx = await browser.newContext({ locale: code });
      const page = await ctx.newPage();
      await page.goto('/');
      await expect(page.locator(T('main-tab-send'))).toContainText(send);
      await expect(page.locator(T('main-tab-receive'))).toContainText(receive);
      await expect(page.locator('html')).toHaveAttribute('lang', code);
      await ctx.close();
    });
  }

  test('unsupported browser language falls back to English', async ({ browser }) => {
    const ctx = await browser.newContext({ locale: 'de-DE' });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator(T('main-tab-send'))).toContainText('Send');
    await ctx.close();
  });

  test('manual choice wins over the browser and persists across reloads', async ({ page }) => {
    await page.goto('/');
    await page.locator(T('language-button')).click();
    await page.locator(T('lang-it-IT')).click();
    await expect(page.locator(T('main-tab-send'))).toContainText('Invia');
    await page.reload();
    await expect(page.locator(T('main-tab-send'))).toContainText('Invia');
    await expect(page.locator('html')).toHaveAttribute('lang', 'it-IT');
  });
});

test.describe('Theme', () => {
  test('toggle switches dark mode and persists', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.locator(T('theme-toggle')).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('follows the system colour scheme by default', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
