import { createConnection } from 'net';

/** True when the mailbox the page was configured with accepts TCP connections. */
export function mailboxReachable(): Promise<boolean> {
  const url = new URL(process.env.E2E_MAILBOX ?? 'ws://127.0.0.1:4000/v1');
  return new Promise((resolve) => {
    const s = createConnection({ host: url.hostname, port: Number(url.port || 80) });
    s.setTimeout(1500);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(false));
    s.on('timeout', () => { s.destroy(); resolve(false); });
  });
}

export const T = (id: string) => `[data-testid=${id}]`;

export async function waitForWasm(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => (window as any).wasmClient?.ready === true, null, { timeout: 10000 });
}
