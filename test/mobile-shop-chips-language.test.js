import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const styles = read('../src/styles.css');
const header = read('../src/components/Header.jsx');
const filterBar = read('../src/components/ShopFilterBar.jsx');
const useShopState = read('../src/hooks/useShopState.js');
const i18n = read('../src/i18n/I18nContext.jsx');

// The scoped mobile chip block (everything mobile-specific lives inside it).
const chipsBlock = styles.match(
  /@media \(max-width: 760px\) \{[^{}]*\.shop-filter-quick-row \{[\s\S]*?\.shop-filter-bar__quick-chip \{ flex: 0 0 auto; \}\s*\}/,
)?.[0] ?? '';

// The visibility fix for the closed drawer's language pill.
const drawerLanguageFix = styles.match(/\.mobile-drawer:not\(\.is-open\) \.language-control \{[^}]*\}/)?.[0] ?? '';

test('mobile category chips stay in exactly one row (<=760px)', () => {
  assert.ok(chipsBlock, 'mobile chip block missing from styles.css');
  assert.match(chipsBlock, /^@media \(max-width: 760px\)/, 'scoped to phones only');
  assert.match(chipsBlock, /\.shop-filter-bar__quick \{[^{}]*flex-wrap: nowrap;/, 'chip list never wraps');
  assert.match(chipsBlock, /\.shop-filter-bar__quick-chip \{ flex: 0 0 auto; \}/, 'chips never shrink');
  assert.match(chipsBlock, /flex: 0 0 auto;/, 'chip row itself cannot shrink below its content');
  // Chip styling and active state are untouched.
  assert.match(styles, /\.shop-filter-bar__quick-chip \{[^}]*min-height: 36px;/);
  assert.match(styles, /\.shop-filter-bar__quick-chip\.is-active \{[^}]*background:\s*var\(--red\)/);
});

test('the chip row scrolls horizontally by touch in RTL and LTR with no scrollbar', () => {
  assert.match(chipsBlock, /overflow-x: auto;/, 'native horizontal scrolling');
  assert.match(chipsBlock, /overscroll-behavior-x: contain;/, 'scroll does not chain to the page');
  assert.match(chipsBlock, /-webkit-overflow-scrolling: touch;/, 'smooth touch scrolling on iOS');
  assert.match(chipsBlock, /scrollbar-width: none;/, 'scrollbar hidden (Firefox)');
  assert.match(chipsBlock, /\.shop-filter-quick-row::-webkit-scrollbar \{ display: none; \}/, 'scrollbar hidden (WebKit)');

  // Direction-agnostic: no physical left/right/ltr rules, so RTL starts at the
  // inline start edge and LTR does too.
  assert.doesNotMatch(chipsBlock, /\b(?:left|right|direction|text-align|margin-left|margin-right)\s*:/);
  assert.match(chipsBlock, /justify-content: flex-start;/, 'scroll starts at the inline start edge (no clipped overflow)');

  // No autoplaying movement is introduced.
  assert.doesNotMatch(chipsBlock, /animation:|transition:|scroll-behavior:|scroll-snap:/);
  assert.doesNotMatch(styles, /\.shop-filter-quick-row \{[^}]*animation:/);
});

test('category selection still filters products', () => {
  assert.match(filterBar, /const active = state\.category === option\.id;/);
  assert.match(filterBar, /onClick=\{\(\) => onSelect\('category', active \? '' : option\.id\)\}/);
  assert.match(filterBar, /aria-pressed=\{active\}/);
  assert.match(useShopState, /const select = useCallback\(\(key, value\) => go\(selectPathKey\(state, key, value\)\)/);
  assert.match(useShopState, /navigate\(localizePath\(`\/products\$\{query \? `\?\$\{query\}` : ''\}`, locale\)/);
});

test('desktop category layout is unchanged', () => {
  const quickRules = styles.match(/\.shop-filter-bar__quick \{[^}]*\}/g) || [];
  assert.ok(quickRules.length >= 2, 'base rule + mobile override expected');
  const base = quickRules.find((rule) => /flex-wrap: wrap/.test(rule));
  assert.ok(base, 'desktop keeps the wrapping chip row');
  assert.match(base, /width: 100%/);
  assert.match(base, /justify-content: center/);
  // The only nowrap override lives inside the <=760px media query.
  assert.equal(quickRules.filter((rule) => /flex-wrap: nowrap/.test(rule)).length, 1);
  assert.ok(chipsBlock.includes('flex-wrap: nowrap'), 'nowrap is mobile-only');
  assert.doesNotMatch(
    styles.replace(chipsBlock, ''),
    /@media \(min-width: [^)]+\)[\s\S]{0,300}?\.shop-filter-bar__quick \{/,
    'no desktop chip override added',
  );
  assert.match(styles, /\.shop-filter-quick-row \{[^}]*justify-content: center/, 'desktop row stays centered');
});

test('closed mobile drawer hides the language selector', () => {
  assert.ok(drawerLanguageFix, 'visibility fix missing from styles.css');
  assert.match(drawerLanguageFix, /^\.mobile-drawer:not\(\.is-open\) \.language-control \{/, 'targeted at the closed drawer');
  assert.match(drawerLanguageFix, /visibility: hidden !important;/);
  // Root cause: the global force-visible rule that punched through the drawer.
  assert.match(styles, /\.language-control \{[^}]*visibility: visible !important;/);
  assert.match(styles, /\.mobile-drawer \{[^}]*visibility: hidden;/, 'closed drawer is hidden by default');
  // More specific than the global rule, so it wins without !important ordering tricks.
  assert.ok('.mobile-drawer:not(.is-open) .language-control'.split(' ').length > 1);
  // The fix is visibility-only: it never permanently unmounts or disables the control.
  assert.doesNotMatch(drawerLanguageFix, /display: none|opacity: 0/);
});

test('scrolling never reveals the language selector', () => {
  // The closed drawer keeps `visibility: hidden`; nothing re-enables it while scrolled.
  assert.doesNotMatch(styles, /\.mobile-drawer \{[^}]*visibility: visible/);
  assert.doesNotMatch(header, /style=\{\{[^}]*visibility/);
  // Header hide-on-scroll only transforms, it never force-shows drawer contents.
  assert.match(styles, /\.site-header\.is-hidden \{ transform: translateY\(-100%\); \}/);
  assert.match(drawerLanguageFix, /visibility: hidden !important;/);
  // Drawer is not interactive while closed.
  assert.match(styles, /\.mobile-drawer \{[^}]*pointer-events: none;/);
});

test('opening the drawer shows the language selector', () => {
  assert.match(styles, /\.mobile-drawer\.is-open \{[^}]*visibility: visible;/);
  assert.match(styles, /\.mobile-drawer\.is-open \{[^}]*pointer-events: auto;/);
  assert.match(header, /mobile-drawer__top[\s\S]{0,260}?<LanguageControl className="language-control--drawer"/);
  // The fix only matches the *closed* state, so the open drawer is unaffected.
  assert.doesNotMatch(styles, /\.mobile-drawer\.is-open[^{]*\.language-control/);
});

test('switching language inside the drawer still works', () => {
  assert.match(header, /<LanguageControl className="language-control--drawer" onSwitch=\{closeMobile\} \/>/);
  assert.match(header, /function LanguageControl\(\{ className = '', onSwitch \}\)/);
  assert.match(header, /switchLanguage\(\);\s*\n\s*onSwitch\?\.\(\);/);
  assert.match(i18n, /localStorage\.setItem\('play-language', nextLocale\)/);
  assert.match(i18n, /localizePath\(basePath, nextLocale\)/);
  assert.match(i18n, /document\.documentElement\.dir = locale === 'ar' \? 'rtl' : 'ltr'/);
});

test('closing the drawer hides the selector again', () => {
  assert.match(header, /aria-hidden=\{!mobileOpen\}/);
  assert.match(header, /className="mobile-drawer__close"/);
  assert.match(header, /onClick=\{closeMobile\}/);
  assert.match(drawerLanguageFix, /:not\(\.is-open\)/);
  assert.doesNotMatch(styles, /\.mobile-drawer \{[^}]*visibility: visible;/);
});

test('no horizontal page overflow is introduced', () => {
  // The chips row owns its own scrolling, so its content never widens the page.
  assert.match(chipsBlock, /overflow-x: auto;/);
  assert.doesNotMatch(chipsBlock, /100vw|vw;/, 'no viewport-width chip row that could widen the page');
  assert.match(styles, /@media \(max-width: 900px\) \{\s*:root \{ --mobile-gutter: 22px; \}\s*html, body \{ overflow-x: clip; \}/);
  // Desktop header language control must not be hidden by the drawer fix.
  assert.match(styles, /\.language-control--header \{/);
  assert.match(header, /<LanguageControl className="language-control--header" \/>/);
  assert.doesNotMatch(styles, /\.mobile-drawer:not\(\.is-open\) \.language-control--header/);
});
