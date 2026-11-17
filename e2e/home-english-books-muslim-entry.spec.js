import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { installRealContentFixture } from './realContentFixture.js';

const evidenceDir = path.resolve(process.env.CONTINUITY_EVIDENCE_DIR || 'continuity-evidence');
const variant = process.env.HOME_TRACE_VARIANT || 'candidate';

test('English Home Books/Muslim reverse entry stays within the 8px pose limit', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 392, height: 720 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    locale: 'en-US',
  });
  await context.addInitScript(() => {
    localStorage.setItem('play-language', 'en');
    if (document.documentElement) document.documentElement.style.scrollBehavior = 'auto';
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.scrollBehavior = 'auto';
    }, { once: true });
  });
  const page = await context.newPage();
  await installRealContentFixture(page, 'en');
  await page.goto('http://127.0.0.1:4173/?view=showcases', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('#showcases .hero-stage > .home-brand').length === 12);
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll('#showcases .brand-showcase__image')];
    return images.length === 12 && images.every((image) => image.complete && image.naturalWidth > 0);
  });
  await page.evaluate(() => Promise.all([...document.querySelectorAll('#showcases .brand-showcase__image')].map((image) => image.decode())));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const layout = await page.evaluate(() => {
    const root = document.querySelector('#showcases');
    const shell = root.querySelector('.hero-stage-shell');
    const stage = root.querySelector('.hero-stage');
    const sections = [...stage.querySelectorAll(':scope > .home-brand')];
    const stageHeight = sections[0].querySelector('.brand-showcase').offsetHeight;
    const headerHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
    const shellStart = shell.getBoundingClientRect().top + scrollY - headerHeight;
    let cursor = 0;
    const heroes = sections.map((section) => {
      const offset = cursor;
      const banner = section.querySelector('.brand-showcase');
      const href = banner.querySelector('a[href*="/brands/"]')?.getAttribute('href') || '';
      cursor += stageHeight;
      const strip = section.querySelector('.home-brand__product-layer > .brand-strip');
      if (strip) cursor += strip.offsetHeight;
      return { slug: href.split('/').filter(Boolean).at(-1), offset };
    });
    const lastSection = sections.at(-1);
    const lastStrip = lastSection.querySelector('.home-brand__product-layer > .brand-strip');
    const span = heroes.at(-1).offset + (lastStrip ? stageHeight : 0);
    return { shellStart, stageHeight, span, heroes };
  });
  const boundary = layout.heroes.find((hero) => hero.slug === 'muslim').offset;

  const sample = async (requestedLocal) => {
    await page.evaluate(({ top, offset }) => window.scrollTo({ top: top + offset, behavior: 'instant' }), {
      top: layout.shellStart,
      offset: requestedLocal,
    });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return page.evaluate((span) => {
      const root = document.querySelector('#showcases');
      const stage = root.querySelector('.hero-stage');
      const stageRect = stage.getBoundingClientRect();
      const heroes = [...stage.querySelectorAll(':scope > .home-brand')].map((section, index) => {
        const banner = section.querySelector('.brand-showcase');
        const rect = banner.getBoundingClientRect();
        const href = banner.querySelector('a[href*="/brands/"]')?.getAttribute('href') || '';
        const transform = getComputedStyle(banner).transform;
        const matrix = new DOMMatrix(transform === 'none' ? undefined : transform);
        const clipParts = getComputedStyle(banner).clipPath.match(/inset\((.*)\)/)?.[1]?.split(/\s+/) || [];
        const clipTop = Number.parseFloat(clipParts[0]) || 0;
        const clipBottom = Number.parseFloat(clipParts[2]) || 0;
        return {
          index,
          slug: href.split('/').filter(Boolean).at(-1),
          relativeY: rect.top - stageRect.top,
          visiblePx: Math.max(0, Math.min(stageRect.height, rect.top - stageRect.top + rect.height - clipBottom)
            - Math.max(0, rect.top - stageRect.top + clipTop)),
          transform,
          translateY: matrix.m42,
          active: section.hasAttribute('data-active'),
        };
      });
      return {
        requestedLocal: window.__lastRequestedLocal,
        scrollY,
        rawLocal: scrollY - (root.querySelector('.hero-stage-shell').getBoundingClientRect().top + scrollY
          - (Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0)),
        local: Math.min(span, Math.max(0, scrollY - (root.querySelector('.hero-stage-shell').getBoundingClientRect().top + scrollY
          - (Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0)))),
        reverse: root.hasAttribute('data-home-reverse-phase') || root.hasAttribute('data-mobile-hero-up'),
        phase: root.getAttribute('data-home-reverse-phase'),
        activeHero: heroes.find((hero) => hero.active)?.index ?? null,
        activeSlug: heroes.find((hero) => hero.active)?.slug ?? null,
        heroes,
      };
    }, layout.span);
  };

  const frames = [];
  const positions = [boundary + 4, ...Array.from({ length: 9 }, (_, index) => boundary + 3 - index)];
  let previous = null;
  let reverseEntryCaptureLocal = null;
  for (const local of positions) {
    await page.evaluate((value) => { window.__lastRequestedLocal = value; }, local);
    const frame = await sample(local);
    const shared = previous && previous.heroes.filter((hero) => hero.visiblePx > 0.5
      && frame.heroes.some((item) => item.index === hero.index && item.visiblePx > 0.5));
    const step = previous ? Math.max(0, ...shared.map((hero) => Math.abs(
      hero.relativeY - frame.heroes[hero.index].relativeY,
    ))) : 0;
    if (!previous?.reverse && frame.reverse) reverseEntryCaptureLocal = frame.local;
    frames.push({
      ...frame,
      previousScrollY: previous?.scrollY ?? null,
      reverseEntryOrigin: boundary,
      reverseEntryCaptureLocal,
      maxSharedPoseShift: step,
    });
    if (local === boundary - 3) {
      await page.screenshot({ path: path.join(evidenceDir, `books-muslim-${variant}-forward-before-entry.png`), animations: 'disabled' });
    }
    if (local === boundary - 2) {
      await page.screenshot({ path: path.join(evidenceDir, `books-muslim-${variant}-reverse-entry.png`), animations: 'disabled' });
    }
    previous = frame;
  }

  const report = { variant, viewport: { width: 392, height: 720 }, locale: 'en', layout, boundary, frames };
  const reportPath = path.join(evidenceDir, `books-muslim-reverse-entry-${variant}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`${variant} Books/Muslim frames`, JSON.stringify(frames.map((frame) => ({
    local: frame.local,
    rawLocal: frame.rawLocal,
    previousScrollY: frame.previousScrollY,
    requestedLocal: frame.requestedLocal,
    direction: frame.reverse ? 'up' : 'down',
    reverse: frame.reverse,
    reverseEntryOrigin: frame.reverseEntryOrigin,
    reverseEntryCaptureLocal: frame.reverseEntryCaptureLocal,
    activeHero: frame.activeHero,
    poses: frame.heroes.filter((hero) => ['books', 'muslim'].includes(hero.slug))
      .map((hero) => ({ slug: hero.slug, y: hero.relativeY, transform: hero.transform, visiblePx: hero.visiblePx })),
    sharedShift: frame.maxSharedPoseShift,
  }))));
  expect(Math.max(...frames.map((frame) => frame.maxSharedPoseShift)), `${variant}: max Books/Muslim shared banner step`).toBeLessThanOrEqual(8);
  await context.close();
});
