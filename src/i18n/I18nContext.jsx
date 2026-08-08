import { createContext, useContext, useEffect, useMemo } from 'react';
import { translations } from './translations';
import { localizePath, stripLocalePrefix, useRouter } from '../routing/Router';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const { locale, location, navigate } = useRouter();
  const copy = translations[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset.locale = locale;
    document.querySelector('meta[name="description"]')?.setAttribute('content', copy.meta.description);
  }, [copy.meta.description, locale]);

  const switchLanguage = (nextLocale = locale === 'ar' ? 'en' : 'ar') => {
    window.localStorage.setItem('play-language', nextLocale);
    const basePath = stripLocalePrefix(location.pathname);
    navigate(`${localizePath(basePath, nextLocale)}${location.search}${location.hash}`);
  };

  const value = useMemo(() => ({ locale, dir: locale === 'ar' ? 'rtl' : 'ltr', copy, switchLanguage }), [copy, locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
