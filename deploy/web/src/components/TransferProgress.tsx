// Copyright (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
// See the LICENSE file in the project root.

import { useTranslation } from 'react-i18next';
import { ProgressBar } from '@heroui/react';

export interface Progress {
  status: string;
  pct: number;
  info?: string;
  error?: string;
  done?: boolean;
}

/** Status line + progress bar shared by the send and receive panels. */
export function TransferProgress({ p, testId }: { p: Progress; testId: string }) {
  const { t } = useTranslation();
  const known = t(`status.${p.status}`, { defaultValue: '' });
  const text = p.error ?? (known || p.status);
  return (
    <div className="mt-3" data-testid={testId}>
      <p
        role={p.error ? 'alert' : 'status'}
        aria-live="polite"
        data-testid={`${testId}-status`}
        className={`font-neutra text-sm font-semibold ${p.error ? 'text-ambred-500' : p.done ? 'text-sctggreen dark:text-[#4fc06c]' : ''}`}
      >
        {p.done ? '✓ ' : ''}{text}
      </p>
      {!p.error && (
        <ProgressBar value={p.pct} aria-label={text} color={p.done ? 'success' : 'accent'} className="mt-2">
          <ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
        </ProgressBar>
      )}
      {p.info && <p className="mt-2 text-xs text-muted" data-testid={`${testId}-info`}>{p.info}</p>}
    </div>
  );
}
