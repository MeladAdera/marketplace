// src/config/i18n.config.ts
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import middleware from 'i18next-http-middleware';
import path from 'path';

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    backend: {
      loadPath: path.join(__dirname, '../../locales/{{lng}}/{{ns}}.json'),
    },
    fallbackLng: 'en',
    preload: ['ar', 'en', 'es'],
    ns: ['common', 'errors', 'auth', 'product', 'vendor'], 
    defaultNS: 'errors',
    interpolation: {
      escapeValue: false,
    },
    debug: process.env.NODE_ENV === 'development', 
  });

export const i18nReady = new Promise<void>((resolve) => {
  if (i18next.isInitialized) {
    resolve();
  } else {
    i18next.on('initialized', () => resolve());
  }
});

export default i18next;