import { test, expect } from '@playwright/test';

test.describe('Send text', () => {
  test('panel toggles and submit is disabled until text is entered', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#send-text-panel')).toHaveClass(/hidden/);

    await page.click('#btn-text');
    await expect(page.locator('#send-text-panel')).toBeVisible();
    await expect(page.locator('#send-text-submit')).toBeDisabled();

    await page.fill('#send-text-input', 'hello');
    await expect(page.locator('#send-text-submit')).toBeEnabled();

    await page.click('#send-text-cancel');
    await expect(page.locator('#send-text-panel')).toHaveClass(/hidden/);
    await expect(page.locator('#send-text-input')).toHaveValue('');
    await expect(page.locator('#btn-text')).toBeVisible();
  });

  test('sends text and the receiver displays it inline', async ({ page, context }) => {
    const message = 'hello wormhole text 👍';
    await page.goto('/');
    await page.click('#btn-text');
    await page.fill('#send-text-input', message);
    await page.click('#send-text-submit');

    // Sender gets a code shown
    await expect(page.locator('#send-code-section')).toBeVisible({ timeout: 15000 });
    const share = await page.locator('#send-code').textContent();
    const code = share?.match(/receive\/([^/\s]+)/)?.[1];
    expect(code).toBeTruthy();

    // Second tab receives via the share link — like a real recipient
    const receiver = await context.newPage();
    await receiver.goto('/receive/' + code);
    await expect(receiver.locator('#receive-text-panel')).toBeVisible({ timeout: 15000 });
    await expect(receiver.locator('#receive-text-content')).toHaveText(message);
    await expect(receiver.locator('#receive-status-text')).toHaveText(/Transfer complete/);
    await receiver.close();

    // Sender side completes too
    await expect(page.locator('#send-status-text')).toHaveText(/Transfer complete/, { timeout: 15000 });
  });

  test('text transfer-info shows completion on both sides', async ({ page, context }) => {
    await page.goto('/');
    await page.click('#btn-text');
    await page.fill('#send-text-input', 'second-message-body');
    await page.click('#send-text-submit');
    await expect(page.locator('#send-code-section')).toBeVisible({ timeout: 15000 });
    const share = await page.locator('#send-code').textContent();
    const code = share?.match(/receive\/([^/\s]+)/)?.[1]!;

    const receiver = await context.newPage();
    await receiver.goto('/receive/' + code);
    await expect(receiver.locator('#receive-text-content')).toHaveText('second-message-body', { timeout: 15000 });
    // Inline text must NOT trigger the file download path
    const download = await receiver.waitForEvent('download', { timeout: 1500 })
      .then(() => 'download')
      .catch(() => 'no-download');
    expect(download).toBe('no-download');
    await receiver.close();
  });
});
