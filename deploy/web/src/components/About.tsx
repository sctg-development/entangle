// Copyright (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
// See the LICENSE file in the project root.

import { useTranslation } from 'react-i18next';
import { StarIcon } from './ui';

const APPS: Array<[string, string, string]> = [
  ['wormhole-rs', 'https://github.com/magic-wormhole/magic-wormhole.rs', 'Rust CLI'],
  ['magic-wormhole', 'https://magic-wormhole.readthedocs.io/', 'Python CLI'],
  ['wormhole-william', 'https://github.com/psanford/wormhole-william', 'Go CLI'],
  ['Wormhole File Transfer', 'https://apps.apple.com/app/wormhole-file-transfer/id6753897991', 'iOS'],
  ['Wormhole William', 'https://play.google.com/store/apps/details?id=io.sanford.wormhole_william', 'Android'],
  ['iyox Wormhole', 'https://github.com/iyox-studios/iyox-Wormhole', 'Android'],
];

export function About({ entangleUrl }: { entangleUrl: string }) {
  const { t } = useTranslation();
  return (
    <details className="dotted-frame mt-6 p-4" data-testid="about">
      <summary className="cursor-pointer font-neutra text-base font-semibold uppercase tracking-widest">
        {t('about.title')}
      </summary>
      <p className="mt-3 text-sm leading-relaxed">{t('about.p1')}</p>
      <p className="mt-2 text-sm leading-relaxed">{t('about.p2')}</p>
      <h3 className="mt-4 font-neutra text-sm font-semibold uppercase tracking-widest text-(--brand-soft)">{t('about.compatible')}</h3>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {APPS.map(([name, url, kind]) => (
          <li key={name}>
            <a className="underline decoration-dotted underline-offset-4 hover:decoration-solid" href={url} target="_blank" rel="noopener noreferrer">{name}</a>{' '}
            <span className="text-muted">({kind})</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm">
        <StarIcon className="mr-1 inline-block text-ambred-500" />
        <a id="entangle-link" data-testid="entangle-link" className="font-semibold underline decoration-dotted underline-offset-4 hover:decoration-solid" href={entangleUrl} target="_blank" rel="noopener noreferrer">
          {t('about.entangle')}
        </a>
      </p>
    </details>
  );
}
