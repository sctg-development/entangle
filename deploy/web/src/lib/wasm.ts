// Copyright (c) 2026 Luca Martinetti (MIT License)
// Modifications and additions (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
// See the LICENSE file in the project root.

/** Typed access to the transfer engine in /static/wasm-client.js (window.wasmClient). */

export interface SendCallbacks {
  onCode(code: string): void;
  onStatus(text: string): void;
  onProgress(pct: number, speed: string, connType?: string): void;
  onError(message: string): void;
  onComplete(): void;
}

export interface ReceiveCallbacks {
  onFileInfo(name: string, size: number): void;
  onStatus(text: string): void;
  onProgress(pct: number, speed: string, connType?: string): void;
  onError(message: string): void;
  onComplete(): void;
  onText?(text: string): void;
}

export interface WasmClient {
  readonly ready: boolean;
  send(files: File | File[], cb: SendCallbacks): Promise<void>;
  receive(code: string, cb: ReceiveCallbacks): Promise<void>;
  initWasm(): Promise<void>;
  cancelSend(): void;
  cancelReceive(): void;
  traverseEntries(items: DataTransferItemList): Promise<File[]>;
}

declare global {
  interface Window { wasmClient?: WasmClient; }
}

/** Resolves with the client once the WebAssembly module is loaded (or null if it failed). */
export async function loadWasmClient(): Promise<WasmClient | null> {
  for (let i = 0; i < 100 && !window.wasmClient; i++) await new Promise((r) => setTimeout(r, 50));
  const client = window.wasmClient;
  if (!client) return null;
  if (!client.ready) await client.initWasm();
  return client.ready ? client : null;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const SETTINGS_KEY = 'wormhole-settings';
export interface RelaySettings { mailboxUrl?: string; transitRelayUrl?: string }

export function readSettings(): RelaySettings {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as RelaySettings) : {};
  } catch { return {}; }
}

export function writeSettings(s: RelaySettings) {
  try {
    const clean: RelaySettings = {};
    if (s.mailboxUrl) clean.mailboxUrl = s.mailboxUrl;
    if (s.transitRelayUrl) clean.transitRelayUrl = s.transitRelayUrl;
    if (Object.keys(clean).length === 0) localStorage.removeItem(SETTINGS_KEY);
    else localStorage.setItem(SETTINGS_KEY, JSON.stringify(clean));
  } catch { /* ignore */ }
}

export function validateRelayUrl(raw: string): { ok: true; value: string } | { ok: false } {
  const value = raw.trim();
  if (!value) return { ok: true, value: '' };
  if (value.length > 2048) return { ok: false };
  try {
    const u = new URL(value);
    if ((u.protocol === 'ws:' || u.protocol === 'wss:') && u.hostname) return { ok: true, value };
  } catch { /* fall through */ }
  return { ok: false };
}

export const sameOriginWs = (path: string) =>
  (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + path;
