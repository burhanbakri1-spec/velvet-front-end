/**
 * React hook: fires a GTM page_view event on every SPA route change.
 *
 * Usage inside RouteView:
 *   useEffect(() => { … }, [copy, routePath]);   ← sets document.title
 *   useGtmPageViews();                            ← pushes page_view AFTER title is set
 *
 * Media team: use this custom dataLayer `page_view` OR disable GA4 automatic
 * page_view — not both — or navigations will be double-counted.
 */

import { useEffect } from 'react';
import { useRouter } from '../routing/Router';
import { trackPageView } from './gtm';

/**
 * @param {Record<string, string | undefined>} [env]  – override for testing
 */
export function useGtmPageViews(env) {
  const { location } = useRouter();

  useEffect(() => {
    const fullPath = (location.pathname || '/') + (location.search || '');

    // Defer so RouteView's title-setting effect runs first in this commit.
    // StrictMode remount clears the timer once; the second mount schedules
    // again. Consecutive identical paths are deduped inside trackPageView.
    const timer = setTimeout(() => {
      trackPageView({ page_path: fullPath }, env);
    }, 0);

    return () => clearTimeout(timer);
  }, [location.pathname, location.search, env]);
}
