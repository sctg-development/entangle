// Copyright (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
// See the LICENSE file in the project root.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Input, Label, TextField } from '@heroui/react';
import { formatSize, loadWasmClient, type WasmClient } from '../lib/wasm';
import { TransferProgress, type Progress } from './TransferProgress';

interface Active extends Progress {
  name?: string;
  sizeLabel?: string;
  text?: string;
}

export function ReceivePanel(props: { onBusy: (busy: boolean) => void; initialCode?: string }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [active, setActive] = useState<Active | null>(null);
  const [copied, setCopied] = useState(false);
  const clientRef = useRef<WasmClient | null>(null);
  const autoStarted = useRef(false);
  const { onBusy } = props;

  const patch = useCallback((p: Partial<Active>) => setActive((a) => (a ? { ...a, ...p } : a)), []);

  const run = useCallback(async (raw: string) => {
    const value = raw.trim().toLowerCase().replace(/\s+/g, '');
    if (!value) return;
    const client = clientRef.current ?? (await loadWasmClient());
    clientRef.current = client;
    if (!client) return;
    client.cancelReceive(); // never leak a previous relay connection
    setCode(''); // single-use code: clear it immediately
    setActive({ status: 'establishing encrypted connection...', pct: 0 });
    onBusy(true);
    void client.receive(value, {
      onFileInfo: (name, size) => patch({ name, sizeLabel: formatSize(size) }),
      onStatus: (status) => patch({ status }),
      onProgress: (pct, speed, conn) => patch({ pct, info: speed ? speed + (conn ? ` · ${conn}` : '') : undefined }),
      onError: (error) => { onBusy(false); patch({ error }); },
      onComplete: () => { onBusy(false); patch({ done: true, pct: 100, status: 'complete', error: undefined }); },
      onText: (text) => patch({ text }),
    });
  }, [onBusy, patch]);

  // /receive/<code> deep link: start straight away, then show a clean URL.
  useEffect(() => {
    if (props.initialCode && !autoStarted.current) {
      autoStarted.current = true;
      history.replaceState(null, '', '/');
      void run(props.initialCode);
    }
  }, [props.initialCode, run]);

  const reset = () => {
    clientRef.current?.cancelReceive();
    onBusy(false);
    setActive(null);
    setCopied(false);
  };

  const copyText = async () => {
    if (!active?.text) return;
    try { await navigator.clipboard.writeText(active.text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* blocked */ }
  };
  const downloadText = () => {
    if (!active?.text) return;
    const url = URL.createObjectURL(new Blob([active.text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = active.name ?? 'message.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (active) {
    const finished = active.done || !!active.error;
    return (
      <Card className="dotted-frame" data-testid="receive-active">
        <Card.Content>
          {active.name && (
            <>
              <p className="font-neutra text-lg font-semibold" data-testid="receive-filename">{active.name}</p>
              <p className="text-sm text-muted" data-testid="receive-filesize">{active.sizeLabel}</p>
            </>
          )}
          {active.text !== undefined ? (
            <section className="dotted-frame-accent mt-3 p-3" data-testid="receive-text-panel" aria-label={t('receive.message')}>
              <h3 className="font-neutra text-sm font-semibold uppercase tracking-widest text-(--brand-soft)">{t('receive.message')}</h3>
              <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-secondary p-3 text-sm" data-testid="receive-text-content">{active.text}</pre>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" onPress={copyText}>{copied ? t('receive.copied') : t('receive.copyText')}</Button>
                <Button size="sm" variant="secondary" onPress={downloadText}>{t('receive.downloadText')}</Button>
              </div>
            </section>
          ) : null}
          <TransferProgress p={active} testId="receive-progress" />
          <Button className="mt-4 w-full" variant={finished ? 'primary' : 'outline'} onPress={reset} data-testid="receive-cancel">
            {finished ? t('receive.newTransfer') : t('receive.cancel')}
          </Button>
        </Card.Content>
      </Card>
    );
  }

  return (
    <form
      data-testid="receive-initial"
      onSubmit={(e) => { e.preventDefault(); void run(code); }}
      className="dotted-frame p-5"
    >
      <h2 className="font-neutra text-lg font-semibold">{t('receive.title')}</h2>
      <TextField fullWidth className="mt-3" name="code" value={code} onChange={setCode}>
        <Label>{t('receive.codeLabel')}</Label>
        <Input
          className="plain code"
          placeholder={t('receive.codePlaceholder')}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          data-testid="receive-code"
        />
      </TextField>
      <p className="mt-1 text-xs text-muted">{t('receive.codeHelp')}</p>
      <Button type="submit" variant="primary" className="mt-3" isDisabled={!code.trim()} data-testid="receive-btn">
        {t('receive.button')}
      </Button>
    </form>
  );
}
