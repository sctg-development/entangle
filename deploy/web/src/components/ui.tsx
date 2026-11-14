// Copyright (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
// See the LICENSE file in the project root.

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function StarIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 0l2.4 9.6L24 12l-9.6 2.4L12 24l-2.4-9.6L0 12l9.6-2.4z" />
    </svg>
  );
}

export function DottedRule() {
  return <hr className="my-4 border-0 border-t-2 border-dotted border-(--brand)" />;
}

/** QR code for a string, drawn as a PNG data URL (allowed by the CSP: img-src data:). */
export function QrCode({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { margin: 1, width: 240, errorCorrectionLevel: 'M', color: { dark: '#1e3280', light: '#ffffff' } })
      .then((url) => { if (alive) setSrc(url); })
      .catch(() => { if (alive) setSrc(''); });
    return () => { alive = false; };
  }, [value]);
  if (!src) return <div className="size-60" aria-hidden="true" />;
  return <img src={src} alt={label} width={240} height={240} className="rounded-lg bg-white p-2" />;
}
