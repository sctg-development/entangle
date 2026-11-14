// Copyright (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
// See the LICENSE file in the project root.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Label, Modal, TextField } from '@heroui/react';
import { readSettings, sameOriginWs, validateRelayUrl, writeSettings } from '../lib/wasm';

export function SettingsModal(props: { isOpen: boolean; onClose: (changed: boolean) => void }) {
  const { t } = useTranslation();
  const [mailbox, setMailbox] = useState('');
  const [transit, setTransit] = useState('');
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (props.isOpen) {
      const s = readSettings();
      setMailbox(s.mailboxUrl ?? '');
      setTransit(s.transitRelayUrl ?? '');
      setInvalid(false);
    }
  }, [props.isOpen]);

  const save = () => {
    const m = validateRelayUrl(mailbox);
    const tr = validateRelayUrl(transit);
    if (!m.ok || !tr.ok) { setInvalid(true); return; }
    writeSettings({ mailboxUrl: m.value, transitRelayUrl: tr.value });
    props.onClose(true);
  };
  const reset = () => { writeSettings({}); props.onClose(true); };

  return (
    <Modal.Backdrop isOpen={props.isOpen} onOpenChange={(open) => { if (!open) props.onClose(false); }}>
      <Modal.Container>
        <Modal.Dialog data-testid="settings-modal">
          <Modal.Header>
            <Modal.Heading>{t('settings.title')}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <TextField fullWidth value={mailbox} onChange={setMailbox} isInvalid={invalid}>
              <Label>{t('settings.mailbox')}</Label>
              <Input placeholder={sameOriginWs('/v1')} inputMode="url" autoComplete="off" data-testid="settings-mailbox-url" />
            </TextField>
            <TextField fullWidth className="mt-3" value={transit} onChange={setTransit} isInvalid={invalid}>
              <Label>{t('settings.transit')}</Label>
              <Input placeholder={sameOriginWs('/transit')} inputMode="url" autoComplete="off" data-testid="settings-transit-url" />
            </TextField>
            {invalid && <p role="alert" className="mt-2 text-sm text-ambred-500" data-testid="settings-error">{t('settings.invalid')}</p>}
            <p className="mt-3 text-xs text-muted">{t('settings.hint')}</p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onPress={reset} data-testid="settings-reset">{t('settings.reset')}</Button>
            <Button variant="outline" onPress={() => props.onClose(false)} data-testid="settings-cancel">{t('settings.cancel')}</Button>
            <Button variant="primary" onPress={save} data-testid="settings-save">{t('settings.save')}</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
