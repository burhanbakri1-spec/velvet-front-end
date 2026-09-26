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
  assert.match(newsPage, /theme="news"/);
  assert.doesNotMatch(newsPage, /news\.\d+\.image/);
  // Poster first: the banner must not autoplay or force muted playback.
  assert.doesNotMatch(newsPage, /autoPlay/);
  assert.doesNotMatch(newsPage, /muted/);
  assert.doesNotMatch(newsPage, /showPlayControl=\{false\}/);
});

test('PageVideoHero plays with audio only after a user gesture', () => {
  assert.match(hero, /loop = false/);
  assert.match(hero, /showPlayControl = true/);
  assert.match(hero, /playsInline/);
  // Play control is rendered for every hero video; playback starts on click.
  assert.match(hero, /video && showPlayControl \?/);
  assert.match(hero, /onClick=\{togglePlayback\}/);
  // No autoplay and no forced mute anywhere in the hero.
  assert.doesNotMatch(hero, /autoPlay/);
  assert.doesNotMatch(hero, /muted/);
});
