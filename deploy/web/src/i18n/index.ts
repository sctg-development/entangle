// Copyright (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
// See the LICENSE file in the project root.

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from './locales/en-US.json';
import frFR from './locales/fr-FR.json';
import esES from './locales/es-ES.json';
import ptPT from './locales/pt-PT.json';
import itIT from './locales/it-IT.json';

export const LANGUAGES = [
  { code: 'en-US', label: 'English', short: 'EN' },
  { code: 'fr-FR', label: 'Français', short: 'FR' },
  { code: 'es-ES', label: 'Español', short: 'ES' },
  { code: 'pt-PT', label: 'Português', short: 'PT' },
  { code: 'it-IT', label: 'Italiano', short: 'IT' },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const STORAGE_KEY = 'lang';

/** Saved choice, else the first browser language we support, else English. */
export function detectLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.some((l) => l.code === saved)) return saved as LanguageCode;
  } catch { /* storage unavailable */ }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split('-')[0];
    const hit = LANGUAGES.find((l) => l.code.toLowerCase().startsWith(base + '-'));
    if (hit) return hit.code;
  }
  return 'en-US';
}

export function setLanguage(code: LanguageCode) {
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
  void i18n.changeLanguage(code);
}

void i18n.use(initReactI18next).init({
  resources: {
    'en-US': { translation: enUS },
    'fr-FR': { translation: frFR },
    'es-ES': { translation: esES },
    'pt-PT': { translation: ptPT },
    'it-IT': { translation: itIT },
  },
  lng: detectLanguage(),
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => { document.documentElement.lang = lng; });
document.documentElement.lang = i18n.language;

export default i18n;
