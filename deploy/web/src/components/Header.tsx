// Copyright (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
// See the LICENSE file in the project root.

import { useTranslation } from 'react-i18next';
import { Button, Dropdown } from '@heroui/react';
import { LANGUAGES, setLanguage, type LanguageCode } from '../i18n';
import { StarIcon, DottedRule } from './ui';

const Sun = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const Moon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);
const Gear = ({ dot }: { dot: boolean }) => (
  <span className="relative inline-flex">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
    {dot && <span className="absolute -top-1 -right-1 size-2 rounded-full bg-ambred-500" data-testid="settings-dot" />}
  </span>
);

export function Header(props: { dark: boolean; onToggleTheme: () => void; onOpenSettings: () => void; customRelays: boolean }) {
  const { t, i18n } = useTranslation();
  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];
  return (
    <header>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-neutra text-2xl font-bold tracking-widest text-(--brand) sm:text-3xl">
            <span className="text-sctgviolet dark:text-[#b57fd3]">S</span>
            <span className="text-sctgorange">C</span>
            <span className="text-sctgrose">T</span>
            <span className="text-sctggreen dark:text-[#4fc06c]">G</span>{' '}
            {t('app.company').replace(/^SCTG\s*/, '')}
          </p>
          <h1 className="font-neutra text-2xl font-semibold uppercase italic text-(--brand-soft) sm:text-3xl">
            {t('app.product')}
          </h1>
        </div>
        <img src="/static/logo-sctg.svg" alt="SCTG" className="size-24 shrink-0 sm:size-32" width={128} height={128} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 className="font-neutra text-base font-bold uppercase tracking-widest sm:text-lg">
            <StarIcon className="mr-1 inline-block text-ambred-500" />
            {t('app.tagline')}
          </h2>
          <p className="font-neutra text-base font-semibold uppercase italic tracking-widest text-ambgrey-200 sm:text-lg">
            {t('app.tagline2')}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Dropdown>
            <Button variant="ghost" size="sm" aria-label={t('app.language')} data-testid="language-button">
              {current.short}
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label={t('app.language')} onAction={(key) => setLanguage(String(key) as LanguageCode)}>
                {LANGUAGES.map((l) => (
                  <Dropdown.Item key={l.code} id={l.code} textValue={l.label} data-testid={`lang-${l.code}`}>
                    {l.label}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          <Button isIconOnly variant="ghost" size="sm" onPress={props.onToggleTheme} aria-label={t('app.theme')} data-testid="theme-toggle">
            {props.dark ? <Sun /> : <Moon />}
          </Button>
          <Button isIconOnly variant="ghost" size="sm" onPress={props.onOpenSettings} aria-label={t('app.settings')} data-testid="settings-toggle">
            <Gear dot={props.customRelays} />
          </Button>
        </div>
      </div>
      <DottedRule />
    </header>
  );
}
