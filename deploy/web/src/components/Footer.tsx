// Copyright (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
// See the LICENSE file in the project root.

import { useTranslation } from 'react-i18next';

/** KiiK-style offset coloured frames. */
export function Footer({ entangleUrl }: { entangleUrl: string }) {
  const { t } = useTranslation();
  return (
    <footer className="mt-8 flex flex-wrap items-start justify-between gap-4">
      <div className="border-r-6 border-b-6 border-ambblue-100 px-4 py-1">
        <a href={entangleUrl} target="_blank" rel="noopener noreferrer" className="font-neutra text-sm font-semibold text-ambblue-100 dark:text-ambblue-50">
          {t('about.entangleShort')}
        </a>
        <p className="sc max-w-xs text-xxs leading-tight tracking-wide text-ambgrey-200">
          <a href="https://github.com/sctg-development/entangle/tree/main/deploy/web" target="_blank" rel="noopener noreferrer">{t('footer.source')}</a>
        </p>
      </div>
      <div className="border-l-6 border-b-6 border-ambblue-100 px-4 py-1 sm:text-right">
        <p className="font-neutra text-sm font-semibold text-ambblue-100 dark:text-ambblue-50">{t('footer.rights')}</p>
        <p className="sc max-w-xs text-xxs leading-tight tracking-wide text-ambgrey-200">
          {t('footer.basedOn')}{' '}
          <a href="https://github.com/lucamartinetti/wormhole-page" target="_blank" rel="noopener noreferrer" className="underline">wormhole-page</a>
        </p>
      </div>
    </footer>
  );
}
