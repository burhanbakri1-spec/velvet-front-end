import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { translations } from '../src/i18n/translations.js';

const introPath = new URL('../src/components/IntroSection.jsx', import.meta.url);
const stylesPath = new URL('../src/styles.css', import.meta.url);

function readIntro() { return fs.readFileSync(introPath, 'utf8'); }
function readStyles() { return fs.readFileSync(stylesPath, 'utf8'); }

test('home intro renders the two CTA cards with EN and AR labels', () => {
  const intro = readIntro();
  const { en, ar } = translations;

  assert.equal(en.home.meet, 'Explore products');
  assert.equal(ar.home.meet, 'استكشف المنتجات');
  assert.equal(en.home.shopNow, 'Shop now');
  assert.equal(ar.home.shopNow, 'تسوق الآن');
  assert.ok(en.home.exploreMeta && en.home.shopMeta, 'EN micro-labels missing');
  assert.ok(ar.home.exploreMeta && ar.home.shopMeta, 'AR micro-labels missing');

  assert.match(intro, /className="intro-ctas"/);
  assert.equal((intro.match(/className="intro-cta intro-cta--/g) || []).length, 2, 'exactly two CTA cards expected');
  assert.match(intro, /intro-cta__label/);
  assert.match(intro, /intro-cta__meta/);
  assert.match(intro, /intro-cta__icon/);
});

test('Explore products scrolls to #showcases on Home instead of routing to /products', () => {
  const intro = readIntro();

  const primary = intro.match(/<Link className="intro-cta intro-cta--primary"[\s\S]*?<\/Link>/)?.[0] || '';
  assert.ok(primary, 'primary CTA missing');
  assert.match(primary, /to="#showcases"/, 'Explore products must target the home showcase section');
  assert.match(primary, /copy\.home\.meet/);
  assert.doesNotMatch(primary, /to="\/products"/, 'Explore products must no longer navigate to the shop route');

  // Smooth in-page scroll, no route change, no JS library.
  assert.match(intro, /onClick=\{scrollToShowcases\}/);
  assert.match(intro, /event\.preventDefault\(\)/);
  assert.match(intro, /document\.getElementById\('showcases'\)/);
  assert.match(intro, /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
  assert.doesNotMatch(intro, /import .*gsap|from 'animejs'|requestAnimationFrame\(\(\) => window\.scroll/);
});

test('Shop now keeps routing to the locale-aware shop listing', () => {
  const intro = readIntro();
  const router = fs.readFileSync(new URL('../src/routing/Router.jsx', import.meta.url), 'utf8');

  const accent = intro.match(/<Link className="intro-cta intro-cta--accent"[\s\S]*?<\/Link>/)?.[0] || '';
  assert.ok(accent, 'secondary CTA missing');
  assert.match(accent, /to="\/products"/);
  assert.match(accent, /copy\.home\.shopNow/);
  assert.doesNotMatch(accent, /#showcases/);

  const targets = [...intro.matchAll(/to="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(targets, ['#showcases', '/products']);
  assert.ok(!/https?:\/\/[^"']*\//.test(intro), 'no hardcoded absolute URLs');

  // Link localizes every `to` with the active locale: /products -> /en/products | /ar/products.
  assert.match(intro, /import \{ Link \} from '\.\.\/routing\/Router'/);
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

test('home intro CTA colors: VELVET turquoise primary + yellow secondary, same card grid', () => {
  const styles = readStyles();

  // Primary — VELVET turquoise card, white copy, matching border.
  assert.match(styles, /\.intro-cta--primary \{[^}]*background: var\(--red, #0A8492\)/);
  assert.match(styles, /\.intro-cta--primary \{[^}]*border-color: var\(--red, #0A8492\)/);
  assert.match(styles, /\.intro-cta--primary \{[^}]*color: #fff/);
  // Secondary — warm yellow card, dark copy for contrast.
  assert.match(styles, /\.intro-cta--accent \{[^}]*background: #FFD84D/);
  assert.match(styles, /\.intro-cta--accent \{[^}]*border-color: #FFD84D/);
  assert.match(styles, /\.intro-cta--accent \{[^}]*color: var\(--ink, #121214\)/);
  // White circular arrow icon: turquoise arrow on the primary card, dark arrow on the yellow card.
  assert.match(styles, /\.intro-cta__icon \{[^}]*background: #fff/);
  assert.match(styles, /\.intro-cta__icon \{[^}]*border-radius: 50%/);
  assert.match(styles, /\.intro-cta__icon \{[^}]*color: var\(--red/);
  assert.match(styles, /\.intro-cta--accent \.intro-cta__icon \{[^}]*color: var\(--ink/);
  // Meta micro-labels stay readable on both fills.
  assert.match(styles, /\.intro-cta--accent \.intro-cta__meta \{[^}]*color: rgba\(18,18,20,\.62\)/);
  // Hover: each card darkens one step deeper, keeping the lift.
  assert.match(styles, /\.intro-cta--primary:hover \{[^}]*background: var\(--brand-hover\)/);
  assert.match(styles, /\.intro-cta--accent:hover \{[^}]*background: #F0C531/);

  // Geometry, spacing and hover unchanged in spirit.
  assert.match(styles, /\.intro-ctas \{[^}]*display: grid/);
  assert.match(styles, /\.intro-ctas \{[^}]*grid-template-columns: repeat\(2, minmax\(0,1fr\)\)/);
  assert.match(styles, /\.intro-cta \{[^}]*border-radius: 14px/);
  assert.match(styles, /\.intro-cta \{[^}]*transition: transform/);
  assert.match(styles, /\.intro-cta__label \{[^}]*font-weight: 800/);
  assert.match(styles, /\.intro-cta--primary:hover \{[^}]*translateY\(-2px\)/);
  assert.match(styles, /\.intro-cta--accent:hover \{[^}]*translateY\(-2px\)/);

  // Mobile: single column, full available width.
  assert.match(styles, /@media \(max-width: 760px\) \{\s*\.intro-ctas \{[^}]*grid-template-columns: 1fr/);
  assert.match(styles, /@media \(max-width: 760px\) \{\s*\.intro-ctas \{[^}]*max-width: none/);

  // Old underline link styling is gone from the intro body (careers keeps it).
  assert.doesNotMatch(styles, /\.intro-section__body a/);
  assert.match(styles, /\.careers-section a \{/);
});

test('stacked brand scroll CSS and Arabic banner type stay unchanged', () => {
  const styles = readStyles();

  const stickyBlocks = styles.match(/[^{}]*\{[^}]*position:\s*sticky[^}]*\}/g) || [];
  const stackedBanners = stickyBlocks.filter((block) => block.includes('brand-showcase--full-banner'));
  assert.equal(stackedBanners.length, 2, 'home + brand category sticky stacks must survive');
  const homeStack = stackedBanners.find((block) => block.includes('#showcases'));
  const categoryStack = stackedBanners.find((block) => block.includes('.category-showcases'));
  assert.ok(homeStack);
  assert.ok(categoryStack);
  assert.match(homeStack, /position:\s*sticky/);
  assert.match(homeStack, /top:\s*var\(--header-height\)/);
  assert.match(homeStack, /z-index:\s*1/);
  assert.match(styles, /--brand-hero-edge:\s*140px/);
  assert.doesNotMatch(styles, /--brand-deck-slice|is-collapsed/);
  assert.match(categoryStack, /position:\s*sticky/);
  assert.match(categoryStack, /top:\s*0/);

  assert.match(styles, /html\[lang="ar"\] \.brand-showcase__content p \{ font-size: 25\.5px/);
  assert.match(styles, /html\[lang="ar"\] \.brand-showcase__logo \{ font-size: 30px/);
  assert.match(styles, /^\.brand-showcase__content p \{[^}]*font-size: 15px/m);
  assert.match(styles, /^\.brand-showcase__logo \{ font-size: 20px/m);
});
