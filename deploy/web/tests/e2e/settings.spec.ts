import { test, expect } from '@playwright/test';
import { T } from './support';

test.describe('Server settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('wormhole-settings'));
    await page.reload();
    await page.locator(T('settings-toggle')).click();
  });

  test('opens a dialog with both fields', async ({ page }) => {
    await expect(page.locator(T('settings-modal'))).toBeVisible();
    await expect(page.locator(T('settings-mailbox-url'))).toBeVisible();
    await expect(page.locator(T('settings-transit-url'))).toBeVisible();
  });

  test('rejects a non-WebSocket URL', async ({ page }) => {
    await page.fill(T('settings-mailbox-url'), 'https://example.org');
    await page.locator(T('settings-save')).click();
    await expect(page.locator(T('settings-error'))).toBeVisible();
    await expect(page.locator(T('settings-modal'))).toBeVisible();
  });

  test('saves valid URLs, shows the indicator, and resets', async ({ page }) => {
    await page.fill(T('settings-mailbox-url'), 'wss://mailbox.example.org/v1');
    await page.fill(T('settings-transit-url'), 'wss://relay.example.org/transit');
    await page.locator(T('settings-save')).click();
    await expect(page.locator(T('settings-modal'))).toBeHidden();
    await expect(page.locator(T('settings-dot'))).toBeVisible();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('wormhole-settings')!));
    expect(stored).toEqual({ mailboxUrl: 'wss://mailbox.example.org/v1', transitRelayUrl: 'wss://relay.example.org/transit' });

    await page.locator(T('settings-toggle')).click();
    await page.locator(T('settings-reset')).click();
    await expect(page.locator(T('settings-dot'))).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('wormhole-settings'))).toBeNull();
  });

  test('cancel keeps the previous settings', async ({ page }) => {
    await page.fill(T('settings-mailbox-url'), 'wss://nope.example.org/v1');
    await page.locator(T('settings-cancel')).click();
    expect(await page.evaluate(() => localStorage.getItem('wormhole-settings'))).toBeNull();
  });
});
