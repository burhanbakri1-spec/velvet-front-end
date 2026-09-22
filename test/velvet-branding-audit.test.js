import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { SITE_MANIFEST_IDENTITY, buildSiteManifest } from '../src/data/siteManifest.js';
import { translations } from '../src/i18n/translations.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const customerFacingSources = [
  'index.html',
  'src/main.jsx',
  'src/i18n/translations.js',
  'src/pages/LoginPage.jsx',
  'src/pages/AccountPage.jsx',
  'src/pages/ContactPage.jsx',
  'src/pages/AboutPage.jsx',
  'src/components/Footer.jsx',
  'src/components/Header.jsx',
  'src/components/IntroLoader.jsx',
];

const LIVE_STOREFRONT_ORIGIN = 'https://mintcream-mink-816924.hostingersite.com';

test('customer-facing sources do not show legacy i-play / i-toy branding', () => {
  for (const relativePath of customerFacingSources) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /Loading i-play/i, relativePath);
    assert.doesNotMatch(source, /\bi-play\b/i, relativePath);
    assert.doesNotMatch(source, /\biplay\b/i, relativePath);
    assert.doesNotMatch(source, /\bi-toy\b/i, relativePath);
    assert.doesNotMatch(source, /\bitoy\b/i, relativePath);
  }
});

test('bootstrap loader and HTML title use VELVET', () => {
  assert.match(read('src/main.jsx'), /Loading VELVET…/);
  assert.match(read('index.html'), /<title>VELVET/);
  assert.match(read('index.html'), /VELVET/);
});

test('login unavailable copy stays customer-safe in EN and AR', () => {
  assert.equal(translations.en.login.unavailableBody, 'Sign in is currently unavailable');
  assert.equal(translations.ar.login.unavailableBody, 'تسجيل الدخول غير متاح حالياً');
  assert.doesNotMatch(translations.en.login.unavailableBody, /API|endpoint|env|config/i);
  assert.doesNotMatch(translations.ar.login.unavailableBody, /API|endpoint|env|config/i);
});

test('site manifest identity uses VELVET name and live Hostinger base URL', () => {
  assert.equal(SITE_MANIFEST_IDENTITY.siteName, 'VELVET');
  assert.equal(SITE_MANIFEST_IDENTITY.baseUrl, LIVE_STOREFRONT_ORIGIN);
  assert.equal(SITE_MANIFEST_IDENTITY.companyId, 'kids-velvet');
  assert.equal(SITE_MANIFEST_IDENTITY.siteId, 'kids-velvet-storefront');

  const manifest = buildSiteManifest({ generatedAt: '2026-08-09T00:00:00.000Z' });
  assert.equal(manifest.siteName, 'VELVET');
  assert.equal(manifest.baseUrl, LIVE_STOREFRONT_ORIGIN);
  assert.doesNotMatch(JSON.stringify(manifest), /i-play\.vercel\.app/i);
  assert.doesNotMatch(JSON.stringify(manifest), /"siteName":"i-play"/i);
});
