import { test, expect } from '@playwright/test';
import { T, mailboxReachable, waitForWasm } from './support';

test.describe('Transfers (need a mailbox and a relay, see playwright.config.ts)', () => {
  test.beforeAll(async () => {
    test.skip(!(await mailboxReachable()), 'no mailbox reachable: start deploy/docker compose');
  });

  test('picking a file shows its name, size and a code with a QR', async ({ page }) => {
    await page.goto('/');
    await waitForWasm(page);
    const chooser = page.waitForEvent('filechooser');
    await page.locator(T('dropzone')).click();
    await (await chooser).setFiles({ name: 'my-document.pdf', mimeType: 'application/pdf', buffer: Buffer.from('a'.repeat(2048)) });
    await expect(page.locator(T('send-filename'))).toHaveText('my-document.pdf');
    await expect(page.locator(T('send-filesize'))).toHaveText('2.0 KB');
    await expect(page.locator(T('send-code'))).toHaveText(/^\d+(-[a-z]+)+$/, { timeout: 15000 });
    await expect(page.locator(T('send-link'))).toContainText('/receive/');
    await expect(page.locator('[data-testid=send-code-section] img')).toBeVisible();
    await page.locator(T('send-cancel')).click();
    await expect(page.locator(T('send-initial'))).toBeVisible();
  });

  test('text sent from one page is shown inline on another', async ({ browser }) => {
    const ctx = await browser.newContext();
    const a = await ctx.newPage();
    await a.goto('/');
    await waitForWasm(a);
    await a.locator(T('btn-text')).click();
    await a.fill(T('send-text-input'), 'héllo wormhole ✓');
    await a.locator(T('send-text-submit')).click();
    await expect(a.locator(T('send-code'))).toHaveText(/^\d+(-[a-z]+)+$/, { timeout: 15000 });
    const code = (await a.locator(T('send-code')).textContent())!;

    const b = await ctx.newPage();
    await b.goto('/');
    await waitForWasm(b);
    await b.locator(T('main-tab-receive')).click();
    await b.fill(T('receive-code'), code);
    await b.locator(T('receive-btn')).click();
    await expect(b.locator(T('receive-text-content'))).toHaveText('héllo wormhole ✓', { timeout: 30000 });
    await expect(b.locator(T('receive-progress-status'))).toContainText('✓');
    await expect(a.locator(T('send-progress-status'))).toContainText('✓', { timeout: 15000 });
    await ctx.close();
  });

  test('a /receive/<code> link starts the receive and cleans the URL', async ({ page }) => {
    await page.goto('/receive/7-test-link');
    await expect(page.locator(T('receive-active'))).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test('a wrong code reports an error and allows a new attempt', async ({ page }) => {
    await page.goto('/');
    await waitForWasm(page);
    await page.locator(T('main-tab-receive')).click();
    await page.fill(T('receive-code'), '999-no-such-code');
    await page.locator(T('receive-btn')).click();
    await expect(page.locator(T('receive-progress-status'))).toBeVisible();
    await page.locator(T('receive-cancel')).click();
    await expect(page.locator(T('receive-initial'))).toBeVisible();
  });
});
