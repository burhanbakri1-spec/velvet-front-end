import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { installRealContentFixture } from './realContentFixture.js';

const baselineUrl = process.env.PERF004_BASELINE_URL || 'http://127.0.0.1:4392';
const candidateUrl = process.env.PERF004_CANDIDATE_URL || 'http://127.0.0.1:4391';
const evidenceDir = path.resolve(process.env.PERF004_EVIDENCE_DIR || 'brand-motion-evidence/performance/perf004-browser');
const viewports = [
  { name: 'mobile-390x812', width: 390, height: 812, mobile: true },
  { name: 'mobile-392x720', width: 392, height: 720, mobile: true },
  { name: 'desktop-1366x768', width: 1366, height: 768, mobile: false },
];
const locales = ['en', 'ar'];
const fractions = [0, 0.5, 1];

async function openDeck(browser, url, viewport, locale) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
    deviceScaleFactor: 1,
    locale: locale === 'ar' ? 'ar' : 'en-US',
  });
  await context.addInitScript((selectedLocale) => {
    localStorage.setItem('play-language', selectedLocale);
    document.documentElement.style.scrollBehavior = 'auto';
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.scrollBehavior = 'auto';
    }, { once: true });
  }, locale);
  const page = await context.newPage();
  await installRealContentFixture(page, locale);
  await page.goto(url + '/?view=showcases', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#showcases .hero-stage > .home-brand .brand-showcase');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(80);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const layout = await page.evaluate(() => {
    const root = document.querySelector('#showcases');
    const shell = root?.querySelector('.hero-stage-shell');
    const stage = root?.querySelector('.hero-stage');
    const sections = [...(stage?.querySelectorAll(':scope > .home-brand') || [])];
    const firstHero = sections[0]?.querySelector('.brand-showcase');
    const stageHeight = firstHero?.offsetHeight || 0;
    const headerHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
    let cursor = 0;
    const heroes = sections.map((section, index) => {
      const hero = section.querySelector('.brand-showcase');
      const offset = cursor;
      cursor += stageHeight;
      const strip = section.querySelector('.brand-strip');
      if (strip) cursor += strip.offsetHeight;
      return { index, offset, slug: hero?.querySelector('a[href*="/brands/"]')?.getAttribute('href') || null };
    });
    const lastStrip = sections.at(-1)?.querySelector('.brand-strip');
    return {
      count: sections.length,
      stageHeight,
      pinHeight: stage?.getBoundingClientRect().height || 0,
      shellStart: shell ? shell.getBoundingClientRect().top + scrollY - headerHeight : 0,
      span: cursor - (lastStrip ? lastStrip.offsetHeight : stageHeight),
      heroes,
      locale: document.documentElement.lang,
      direction: document.documentElement.dir,
    };
  });
  if (layout.count < 2) throw new Error('Need at least two dynamic banners: ' + JSON.stringify(layout));
  await page.evaluate(() => {
    window.__perf004Snapshot = () => {
      const root = document.querySelector('#showcases');
      const stage = root?.querySelector('.hero-stage');
      const stageRect = stage?.getBoundingClientRect();
      const sections = [...(stage?.querySelectorAll(':scope > .home-brand') || [])];
      const heroes = sections.map((section, index) => {
        const el = section.querySelector('.brand-showcase');
        if (!el) return { index, missing: true };
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
        const parts = style.clipPath.match(/inset\((.*)\)/)?.[1]?.split(/\s+/) || [];
        const clipTop = Number.parseFloat(parts[0]) || 0;
        const clipBottom = Number.parseFloat(parts[2]) || 0;
        const visibleTop = Math.max(stageRect?.top || 0, rect.top + clipTop);
        const visibleBottom = Math.min(stageRect?.bottom || 0, rect.bottom - clipBottom);
        return {
          index,
          slug: el.querySelector('a[href*="/brands/"]')?.getAttribute('href') || null,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          relativeY: rect.top - (stageRect?.top || 0),
          translateY: matrix.m42,
          clipPath: style.clipPath,
          clipTop,
          clipBottom,
          z: style.zIndex,
          opacity: style.opacity,
          visibility: style.visibility,
          visiblePx: Math.max(0, visibleBottom - visibleTop),
          active: section.hasAttribute('data-active'),
        };
      });
      return {
        scrollY,
        reverse: root?.hasAttribute('data-mobile-hero-up') || false,
        phase: root?.getAttribute('data-mobile-reverse-phase') || null,
        active: heroes.find((hero) => hero.active)?.index ?? -1,
        pinned: document.body.classList.contains('hero-stage-pin'),
        heroes,
        visible: heroes.filter((hero) => hero.visiblePx > 0.5).map((hero) => hero.index),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    };
  });
  return { context, page, url, layout };
}

async function setLocal(deck, local) {
  return deck.page.evaluate(async ({ top, localY }) => {
    window.scrollTo({ top: top + localY, behavior: 'instant' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return window.__perf004Snapshot();
  }, { top: deck.layout.shellStart, localY: local });
}

async function saveScreenshot(deck, version, suffix) {
  await deck.page.screenshot({
    path: path.join(evidenceDir, version + '-' + suffix + '.png'),
    animations: 'disabled',
  });
}

function compareStates(before, after, label, assertSamePath = false) {
  expect(after.heroes.length, label + ': dynamic banner count').toBe(before.heroes.length);
  expect(after.active, label + ': active brand').toBe(before.active);
  expect(after.visible, label + ': visible banner set').toEqual(before.visible);
  expect(after.phase, label + ': reverse phase').toBe(before.phase);
  expect(after.reverse, label + ': reverse ownership').toBe(before.reverse);
  for (const index of before.visible) {
    const a = before.heroes[index];
    const b = after.heroes[index];
    expect(Math.abs(a.relativeY - b.relativeY), label + ': hero ' + index + ' y').toBeLessThanOrEqual(3);
    expect(Math.abs(a.visiblePx - b.visiblePx), label + ': hero ' + index + ' visible intersection').toBeLessThanOrEqual(3);
    expect(a.clipTop, label + ': hero ' + index + ' clip top').toBeCloseTo(b.clipTop, 0);
    expect(a.clipBottom, label + ': hero ' + index + ' clip bottom').toBeCloseTo(b.clipBottom, 0);
    expect(a.z, label + ': hero ' + index + ' z-index').toBe(b.z);
    expect(a.opacity, label + ': hero ' + index + ' opacity').toBe(b.opacity);
    expect(a.visibility, label + ': hero ' + index + ' visibility').toBe(b.visibility);
  }
  if (assertSamePath) {
    expect(after.scrollY, label + ': scrollY').toBe(before.scrollY);
    expect(after.pinned, label + ': pin ownership').toBe(before.pinned);
    expect(after.active, label + ': active owner').toBe(before.active);
    expect(after.reverse, label + ': direction ownership').toBe(before.reverse);
    expect(after.phase, label + ': phase').toBe(before.phase);
    for (const index of before.visible) {
      expect(after.heroes[index], label + ': exposed hero ' + index).toEqual(before.heroes[index]);
    }
  }
}

function maxVisibleDelta(a, b) {
  return Math.max(0, ...a.visible.map((index) => Math.abs(a.heroes[index].relativeY - b.heroes[index].relativeY)));
}

async function collectVersion(browser, url, viewport, locale, version) {
  const deck = await openDeck(browser, url, viewport, locale);
  const layout = deck.layout;
  const forward = [];
  const reverse = [];
  const reversals = [];
  const checkpoints = new Set([0, layout.span]);
  for (const hero of layout.heroes) {
    for (const offset of [hero.offset - 2, hero.offset, hero.offset + 2]) {
      if (offset >= 0 && offset <= layout.span) checkpoints.add(offset);
    }
  }
  for (let local = 0; local <= layout.span; local += 256) checkpoints.add(local);
  const forwardLocals = [...checkpoints].sort((a, b) => a - b);
  for (const local of forwardLocals) {
    const state = await setLocal(deck, local);
    expect(state.horizontalOverflow, version + ': horizontal overflow at ' + local).toBe(false);
    if (state.reverse) expect(state.visible.length, version + ': blank stage at ' + local).toBeGreaterThan(0);
    forward.push({ local, state });
  }
  for (const local of [...forwardLocals].reverse()) {
    const state = await setLocal(deck, local);
    if (state.reverse) expect(state.visible.length, version + ': banner vanished at ' + local).toBeGreaterThan(0);
    reverse.push({ local, state });
  }

  const representativePairs = new Set([1, Math.floor(layout.count / 2), layout.count - 1]);
  for (let current = 1; current < layout.count; current += 1) {
    const lower = layout.heroes[current - 1].offset;
    const boundary = layout.heroes[current].offset;
    const distance = boundary - lower;
    if (!(distance > 4)) continue;
    for (const fraction of fractions) {
      const reverseLocal = Math.max(lower + 2, Math.min(boundary - 2, boundary - Math.round(distance * fraction)));
      const downStart = await setLocal(deck, boundary + 3);
      const up = await setLocal(deck, reverseLocal);
      expect(up.visible.length, version + ': pair ' + current + ' lost visible banners').toBeGreaterThan(0);
      expect(up.active, version + ': pair ' + current + ' owner lower bound').toBeGreaterThanOrEqual(current - 1);
      expect(up.active, version + ': pair ' + current + ' later-brand leak').toBeLessThanOrEqual(current);
      const nudge = await setLocal(deck, Math.min(boundary + 3, reverseLocal + 1));
      const retraced = await setLocal(deck, reverseLocal);
      compareStates(up, retraced, version + ' pair ' + current + ' small retrace', true);
      const crossedStart = await setLocal(deck, boundary + 4);
      const afterCycle = await setLocal(deck, reverseLocal);
      compareStates(up, afterCycle, version + ' pair ' + current + ' cycle retrace');

      reversals.push({
        current,
        pairSlugs: [layout.heroes[current - 1].slug, layout.heroes[current].slug],
        fraction,
        lower,
        boundary,
        reverseLocal,
        downStart,
        up,
        nudge,
        retraced,
        crossedStart,
        afterCycle,
        smallRetraceMaxYDelta: maxVisibleDelta(up, retraced),
        cycleRetraceMaxYDelta: maxVisibleDelta(up, afterCycle),
      });

      if (viewport.name === 'mobile-390x812' && locale === 'en' && representativePairs.has(current) && [0, 0.5, 1].includes(fraction)) {
        const suffix = viewport.name + '-' + locale + '-pair' + current + '-p' + Math.round(fraction * 100);
        await setLocal(deck, boundary + 3);
        await saveScreenshot(deck, version, suffix + '-before-reversal');
        await setLocal(deck, reverseLocal);
        await saveScreenshot(deck, version, suffix + '-during-reverse');
        await setLocal(deck, Math.min(boundary + 3, reverseLocal + 1));
        await setLocal(deck, reverseLocal);
        await saveScreenshot(deck, version, suffix + '-after-reversal');
      }
    }
  }

  const above = await setLocal(deck, -5);
  expect(above.pinned, version + ': pin should release above deck').toBe(false);
  const below = await setLocal(deck, layout.span + layout.pinHeight + 50);
  expect(below.pinned, version + ': pin should release below deck').toBe(false);
  await deck.context.close();
  return { layout, forward, reverse, reversals, above, below };
}

for (const viewport of viewports) {
  test('dynamic full-deck reversals ' + viewport.name + ' Arabic and English', async ({ browser }) => {
    test.skip(!process.env.PERF004_BASELINE_URL || !process.env.PERF004_CANDIDATE_URL, 'requires explicit baseline and candidate URLs');
    test.setTimeout(300_000);
    fs.mkdirSync(evidenceDir, { recursive: true });
    const report = [];
    for (const locale of locales) {
      const label = viewport.name + '-' + locale;
      const baseline = await collectVersion(browser, baselineUrl, viewport, locale, 'baseline');
      const candidate = await collectVersion(browser, candidateUrl, viewport, locale, 'candidate');
      expect(candidate.layout.count, label + ': banner count parity').toBe(baseline.layout.count);
      expect(Math.abs(candidate.layout.stageHeight - baseline.layout.stageHeight), label + ': banner height parity').toBeLessThanOrEqual(3);
      expect(Math.abs(candidate.layout.pinHeight - baseline.layout.pinHeight), label + ': pin height parity').toBeLessThanOrEqual(3);
      expect(candidate.layout.heroes.map((hero) => hero.slug), label + ': dynamic banner order').toEqual(baseline.layout.heroes.map((hero) => hero.slug));
      for (let index = 0; index < baseline.layout.count; index += 1) {
        expect(Math.abs(candidate.layout.heroes[index].offset - baseline.layout.heroes[index].offset), label + ': hero offset ' + index).toBeLessThanOrEqual(3);
      }
      if (viewport.name === 'mobile-390x812') {
        expect(baseline.layout.stageHeight, label + ': baseline Baby height').toBe(370);
        expect(candidate.layout.stageHeight, label + ': candidate Baby height').toBe(370);
      }

      expect(candidate.forward.length, label + ': forward checkpoints').toBe(baseline.forward.length);
      for (let index = 0; index < baseline.forward.length; index += 1) {
        expect(candidate.forward[index].local).toBe(baseline.forward[index].local);
        compareStates(baseline.forward[index].state, candidate.forward[index].state, label + ' forward local=' + baseline.forward[index].local);
      }
      expect(candidate.reverse.length, label + ': reverse checkpoints').toBe(baseline.reverse.length);
      for (let index = 0; index < baseline.reverse.length; index += 1) {
        expect(candidate.reverse[index].local).toBe(baseline.reverse[index].local);
        compareStates(baseline.reverse[index].state, candidate.reverse[index].state, label + ' reverse local=' + baseline.reverse[index].local);
      }
      expect(candidate.reversals.length, label + ': pair reversal count').toBe(baseline.reversals.length);
      for (let index = 0; index < baseline.reversals.length; index += 1) {
        const b = baseline.reversals[index];
        const c = candidate.reversals[index];
        const caseLabel = label + ' pair=' + b.current + ' fraction=' + b.fraction;
        expect(c.current).toBe(b.current);
        expect(c.fraction).toBe(b.fraction);
        for (const phase of ['downStart', 'up', 'nudge', 'retraced', 'crossedStart', 'afterCycle']) {
          compareStates(b[phase], c[phase], caseLabel + ' ' + phase);
        }
      }
      compareStates(baseline.above, candidate.above, label + ' above deck');
      compareStates(baseline.below, candidate.below, label + ' below deck');
      report.push({
        viewport: viewport.name,
        locale,
        baseline: { geometry: baseline.layout, checkpoints: baseline.forward.length, reversals: baseline.reversals.length },
        candidate: { geometry: candidate.layout, checkpoints: candidate.forward.length, reversals: candidate.reversals.length },
      });
    }
    fs.writeFileSync(path.join(evidenceDir, viewport.name + '-summary.json'), JSON.stringify(report, null, 2));
  });
}
