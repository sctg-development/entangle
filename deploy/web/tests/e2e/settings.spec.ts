import { test, expect } from '@playwright/test';

test.describe('Settings modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('wormhole-settings'));
    await page.reload();
  });

  test('gear button opens the dialog, ESC closes it', async ({ page }) => {
    await page.click('#settings-toggle');
    await expect(page.locator('#settings-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings-overlay')).toHaveClass(/hidden/);
  });

  test('cancel closes without saving', async ({ page }) => {
    await page.click('#settings-toggle');
    await page.fill('#settings-mailbox-url', 'wss://mailbox.example.com/v1');
    await page.click('#settings-cancel');
    await expect(page.locator('#settings-overlay')).toHaveClass(/hidden/);
    expect(await page.evaluate(() => localStorage.getItem('wormhole-settings'))).toBeNull();
  });

  test('rejects non-ws(s) URLs and does not persist', async ({ page }) => {
    await page.click('#settings-toggle');
    await page.fill('#settings-mailbox-url', 'https://mailbox.example.com/v1');
    await page.click('#settings-save');
    await expect(page.locator('#settings-error')).toBeVisible();
    await expect(page.locator('#settings-modal')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('wormhole-settings'))).toBeNull();
  });

  test('rejects malformed URLs', async ({ page }) => {
    await page.click('#settings-toggle');
    await page.fill('#settings-transit-url', 'not a url');
    await page.click('#settings-save');
    await expect(page.locator('#settings-error')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('wormhole-settings'))).toBeNull();
  });

  test('saves custom relays, shows dot, persists across reload', async ({ page }) => {
    await page.click('#settings-toggle');
    await page.fill('#settings-mailbox-url', 'wss://mailbox.example.com/v1');
    await page.fill('#settings-transit-url', 'wss://transit.example.com/transit');
    await page.click('#settings-save');
    await expect(page.locator('#settings-overlay')).toHaveClass(/hidden/);

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('wormhole-settings')!));
    expect(stored).toEqual({
      mailboxUrl: 'wss://mailbox.example.com/v1',
      transitRelayUrl: 'wss://transit.example.com/transit',
    });
    await expect(page.locator('#settings-dot')).toBeVisible();

    await page.reload();
    await expect(page.locator('#settings-dot')).toBeVisible();
    await page.click('#settings-toggle');
    await expect(page.locator('#settings-mailbox-url')).toHaveValue('wss://mailbox.example.com/v1');
    await expect(page.locator('#settings-transit-url')).toHaveValue('wss://transit.example.com/transit');
  });

  test('ws:// scheme is accepted', async ({ page }) => {
    await page.click('#settings-toggle');
    await page.fill('#settings-transit-url', 'ws://relay.lan:4001/transit');
    await page.click('#settings-save');
    await expect(page.locator('#settings-error')).toBeHidden();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('wormhole-settings')!));
    expect(stored.transitRelayUrl).toBe('ws://relay.lan:4001/transit');
  });

  test('reset to defaults clears stored settings and hides dot', async ({ page }) => {
    await page.evaluate(() =>
      localStorage.setItem('wormhole-settings', JSON.stringify({ mailboxUrl: 'wss://mailbox.example.com/v1' })),
    );
    await page.reload();
    await page.click('#settings-toggle');
    await expect(page.locator('#settings-mailbox-url')).toHaveValue('wss://mailbox.example.com/v1');
    await page.click('#settings-reset');
    await expect(page.locator('#settings-mailbox-url')).toHaveValue('');
    expect(await page.evaluate(() => localStorage.getItem('wormhole-settings'))).toBeNull();
    await expect(page.locator('#settings-dot')).toBeHidden();
  });
});
