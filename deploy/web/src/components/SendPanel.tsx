// Copyright (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
// See the LICENSE file in the project root.

import { useCallback, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, TextArea } from '@heroui/react';
import { formatSize, loadWasmClient, type WasmClient } from '../lib/wasm';
import { QrCode, StarIcon } from './ui';
import { TransferProgress, type Progress } from './TransferProgress';

interface Active extends Progress {
  name: string;
  sizeLabel: string;
  code?: string;
}

export function SendPanel({ onBusy }: { onBusy: (busy: boolean) => void }) {
  const { t } = useTranslation();
  const [active, setActive] = useState<Active | null>(null);
  const [textMode, setTextMode] = useState(false);
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [qrWeb, setQrWeb] = useState(true);
  const [copied, setCopied] = useState(false);
  const clientRef = useRef<WasmClient | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadWasmClient().then((c) => { clientRef.current = c; });
  }, []);

  const patch = useCallback((p: Partial<Active>) => setActive((a) => (a ? { ...a, ...p } : a)), []);

  const start = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const client = clientRef.current ?? (await loadWasmClient());
    clientRef.current = client;
    if (!client) return;
    const total = files.reduce((s, f) => s + f.size, 0);
    setActive({
      name: files.length > 1 ? t('send.filesTotal', { count: files.length, size: formatSize(total) }) : files[0].name,
      sizeLabel: files.length > 1 ? t('send.zipNote') : formatSize(files[0].size),
      status: 'allocating code...',
      pct: 0,
    });
    onBusy(true);
    void client.send(files.length > 1 ? files : files[0], {
      onCode: (code) => patch({ code }),
      onStatus: (status) => patch({ status }),
      onProgress: (pct, speed, conn) => patch({ pct, info: speed ? speed + (conn ? ` · ${conn}` : '') : undefined }),
      onError: (error) => { onBusy(false); patch({ error, code: undefined }); },
      onComplete: () => { onBusy(false); patch({ done: true, pct: 100, status: 'complete', code: undefined, error: undefined }); },
    });
  }, [onBusy, patch, t]);

  const reset = () => {
    clientRef.current?.cancelSend();
    onBusy(false);
    setActive(null);
    setTextMode(false);
    setText('');
    setCopied(false);
    if (fileInput.current) fileInput.current.value = '';
    if (folderInput.current) folderInput.current.value = '';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const client = clientRef.current;
    const items = e.dataTransfer.items;
    if (client && items && items.length > 0) void client.traverseEntries(items).then((f) => start(f));
    else void start(Array.from(e.dataTransfer.files));
  };
  const onZoneKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.current?.click(); }
  };

  const link = active?.code ? `${location.origin}/receive/${active.code}` : '';
  const copy = async () => {
    if (!active?.code) return;
    try { await navigator.clipboard.writeText(active.code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  const share = () => {
    if (!active?.code) return;
    void navigator.share?.({ title: t('app.product'), text: active.code, url: link }).catch(() => undefined);
  };

  if (active) {
    const finished = active.done || !!active.error;
    return (
      <Card className="dotted-frame" data-testid="send-active">
        <Card.Content>
          <p className="font-neutra text-lg font-semibold" data-testid="send-filename">{active.name}</p>
          <p className="text-sm text-muted" data-testid="send-filesize">{active.sizeLabel}</p>
          <TransferProgress p={active} testId="send-progress" />
          {active.code && (
            <section className="dotted-frame-accent mt-4 p-4" aria-labelledby="send-code-title" data-testid="send-code-section">
              <h3 id="send-code-title" className="font-neutra text-sm font-semibold uppercase tracking-widest text-(--brand-soft)">{t('send.codeTitle')}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <output className="code select-all rounded-lg bg-surface-secondary px-3 py-2 text-xl font-semibold" data-testid="send-code">{active.code}</output>
                <Button variant="secondary" size="sm" onPress={copy} data-testid="send-copy">{copied ? t('send.copied') : t('send.copy')}</Button>
                {typeof navigator.share === 'function' && <Button variant="secondary" size="sm" onPress={share}>{t('send.share')}</Button>}
              </div>
              <p className="mt-2 text-xs text-muted">{t('send.codeHelp')}</p>
              <p className="mt-1 break-all text-xs text-muted" data-testid="send-link">{link}</p>
              <div className="mt-3 flex gap-2" role="group" aria-label="QR">
                <Button size="sm" variant={qrWeb ? 'primary' : 'outline'} onPress={() => setQrWeb(true)}>{t('send.qrLink')}</Button>
                <Button size="sm" variant={qrWeb ? 'outline' : 'primary'} onPress={() => setQrWeb(false)}>{t('send.qrWormhole')}</Button>
              </div>
              <div className="mt-3"><QrCode value={qrWeb ? link : `wormhole-transfer:${active.code}`} label={t('send.codeTitle')} /></div>
            </section>
          )}
          {!finished && <p className="mt-3 text-xs text-muted">{t('send.keepOpen')}</p>}
          <Button className="mt-4 w-full" variant={finished ? 'primary' : 'outline'} onPress={reset} data-testid="send-cancel">
            {finished ? t('send.newTransfer') : t('send.cancel')}
          </Button>
        </Card.Content>
      </Card>
    );
  }

  return (
    <div data-testid="send-initial">
      <div
        role="button"
        tabIndex={0}
        aria-label={t('send.dropTitle')}
        data-testid="dropzone"
        onClick={() => fileInput.current?.click()}
        onKeyDown={onZoneKey}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`dotted-frame cursor-pointer px-6 py-12 text-center transition-colors hover:bg-surface-secondary ${dragging ? 'dropzone-active' : ''}`}
      >
        <StarIcon className="mx-auto mb-2 size-6 text-ambred-500" />
        <p className="font-neutra text-lg font-semibold">{t('send.dropTitle')}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">{t('send.dropHint')}</p>
      </div>
      <input ref={fileInput} type="file" multiple hidden data-testid="file-input" onChange={(e) => void start(Array.from(e.target.files ?? []))} />
      <input
        ref={folderInput}
        type="file"
        hidden
        data-testid="folder-input"
        {...({ webkitdirectory: '' } as Record<string, string>)}
        onChange={(e) => void start(Array.from(e.target.files ?? []))}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onPress={() => fileInput.current?.click()}>{t('send.files')}</Button>
        <Button variant="outline" size="sm" onPress={() => folderInput.current?.click()} data-testid="btn-folder">{t('send.folder')}</Button>
        <Button variant="outline" size="sm" onPress={() => setTextMode((v) => !v)} aria-expanded={textMode} data-testid="btn-text">{t('send.text')}</Button>
      </div>
      {textMode && (
        <div className="mt-3" data-testid="send-text-panel">
          <TextArea
            fullWidth
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('send.textPlaceholder')}
            aria-label={t('send.textPlaceholder')}
            maxLength={512 * 1024}
            data-testid="send-text-input"
          />
          <p className="mt-1 text-xs text-muted">{t('send.textHint')}</p>
          <div className="mt-2 flex gap-2">
            <Button variant="primary" isDisabled={!text.trim()} onPress={() => void start([new File([text], 'message.txt', { type: 'text/plain' })])} data-testid="send-text-submit">
              {t('send.submitText')}
            </Button>
            <Button variant="outline" onPress={() => { setTextMode(false); setText(''); }}>{t('send.cancel')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
