import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
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

  const switchLanguage = useCallback((nextLocale = locale === 'ar' ? 'en' : 'ar') => {
    try { window.localStorage.setItem('play-language', nextLocale); } catch { /* Storage may be unavailable. */ }
    // Preserve the exact current route (path + query + hash). Never bounce to home.
    const basePath = stripLocalePrefix(location.pathname);
    const nextPath = localizePath(basePath, nextLocale);
    navigate(`${nextPath}${location.search || ''}${location.hash || ''}`, { scroll: false });
  }, [locale, location.hash, location.pathname, location.search, navigate]);

  const value = useMemo(
    () => ({ locale, dir: locale === 'ar' ? 'rtl' : 'ltr', copy, switchLanguage }),
    [copy, locale, switchLanguage],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
