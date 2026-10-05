import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { translations } from '../src/i18n/translations.js';

const introPath = new URL('../src/components/IntroSection.jsx', import.meta.url);
const stylesPath = new URL('../src/styles.css', import.meta.url);

function readIntro() { return fs.readFileSync(introPath, 'utf8'); }
function readStyles() { return fs.readFileSync(stylesPath, 'utf8'); }

test('home intro renders the two redesigned CTA cards with EN and AR labels', () => {
  const intro = readIntro();
  const { en, ar } = translations;

  assert.equal(en.home.meet, 'Explore products');
  assert.equal(ar.home.meet, 'استكشف المنتجات');
  assert.equal(en.home.shopNow, 'Shop now');
  assert.equal(ar.home.shopNow, 'اشتري الآن');
  assert.ok(en.home.exploreMeta && en.home.shopMeta, 'EN micro-labels missing');
  assert.ok(ar.home.exploreMeta && ar.home.shopMeta, 'AR micro-labels missing');

  assert.match(intro, /className="intro-ctas"/);
  assert.equal((intro.match(/className="intro-cta"/g) || []).length, 2, 'exactly two CTA cards expected');
  assert.match(intro, /copy\.home\.meet/);
  assert.match(intro, /copy\.home\.shopNow/);
  assert.match(intro, /intro-cta__label/);
  assert.match(intro, /intro-cta__meta/);
  assert.match(intro, /intro-cta__icon/);
  assert.doesNotMatch(intro, /href="#showcases"/, 'plain underline anchor should be gone');
});

test('home intro CTA routes stay locale-aware with no hardcoded absolute URLs', () => {
  const intro = readIntro();
  const router = fs.readFileSync(new URL('../src/routing/Router.jsx', import.meta.url), 'utf8');

  assert.match(intro, /import \{ Link \} from '\.\.\/routing\/Router'/);
  const targets = [...intro.matchAll(/to="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(targets, ['/products', '/products'], 'both CTAs must target the shop listing route');
  assert.ok(targets.every((to) => to.startsWith('/') && !to.startsWith('//')), 'relative app routes only');

  // Link localizes every `to` with the active locale: /products -> /en/products | /ar/products.
  assert.match(router, /export function localizePath\(to, locale\)/);
  assert.match(router, /const href = localizePath\(to, locale\)/);
});

test('home intro CTA arrows follow LTR/RTL reading direction', () => {
  const intro = readIntro();
  const styles = readStyles();

  assert.match(intro, /locale === 'ar' \? '←' : '→'/);
  assert.match(styles, /\.intro-cta:hover \.intro-cta__icon \{ transform: translateX\(4px\)/);
  assert.match(styles, /html\[dir="rtl"\] \.intro-cta:hover \.intro-cta__icon \{ transform: translateX\(-4px\); \}/);
});

test('home intro heading and paragraphs stay unchanged', () => {
  const intro = readIntro();
  const { en, ar } = translations;

  assert.match(intro, /\{copy\.home\.introTitle\[0\]\}<br \/>\{copy\.home\.introTitle\[1\]\}/);
  assert.match(intro, /\{copy\.home\.introP1\}/);
  assert.match(intro, /\{copy\.home\.introP2\}/);

  assert.deepEqual(en.home.introTitle, ['Reimagining play,', 'every day.']);
  assert.equal(en.home.introP1, 'We build bright, surprising worlds that invite everyone to get curious, make a mess, and play their own way.');
  assert.equal(en.home.introP2, 'From pocket-sized discoveries to big outdoor energy, our ideas begin with one question: what would make this moment more fun?');
  assert.deepEqual(ar.home.introTitle, ['نعيد ابتكار اللعب،', 'كل يوم.']);
  assert.equal(ar.home.introP1, 'نصنع عوالم مبهجة ومفاجئة تدعو الجميع إلى الفضول والتجربة واللعب بطريقتهم الخاصة.');
});

test('home intro CTA styling is a bordered card grid that stacks on mobile', () => {
  const styles = readStyles();

  assert.match(styles, /\.intro-ctas \{[^}]*display: grid/);
  assert.match(styles, /\.intro-ctas \{[^}]*grid-template-columns: repeat\(2, minmax\(0,1fr\)\)/);
  assert.match(styles, /\.intro-cta \{[^}]*border: 1px solid rgba\(18,18,20,\.14\)/);
  assert.match(styles, /\.intro-cta \{[^}]*border-radius: 14px/);
  assert.match(styles, /\.intro-cta__label \{[^}]*font-weight: 800/);
  assert.match(styles, /\.intro-cta__icon \{[^}]*border-radius: 50%/);
  assert.match(styles, /\.intro-cta \{[^}]*transition: transform/);
  assert.match(styles, /\.intro-cta:hover \{[^}]*translateY\(-2px\)/);

  // Mobile: single column, full available width.
  assert.match(styles, /@media \(max-width: 760px\) \{\s*\.intro-ctas \{[^}]*grid-template-columns: 1fr/);
  assert.match(styles, /@media \(max-width: 760px\) \{\s*\.intro-ctas \{[^}]*max-width: none/);

  // Old underline link styling is gone from the intro body (careers keeps it).
  assert.doesNotMatch(styles, /\.intro-section__body a/);
  assert.match(styles, /\.careers-section a \{/);
});
