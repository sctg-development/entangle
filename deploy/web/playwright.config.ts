// Copyright (c) 2026 Luca Martinetti (MIT License)
// Modifications and additions (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
// See the LICENSE file in the project root.
import { defineConfig } from '@playwright/test';

// The suite runs against the built app (`npm run build`, with public/wasm present: `make wasm`)
// served by the Rust server. Transfer tests also need a mailbox and relay, e.g. the
// compose stack in deploy/docker (mailbox :4000, relay :4001); they skip when it is down.
// To target an already running page set E2E_BASE_URL.
const external = process.env.E2E_BASE_URL;
const mailbox = process.env.E2E_MAILBOX ?? 'ws://127.0.0.1:4000/v1';
const relay = process.env.E2E_RELAY ?? '127.0.0.1:4001';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: external ?? 'http://127.0.0.1:8080' },
  webServer: external ? undefined : {
    command: 'cargo run --release --manifest-path crates/server/Cargo.toml -- --static-dir dist',
    port: 8080,
    reuseExistingServer: true,
    timeout: 300000,
    env: { MAILBOX_URL: mailbox, TRANSIT_RELAY: relay, TRANSIT_HINT: `tcp://${relay}` },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
