import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const newsPage = fs.readFileSync(path.join(root, 'src/pages/NewsPage.jsx'), 'utf8');
const hero = fs.readFileSync(path.join(root, 'src/components/PageVideoHero.jsx'), 'utf8');

test('NewsPage reads news.banner media with red PageTitleHero fallback', () => {
  assert.match(newsPage, /getPlatformMedia/);
  assert.match(newsPage, /news\.banner\.video/);
  assert.match(newsPage, /news\.banner/);
  assert.match(newsPage, /PageTitleHero/);
  assert.match(newsPage, /PageVideoHero/);
  assert.match(newsPage, /autoPlay=\{Boolean\(bannerVideo\)\}/);
  assert.match(newsPage, /showPlayControl=\{false\}/);
  assert.match(newsPage, /theme="news"/);
  assert.doesNotMatch(newsPage, /news\.\d+\.image/);
});

test('PageVideoHero supports ambient muted autoplay loop without play control', () => {
  assert.match(hero, /autoPlay = false/);
  assert.match(hero, /muted = false/);
  assert.match(hero, /loop = false/);
  assert.match(hero, /showPlayControl = true/);
  assert.match(hero, /playsInline/);
});
