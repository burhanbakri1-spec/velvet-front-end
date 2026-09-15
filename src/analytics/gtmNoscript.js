/**
 * Build-time GTM noscript helper.
 *
 * A JS-created <noscript> is not a real no-JS fallback. Vite injects the
 * official noscript iframe into index.html only when VITE_GTM_ID is set, so:
 * - missing ID → no ns.html markup → zero GTM noscript requests
 * - present ID → real static <noscript> for users without JavaScript
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
 * @param {string} gtmId
 * @returns {string} empty when disabled
 */
export function buildGtmNoscriptSnippet(gtmId) {
  const id = sanitizeGtmIdForHtml(gtmId);
  if (!id) return '';
  return `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden" title="Google Tag Manager"></iframe></noscript>`;
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
