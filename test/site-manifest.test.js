import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import handler from '../api/site-manifest.js';
import { buildSiteManifest } from '../src/data/siteManifest.js';

const walkElements = (manifest) => manifest.pages.flatMap((page) => page.sections.flatMap((section) => section.elements));

test('manifest exposes the verified i-play tenant identity and concrete routes', () => {
  const manifest = buildSiteManifest({ generatedAt: '2026-08-09T00:00:00.000Z' });
  assert.equal(manifest.schemaVersion, '1.0');
  assert.equal(manifest.companyId, 'kids-velvet');
  assert.equal(manifest.siteId, 'kids-velvet-storefront');
  assert.equal(manifest.siteName, 'i-play');
  assert.equal(manifest.baseUrl, 'https://i-play.vercel.app');
  assert.equal(manifest.defaultLocale, 'ar');
  assert.deepEqual(manifest.supportedLocales, ['ar', 'en']);
  assert.deepEqual(manifest.pages.map((page) => page.route), ['/', '/products', '/about', '/news', '/contact', '/cart']);
  assert.ok(manifest.pages.every((page) => !page.route.includes(':')));
  assert.equal('sectionLibrary' in manifest, false);
  assert.equal('siteDesign' in manifest, false);
});

test('manifest identifiers are unique and contain no unrelated tenant identity', () => {
  const manifest = buildSiteManifest({ generatedAt: '2026-08-09T00:00:00.000Z' });
  const ids = [
    ...manifest.pages.map((page) => page.id),
    ...manifest.pages.flatMap((page) => page.sections.map((section) => section.id)),
    ...walkElements(manifest).map((element) => element.id),
  ];
  assert.equal(new Set(ids).size, ids.length);
  const serialized = JSON.stringify(manifest).toLowerCase();
  for (const forbidden of ['icare', 'eb chemical', 'velvet kids', 'iplay-web.vercel.app']) {
    assert.equal(serialized.includes(forbidden), false, `unexpected identity: ${forbidden}`);
  }
});

test('product, category, news, contact-form and cart runtime data remain read-only', () => {
  const manifest = buildSiteManifest({ generatedAt: '2026-08-09T00:00:00.000Z' });
  const sourceBound = walkElements(manifest).filter((element) => element.source);
  assert.ok(sourceBound.length >= 5);
  assert.ok(sourceBound.every((element) => element.editable === false));
  assert.ok(sourceBound.every((element) => element.editableProperties.length === 0));
  const collections = sourceBound.filter((element) => ['productCollection', 'categoryCollection'].includes(element.type));
  assert.equal(collections.length, 3);
  assert.ok(manifest.pages.find((page) => page.id === 'cart').editable === false);
});

test('manifest payload contains no environment variables or secret-shaped fields', () => {
  const serialized = JSON.stringify(buildSiteManifest({ generatedAt: '2026-08-09T00:00:00.000Z' }));
  assert.doesNotMatch(serialized, /process\.env|database_url|postgres_url|secret|token|password|api[_-]?key/i);
});

test('HTTP handler returns JSON with the manifest media type', () => {
  const headers = {};
  const response = {
    statusCode: null,
    body: null,
    setHeader(name, value) { headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  handler({ method: 'GET' }, response);
  assert.equal(response.statusCode, 200);
  assert.match(headers['Content-Type'], /^application\/vnd\.igroup\.site-manifest\+json/);
  assert.equal(response.body.companyId, 'kids-velvet');
});

test('Vercel serves filesystem routes before the SPA fallback', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(config.routes[0], { handle: 'filesystem' });
  assert.deepEqual(config.routes.at(-1), { src: '/(.*)', dest: '/index.html' });
});
