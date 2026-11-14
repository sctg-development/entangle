import { test, expect } from '@playwright/test';
import { T, waitForWasm } from './support';

test.describe('WebAssembly client', () => {
  test('initialises and shows the encrypted badge', async ({ page }) => {
    await page.goto('/');
    await waitForWasm(page);
    await expect(page.locator(T('encryption-status'))).toContainText('End-to-end encrypted');
  });

  test('shows a warning when the WASM module is blocked', async ({ context, page }) => {
    await context.route('**/static/wasm/wormhole_wasm.js', (route) => route.abort());
    await page.goto('/');
    await expect(page.locator(T('encryption-status'))).toContainText(/WebAssembly/i, { timeout: 15000 });
  });
});
