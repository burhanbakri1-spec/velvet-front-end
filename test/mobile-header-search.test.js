import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const header = fs.readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('mobile header exposes a directly visible, accessible search trigger', () => {
  assert.match(header, /mobile-header-search-trigger/);
  assert.match(header, /aria-label=\{copy\.header\.searchLabel\}/);
  assert.match(header, /aria-controls="mobile-navigation-drawer"/);
  assert.match(header, /aria-expanded=\{mobileOpen\}/);
  assert.match(header, /openMobileSearch/);
  assert.match(header, /type="button"/);
  assert.match(header, /<svg[\s\S]*?circle[\s\S]*?path/);
});

test('mobile search trigger opens the drawer and exposes existing search behavior', () => {
  assert.match(header, /const openMobileSearch = \(\) => \{[\s\S]*?setMobileOpen\(true\)[\s\S]*?setMenuView\('root'\)[\s\S]*?mobileSearchFocusPending\.current = true/);
  assert.ok(header.includes('mobileSearchInputRef.current?.focus?.()'));
  assert.match(header, /ref=\{mobileSearchInputRef\}/);
  assert.match(header, /id="mobile-header-search"/);
  assert.match(header, /<SearchDropdown query=\{search\} setQuery=\{setSearch\} \/>/);
});

test('existing localized query navigation and close behavior remain wired', () => {
  assert.match(header, /navigate\(localizePath\(`\/products\?search=\$\{encodeURIComponent\(query\)\}`, locale\)\)/);
  assert.match(header, /event\.key === 'Escape' && \(setBrandsOpen\(false\), setAboutOpen\(false\), closeMobile\(\)\)/);
  assert.match(header, /const closeMobile = \(\) => \{[\s\S]*?setMobileOpen\(false\)[\s\S]*?setMenuView\('root'\)/);
});

test('desktop header search and drawer search structures remain intact', () => {
  assert.match(header, /<div className="header-search">[\s\S]*?<form className="search-pill" onSubmit=\{submitSearch\}>/);
  assert.match(header, /<div className="header-search header-search--mobile">[\s\S]*?<form className="mobile-drawer__search" onSubmit=\{submitSearch\} role="search">/);
});

test('mobile header search trigger styles prevent overlap and keep tap accessibility', () => {
  assert.match(styles, /\.mobile-header-search-trigger \{ display: none; \}/);
  assert.match(styles, /@media \(max-width: 900px\) \{[\s\S]*?\.mobile-header-search-trigger \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;[\s\S]*?display: grid;/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) auto auto/);
  assert.match(styles, /\.mobile-header-search-trigger:focus-visible \{ outline: 2px solid currentColor/);
  assert.match(styles, /\.nav-bar > \.mobile-header-search-trigger \{ grid-column: 2; grid-row: 1; \}/);
  assert.match(styles, /\.nav-bar > \.menu-toggle \{ grid-column: 3; grid-row: 1; \}/);
  assert.match(styles, /\.nav-bar > \.logo\.logo--brand \{ min-width: 0; max-width: 100%; \}/);
  assert.match(styles, /max-width: min\(302px, 100%\)/);
});
