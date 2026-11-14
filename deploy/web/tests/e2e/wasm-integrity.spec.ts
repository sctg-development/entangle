import { test, expect } from '@playwright/test';
test.describe('WASM SRI integrity', () => {
  test('wasm binary hash matches meta[name="wasm-integrity"]', async ({ request }) => {
    // Get the expected hash from the HTML
    const html = await (await request.get('/')).text();
    const match = html.match(/<meta\s+name="wasm-integrity"\s+content="([^"]+)"/);
    const expectedHash = match?.[1];

    // In dev mode the placeholder is not a real hash — skip
    if (!expectedHash || !expectedHash.startsWith('sha384-')) {
      test.skip(true, 'SRI hashes not injected (dev mode)');
      return;
    }

    // Fetch the actual wasm binary and compute its hash
    const wasmResp = await request.get('/static/wasm/wormhole_wasm_bg.wasm');
    const wasmBytes = await wasmResp.body();
    const hashBuf = await crypto.subtle.digest('SHA-384', wasmBytes);
    const actualB64 = Buffer.from(hashBuf).toString('base64');
    const actualHash = `sha384-${actualB64}`;

    expect(actualHash).toBe(expectedHash);
  });

  test('wasm JS modulepreload integrity matches actual file', async ({ request }) => {
    // Get the expected hash from the HTML
    const html = await (await request.get('/')).text();
    const match = html.match(
      /<link\s+rel="modulepreload"\s+href="[^"]*wormhole_wasm\.js"\s+integrity="([^"]+)"/,
    );
    const expectedHash = match?.[1];

    if (!expectedHash || !expectedHash.startsWith('sha384-')) {
      test.skip(true, 'SRI hashes not injected (dev mode)');
      return;
    }

    // Fetch the actual JS file and compute its hash
    const jsResp = await request.get('/static/wasm/wormhole_wasm.js');
    const jsBytes = await jsResp.body();
    const hashBuf = await crypto.subtle.digest('SHA-384', jsBytes);
    const actualB64 = Buffer.from(hashBuf).toString('base64');
    const actualHash = `sha384-${actualB64}`;

    expect(actualHash).toBe(expectedHash);
  });

  test('WASM loads without integrity errors', async ({ page }) => {
    // Listen for console warnings about integrity
    const integrityErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning' && msg.text().includes('integrity check failed')) {
        integrityErrors.push(msg.text());
      }
    });

    await page.goto('/');

    // Wait for WASM to load — use the same check as wasm-init tests
    await page.waitForFunction(
      () => window['wasmClient']?.ready === true,
      null,
      { timeout: 10000 },
    );

    expect(integrityErrors).toEqual([]);
  });

  test('every script and stylesheet carries a matching SRI hash', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const tags = [...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="(\/static\/[^"]+)"[^>]*>/g)]
      .filter((m) => /<script|rel="(stylesheet|modulepreload)"/.test(m[0]));
    expect(tags.length).toBeGreaterThan(3);
    for (const [tag, url] of tags) {
      const integrity = tag.match(/integrity="(sha384-[^"]+)"/)?.[1];
      test.skip(!integrity && url.includes('wasm/'), 'wasm hashes not injected');
      expect(integrity, `${url} has no integrity`).toBeTruthy();
      const body = await (await request.get(url)).body();
      const actual = 'sha384-' + Buffer.from(await crypto.subtle.digest('SHA-384', body)).toString('base64');
      expect(actual, url).toBe(integrity);
    }
  });
});
