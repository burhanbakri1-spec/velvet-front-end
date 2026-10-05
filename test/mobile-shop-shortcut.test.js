import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { translations } from '../src/i18n/translations.js';

const header = fs.readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const router = fs.readFileSync(new URL('../src/routing/Router.jsx', import.meta.url), 'utf8');

const utilityRow = header.match(/<div className="mobile-utility-row">[\s\S]*?<\/div>/)?.[0] || '';

test('top mobile header no longer contains the language selector', () => {
  assert.ok(utilityRow, 'mobile utility row missing from Header.jsx');
  assert.doesNotMatch(utilityRow, /LanguageControl|language-control/);
  assert.doesNotMatch(styles, /\.mobile-utility-row \.language-control/);
});

test('top mobile header shows a Shop shortcut control', () => {
  assert.match(utilityRow, /className="header-icon-button mobile-shop-link"/);
  assert.match(utilityRow, /<svg[\s\S]*?<path[\s\S]*?<\/svg>/);
  assert.match(utilityRow, /aria-label=\{copy\.header\.shop\}/);
  assert.equal(translations.en.header.shop, 'Shop');
  assert.equal(translations.ar.header.shop, 'المتجر');
  assert.match(styles, /a\.header-icon-button \{ text-decoration: none; \}/);
});

test('Shop shortcut uses the correct locale-aware products route', () => {
  assert.match(utilityRow, /to=\{localizePath\('\/products', locale\)\}/);
  assert.match(router, /export function localizePath\(to, locale\)/);
  assert.match(router, /const href = localizePath\(to, locale\)/);
});

test('language selector stays available inside the mobile drawer', () => {
  assert.match(header, /mobile-drawer__top[\s\S]{0,260}?<LanguageControl className="language-control--drawer"/);
});

test('desktop header keeps its language control, shop link and account untouched', () => {
  const actionsStart = header.indexOf('<div className="header-actions">');
  const actionsEnd = header.indexOf('className={`menu-toggle');
  assert.ok(actionsStart > -1 && actionsEnd > actionsStart, 'desktop header actions block missing');
  const desktopActions = header.slice(actionsStart, actionsEnd);

  assert.match(desktopActions, /<LanguageControl className="language-control--header" \/>/);
  assert.match(desktopActions, /header-icon-button--account/);
  assert.match(header, /className="nav-link nav-link--shop"/);
  assert.match(styles, /\.language-control--header \{/);
});
