/**
 * Build-time GTM HTML helpers.
 *
 * Vite injects the official GTM head snippet + noscript iframe into index.html
 * only when VITE_GTM_ID is set, so:
 * - missing ID → unchanged HTML → zero GTM requests
 * - present ID → real static head bootstrap + <noscript> for users without JS
 *
 * Runtime initGtm() must not re-inject when these snippets are already present.
 */

/**
 * @param {string} gtmId
 * @returns {string} sanitized container id, or '' when unsafe/empty
 */
export function sanitizeGtmIdForHtml(gtmId) {
  const trimmed = typeof gtmId === 'string' ? gtmId.trim() : '';
  if (!trimmed) return '';
  // Official containers look like GTM-XXXX; reject anything that could break HTML.
  return /^GTM-[A-Z0-9]+$/i.test(trimmed) ? trimmed : '';
}

/**
 * Official GTM <head> bootstrap (inline dataLayer + async gtm.js).
 * @param {string} gtmId
 * @returns {string} empty when disabled
 */
export function buildGtmHeadSnippet(gtmId) {
  const id = sanitizeGtmIdForHtml(gtmId);
  if (!id) return '';
  // Keep the official snippet shape; id is sanitized to GTM-[A-Z0-9]+ only.
  return `<!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');</script>
    <!-- End Google Tag Manager -->`;
}

/**
 * @param {string} gtmId
 * @returns {string} empty when disabled
 */
export function buildGtmNoscriptSnippet(gtmId) {
  const id = sanitizeGtmIdForHtml(gtmId);
  if (!id) return '';
  return `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden" title="Google Tag Manager"></iframe></noscript>`;
}

/**
 * Inject the official GTM head snippet before </head> when an ID exists.
 * Idempotent when googletagmanager.com/gtm.js is already present.
 *
 * @param {string} html
 * @param {string} [gtmId]
 * @returns {string}
 */
export function applyGtmHeadSnippet(html, gtmId) {
  const snippet = buildGtmHeadSnippet(gtmId);
  if (!snippet) return html;
  if (/googletagmanager\.com\/gtm\.js/i.test(html)) return html;
  if (!/<\/head>/i.test(html)) return html;
  return html.replace(/<\/head>/i, `    ${snippet}\n  </head>`);
}

/**
 * Inject the GTM noscript iframe immediately after <body> when an ID exists.
 * Leaves HTML unchanged when the ID is missing (no GTM request possible).
 *
 * @param {string} html
 * @param {string} [gtmId]
 * @returns {string}
 */
export function applyGtmNoscript(html, gtmId) {
  const snippet = buildGtmNoscriptSnippet(gtmId);
  if (!snippet) return html;
  if (/googletagmanager\.com\/ns\.html/i.test(html)) return html;
  return html.replace(/<body([^>]*)>/i, `<body$1>\n    ${snippet}`);
}

/**
 * Apply official GTM head + noscript transforms for a given container id.
 * @param {string} html
 * @param {string} [gtmId]
 * @returns {string}
 */
export function applyGtmHtml(html, gtmId) {
  return applyGtmNoscript(applyGtmHeadSnippet(html, gtmId), gtmId);
}
