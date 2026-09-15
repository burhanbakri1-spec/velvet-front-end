/**
 * Google Tag Manager helpers.
 *
 * Pure functions that never throw.  GTM is configured via the VITE_GTM_ID
 * environment variable only.  No GA4 / Clarity / Meta scripts are injected
 * here – those live inside the GTM container once the ID is supplied.
 *
 * Noscript: the real no-JS <noscript> iframe is injected at build/dev time by
 * vite.config.js (see gtmNoscript.js). Do not recreate it from JavaScript —
 * a runtime-created <noscript> is not a no-JS fallback.
 *
 * Page-view duplication (media team):
 * This app pushes a custom dataLayer event `page_view` on initial load and SPA
 * navigations. GTM/GA4 must not also emit automatic page_view/page_path hits for
 * the same navigations. Configure GTM/GA4 to use this custom `page_view` event
 * OR disable GA4 enhanced/automatic page measurement if it would duplicate.
 */

/* ------------------------------------------------------------------ */
/*  Env readers                                                        */
/* ------------------------------------------------------------------ */

/** @param {Record<string, string | undefined>} [env] */
export function readGtmId(env) {
  // Treat omitted/undefined env as Vite import.meta.env (explicit undefined
  // must not disable the default the way `env = import.meta.env` would).
  const source = env ?? import.meta.env;
  const raw = source?.VITE_GTM_ID;
  return typeof raw === 'string' ? raw.trim() : '';
}

/** @param {Record<string, string | undefined>} [env] */
export function isGtmEnabled(env) {
  return readGtmId(env).length > 0;
}

/* ------------------------------------------------------------------ */
/*  DataLayer                                                          */
/* ------------------------------------------------------------------ */

export function ensureDataLayer() {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
  }
  return typeof window !== 'undefined' ? window.dataLayer : [];
}

/**
 * Push an event onto the data layer.
 * Returns `true` when the push actually happened, `false` when GTM is
 * disabled (no env var).
 *
 * @param {string} eventName
 * @param {object} [payload]
 * @param {Record<string, string | undefined>} [env]
 * @returns {boolean}
 */
export function pushDataLayer(eventName, payload = {}, env) {
  if (!isGtmEnabled(env)) return false;
  ensureDataLayer();
  window.dataLayer.push({ event: eventName, ...payload });
  return true;
}

/* ------------------------------------------------------------------ */
/*  Page view tracking                                                 */
/* ------------------------------------------------------------------ */

/** @type {string|null}  last path we pushed – used for deduplication */
let _lastPagePath = null;

/** Reset module-level dedup state (useful in tests). */
export function _resetPageViewDedupe() {
  _lastPagePath = null;
}

/**
 * Push a page_view event.
 *
 * Consecutive calls with the same `page_path` are de-duped so that
 * React StrictMode double-effects and repeat useEffect runs do not
 * double-fire.  A different `page_path` will always fire.
 *
 * @param {object} [overrides]
 * @param {string} [overrides.page_path]
 * @param {string} [overrides.page_location]
 * @param {string} [overrides.page_title]
 * @param {Record<string, string | undefined>} [env]
 * @returns {boolean}
 */
export function trackPageView(overrides = {}, env) {
  if (!isGtmEnabled(env)) return false;

  const pagePath =
    overrides.page_path ||
    (typeof window !== 'undefined'
      ? window.location.pathname + window.location.search
      : '/');

  // Dedupe: skip if this exact path was the last one pushed.
  if (_lastPagePath === pagePath) return false;
  _lastPagePath = pagePath;

  const payload = {
    page_path: pagePath,
    page_location:
      overrides.page_location ||
      (typeof window !== 'undefined' ? window.location.href : ''),
    page_title:
      overrides.page_title ||
      (typeof document !== 'undefined' ? document.title : ''),
  };

  return pushDataLayer('page_view', payload, env);
}

/* ------------------------------------------------------------------ */
/*  GTM initialisation                                                 */
/* ------------------------------------------------------------------ */

/** @type {boolean}  guard so we inject <script> only once */
let _gtmInitialised = false;

/** Reset init guard (useful in tests). */
export function _resetInitGuard() {
  _gtmInitialised = false;
  _lastPagePath = null;
}

/**
 * Bootstrap GTM: push the standard gtm.start object and inject the
 * container <script> once when VITE_GTM_ID is set.
 *
 * The noscript iframe is NOT injected here — Vite adds it statically when
 * the ID exists (gtmNoscript.js / vite.config.js).
 *
 * Safe to call multiple times – subsequent calls are no-ops.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {boolean} true when init happened, false when disabled or already done
 */
export function initGtm(env) {
  if (_gtmInitialised) return false;
  if (!isGtmEnabled(env)) return false;

  const id = readGtmId(env);
  if (!id) return false;

  ensureDataLayer();
  _gtmInitialised = true;

  // Standard GTM bootstrap object (matches the official snippet).
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

  // --- <script id="gtm-script"> -----------------------------------
  if (typeof document !== 'undefined') {
    const scriptId = 'gtm-script';
    if (!document.getElementById(scriptId)) {
      try {
        const script = document.createElement('script');
        script.id = scriptId;
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
        document.head.appendChild(script);
      } catch {
        // Never throw from analytics init.
      }
    }
  }

  return true;
}
