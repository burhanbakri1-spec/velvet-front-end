import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const RouterContext = createContext(null);

function readLocation() {
  return {
    pathname: window.location.pathname.replace(/\/+$/, '') || '/',
    search: window.location.search,
    hash: window.location.hash,
  };
}

export function getPathLocale(pathname) {
  return pathname.match(/^\/(ar|en)(?:\/|$)/)?.[1] || null;
}

export function stripLocalePrefix(pathname) {
  const stripped = pathname.replace(/^\/(ar|en)(?=\/|$)/, '');
  return stripped || '/';
}

export function localizePath(to, locale) {
  if (!to || to.startsWith('#') || /^(?:https?:|mailto:|tel:)/.test(to)) return to;
  const url = new URL(to, window.location.origin);
  if (getPathLocale(url.pathname)) return `${url.pathname}${url.search}${url.hash}`;
  const pathname = url.pathname === '/' ? `/${locale}` : `/${locale}${url.pathname}`;
  return `${pathname}${url.search}${url.hash}`;
}

export function RouterProvider({ children }) {
  const [location, setLocation] = useState(readLocation);
  const explicitLocale = getPathLocale(location.pathname);
  const rememberedLocale = (() => {
    try { return window.localStorage.getItem('play-language'); } catch { return null; }
  })();
  const locale = explicitLocale || (rememberedLocale === 'en' ? 'en' : 'ar');
  const routePath = stripLocalePrefix(location.pathname);

  useEffect(() => {
    const onPopState = () => setLocation(readLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    const next = new URL(to, window.location.origin);
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({}, '', `${next.pathname}${next.search}${next.hash}`);
    setLocation(readLocation());
    window.requestAnimationFrame(() => {
      if (next.hash) document.getElementById(next.hash.slice(1))?.scrollIntoView();
      else window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }, []);

  useEffect(() => {
    if (explicitLocale) {
      try { window.localStorage.setItem('play-language', explicitLocale); } catch { /* Storage may be unavailable. */ }
      return;
    }
    if (location.pathname === '/' && locale === 'ar') return;
    navigate(`${localizePath(location.pathname, locale)}${location.search}${location.hash}`, { replace: true });
  }, [explicitLocale, locale, location.hash, location.pathname, location.search, navigate]);

  const value = useMemo(() => ({ location, navigate, locale, routePath }), [location, navigate, locale, routePath]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const value = useContext(RouterContext);
  if (!value) throw new Error('useRouter must be used inside RouterProvider');
  return value;
}

export function Link({ to, onClick, children, ...props }) {
  const { navigate, locale } = useRouter();
  const href = localizePath(to, locale);
  const handleClick = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handleClick} {...props}>{children}</a>;
}
