/**
 * React hook: fires a first-party platform pageview on every SPA route change
 * (Growth → Analytics → Behavior "Storefront funnel" visits + sessions).
 *
 * Usage inside RouteView, next to the GTM hook:
 *   useGtmPageViews();        // media team / GA4
 *   usePlatformPageViews();   // iGroup platform analytics
 *
 * Consecutive identical paths are deduped inside trackPlatformEvent, so
 * StrictMode remounts do not double-count.
 */

import { useEffect } from 'react';
import { useRouter } from '../routing/Router';
import { trackPlatformEvent } from './platformAnalytics';

export function usePlatformPageViews(env) {
  const { location } = useRouter();

  useEffect(() => {
    const fullPath = (location.pathname || '/') + (location.search || '');

    // Defer so RouteView's title-setting effect runs first in this commit.
    const timer = setTimeout(() => {
      trackPlatformEvent('pageview', { path: fullPath }, env);
    }, 0);

    return () => clearTimeout(timer);
  }, [location.pathname, location.search, env]);
}
