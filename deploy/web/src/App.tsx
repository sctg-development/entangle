// Copyright (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
// See the LICENSE file in the project root.

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs } from '@heroui/react';
import { Header } from './components/Header';
import { SendPanel } from './components/SendPanel';
import { ReceivePanel } from './components/ReceivePanel';
import { SettingsModal } from './components/SettingsModal';
import { About } from './components/About';
import { Footer } from './components/Footer';
import { loadWasmClient, readSettings } from './lib/wasm';
import { useTheme } from './lib/theme';

const DEFAULT_ENTANGLE_URL = 'https://github.com/sctg-development/entangle/releases/latest';

function deepLinkCode(): string | undefined {
  const m = location.pathname.match(/^\/receive\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

export function App() {
  const { t } = useTranslation();
  const [theme, toggleTheme] = useTheme();
  const [initialCode] = useState(deepLinkCode);
  const [tab, setTab] = useState<string>(initialCode ? 'receive' : 'send');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [custom, setCustom] = useState(() => Object.keys(readSettings()).length > 0);
  const [wasmOk, setWasmOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [entangleUrl, setEntangleUrl] = useState(DEFAULT_ENTANGLE_URL);

  useEffect(() => {
    void loadWasmClient().then((c) => setWasmOk(!!c));
    fetch('/config.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { entangleUrl?: string } | null) => {
        if (c && typeof c.entangleUrl === 'string' && /^https?:\/\//.test(c.entangleUrl)) setEntangleUrl(c.entangleUrl);
      })
      .catch(() => undefined);
  }, []);

  // Closing the tab mid-transfer would abort it: ask first.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  const onBusy = useCallback((b: boolean) => setBusy(b), []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-12">
      <Header
        dark={theme === 'dark'}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
        customRelays={custom}
      />
      <p
        id="encryption-status"
        data-testid="encryption-status"
        className={`mb-4 inline-block rounded-lg px-3 py-1 font-neutra text-sm font-semibold ${wasmOk === false ? 'bg-ambred-500/15 text-ambred-500' : 'bg-ambblue-100/15 text-(--brand)'}`}
      >
        {wasmOk === false ? t('badge.noWasm') : `🔒 ${t('badge.encrypted')}`}
      </p>
      <main>
        <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
          <Tabs.ListContainer>
            <Tabs.List aria-label={t('app.product')}>
              <Tabs.Tab id="send" data-testid="main-tab-send">{t('tabs.send')}<Tabs.Indicator /></Tabs.Tab>
              <Tabs.Tab id="receive" data-testid="main-tab-receive">{t('tabs.receive')}<Tabs.Indicator /></Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          {/* keepMounted: switching tabs must not drop a running transfer */}
          <Tabs.Panel id="send" className="pt-4" shouldForceMount>
            <div hidden={tab !== 'send'}><SendPanel onBusy={onBusy} /></div>
          </Tabs.Panel>
          <Tabs.Panel id="receive" className="pt-4" shouldForceMount>
            <div hidden={tab !== 'receive'}><ReceivePanel onBusy={onBusy} initialCode={initialCode} /></div>
          </Tabs.Panel>
        </Tabs>
      </main>
      <About entangleUrl={entangleUrl} />
      <Footer entangleUrl={entangleUrl} />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={(changed) => { setSettingsOpen(false); if (changed) setCustom(Object.keys(readSettings()).length > 0); }}
      />
    </div>
  );
}
