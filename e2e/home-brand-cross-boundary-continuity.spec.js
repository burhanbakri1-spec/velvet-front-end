import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { installRealContentFixture } from './realContentFixture.js';

const evidenceDir = path.resolve(process.env.CONTINUITY_EVIDENCE_DIR || 'continuity-evidence');

async function snapshot(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#showcases');
    const stage = root?.querySelector('.hero-stage');
    const shell = root?.querySelector('.hero-stage-shell');
    const stageRect = stage?.getBoundingClientRect();
    const headerHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
    const shellStart = shell ? shell.getBoundingClientRect().top + scrollY - headerHeight : 0;
    const heroes = [...(stage?.querySelectorAll(':scope > .home-brand') || [])].map((section, index) => {
      const el = section.querySelector('.brand-showcase');
      if (!el || !stageRect) return { index, missing: true, visiblePx: 0 };
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
      const parts = style.clipPath.match(/inset\((.*)\)/)?.[1]?.split(/\s+/) || [];
      const clipTop = Number.parseFloat(parts[0]) || 0;
      const clipBottom = Number.parseFloat(parts[2]) || 0;
      const visibleTop = Math.max(stageRect.top, rect.top + clipTop);
      const visibleBottom = Math.min(stageRect.bottom, rect.bottom - clipBottom);
      const href = el.querySelector('a[href*="/brands/"]')?.getAttribute('href') || '';
      const image = el.querySelector('.brand-showcase__image');
      const imageStyle = image ? getComputedStyle(image) : null;
      const imageRect = image?.getBoundingClientRect();
      const strip = section.querySelector('.home-brand__product-layer > .brand-strip');
      const stripStyle = strip ? getComputedStyle(strip) : null;
      const stripY = strip ? new DOMMatrix(stripStyle.transform === 'none' ? undefined : stripStyle.transform).m42 : 0;
      const stripHeight = strip?.getBoundingClientRect().height || 0;
      const stripHidden = !strip || strip.classList.contains('is-concealed');
      return {
        index,
        slug: href.split('/').filter(Boolean).at(-1) || null,
        relativeY: rect.top - stageRect.top,
        height: rect.height,
        translateY: matrix.m42,
        clipTop,
        clipBottom,
        z: style.zIndex,
        visibility: style.visibility,
        opacity: Number(style.opacity),
        display: style.display,
        visiblePx: Math.max(0, visibleBottom - visibleTop),
        image: image ? {
          src: image.currentSrc,
          loaded: image.complete && image.naturalWidth > 0,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          rect: { x: imageRect.x, y: imageRect.y, width: imageRect.width, height: imageRect.height },
          position: imageStyle.position,
          zIndex: imageStyle.zIndex,
          opacity: imageStyle.opacity,
          visibility: imageStyle.visibility,
          display: imageStyle.display,
          objectFit: imageStyle.objectFit,
          parentBackground: getComputedStyle(el).backgroundColor,
        } : null,
        active: section.hasAttribute('data-active'),
        strip: strip ? {
          y: stripY,
          height: stripHeight,
          hidden: stripHidden,
          visiblePx: stripHidden ? 0 : Math.max(0, Math.min(stageRect.bottom, stageRect.top + stripY + stripHeight)
            - Math.max(stageRect.top, stageRect.top + stripY)),
        } : null,
      };
    });
    const intervals = [
      ...heroes.map((hero) => ({
        top: Math.max(0, hero.relativeY + hero.clipTop),
        bottom: Math.min(stageRect?.height || 0, hero.relativeY + hero.height - hero.clipBottom),
      })),
      ...heroes.filter((hero) => hero.strip && !hero.strip.hidden).map((hero) => ({
        top: Math.max(0, hero.strip.y),
        bottom: Math.min(stageRect?.height || 0, hero.strip.y + hero.strip.height),
      })),
    ].filter((interval) => interval.bottom > interval.top).sort((a, b) => a.top - b.top);
    let coveredTo = 0;
    let maxInteriorGap = 0;
    let largestInteriorGap = null;
    for (const interval of intervals) {
      if (interval.top > coveredTo + 1 && interval.top - coveredTo > maxInteriorGap) {
        maxInteriorGap = interval.top - coveredTo;
        largestInteriorGap = { from: coveredTo, to: interval.top };
      }
      coveredTo = Math.max(coveredTo, interval.bottom);
    }
    return {
      scrollY,
      local: scrollY - shellStart,
      reverse: root?.hasAttribute('data-mobile-hero-up') || false,
      phase: root?.getAttribute('data-home-reverse-phase') || null,
      activeSlug: heroes.find((hero) => hero.active)?.slug || null,
      pinned: document.body.classList.contains('hero-stage-pin'),
      heroes,
      visible: heroes.filter((hero) => hero.visiblePx > 0.5).map((hero) => hero.index),
      maxInteriorGap,
      largestInteriorGap,
    };
  });
}

async function setLocal(page, shellStart, local) {
  await page.evaluate(({ top, offset }) => {
    window.scrollTo({ top: top + offset, behavior: 'instant' });
  }, { top: shellStart, offset: local });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return snapshot(page);
}

function frameDelta(before, after) {
  const shared = before.visible.filter((index) => after.visible.includes(index));
  return {
    sharedPoseShift: Math.max(0, ...shared.map((index) => Math.abs(before.heroes[index].relativeY - after.heroes[index].relativeY))),
    visibleHeightDelta: Math.max(0, ...before.heroes.map((hero) => Math.abs(hero.visiblePx - after.heroes[hero.index].visiblePx))),
    droppedLayers: before.visible.filter((index) => !after.visible.includes(index)),
    addedLayers: after.visible.filter((index) => !before.visible.includes(index)),
  };
}

test('mobile reversal across the Books boundary keeps the reverse deck continuous', async ({ browser }) => {
  test.setTimeout(90_000);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 392, height: 720 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    locale: 'ar',
  });
  await context.addInitScript(() => {
    localStorage.setItem('play-language', 'ar');
    document.documentElement.style.scrollBehavior = 'auto';
  });
  const page = await context.newPage();
  await installRealContentFixture(page, 'ar');
  await page.goto('http://127.0.0.1:4173/?view=showcases', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('#showcases .hero-stage > .home-brand').length === 12);
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll('#showcases .brand-showcase__image')];
    return images.length === 12 && images.every((image) => image.complete && image.naturalWidth > 0);
  });
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('#showcases .brand-showcase__image')].map((image) => image.decode()));
  });
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1500))]));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const layout = await page.evaluate(() => {
    const root = document.querySelector('#showcases');
    const shell = root?.querySelector('.hero-stage-shell');
    const stage = root?.querySelector('.hero-stage');
    const sections = [...(stage?.querySelectorAll(':scope > .home-brand') || [])];
    const firstHero = sections[0]?.querySelector('.brand-showcase');
    const stageHeight = firstHero?.offsetHeight || 0;
    const pinHeight = stage?.getBoundingClientRect().height || 0;
    const headerHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
    let cursor = 0;
    const heroes = sections.map((section, index) => {
      const el = section.querySelector('.brand-showcase');
      const offset = cursor;
      cursor += stageHeight;
      const strip = section.querySelector('.home-brand__product-layer > .brand-strip');
      if (strip) cursor += strip.offsetHeight;
      const href = el?.querySelector('a[href*="/brands/"]')?.getAttribute('href') || '';
      return { index, offset, slug: href.split('/').filter(Boolean).at(-1) || null };
    });
    return {
      count: sections.length,
      stageHeight,
      pinHeight,
      shellStart: shell ? shell.getBoundingClientRect().top + scrollY - headerHeight : 0,
      heroes,
    };
  });
  const booksIndex = layout.heroes.findIndex((hero) => hero.slug === 'books');
  const muslimIndex = layout.heroes.findIndex((hero) => hero.slug === 'muslim');
  expect(layout.count).toBe(12);
  expect(booksIndex).toBeGreaterThan(0);
  expect(muslimIndex).toBe(booksIndex + 1);

  const booksBoundary = layout.heroes[booksIndex].offset;
  const muslimBoundary = layout.heroes[muslimIndex].offset;
  const downStartLocal = muslimBoundary + 120;
  const stackRoom = Math.max(0, layout.pinHeight - layout.stageHeight, Math.min(436, layout.stageHeight));
  const stackStep = Math.min(58, stackRoom / (layout.heroes.length - 1));
  const stackDistance = booksIndex * stackStep;
  const reverseLocal = booksBoundary - stackDistance - 16;

  // Move down into the Muslim/Books segment, then cross upward into Books.
  await setLocal(page, layout.shellStart, downStartLocal);
  const fullReverseStack = await setLocal(page, layout.shellStart, reverseLocal);
  expect(fullReverseStack.reverse).toBe(true);
  expect(fullReverseStack.activeSlug).toBe('books');
  expect(fullReverseStack.visible.length).toBeGreaterThan(5);
  await page.screenshot({ path: path.join(evidenceDir, 'books-reverse-full-stack.png'), animations: 'disabled' });

  // Return down to one pixel before the boundary. The reverse deck is still
  // owned by the upward model at this coordinate; one more pixel flips the
  // latched owner to the normal forward pose.
  const beforeModeSwitch = await setLocal(page, layout.shellStart, booksBoundary + 1);
  const afterModeSwitch = await setLocal(page, layout.shellStart, booksBoundary + 2);
  await page.screenshot({ path: path.join(evidenceDir, 'books-boundary-before-down-reversal.png'), animations: 'disabled' });
  await page.screenshot({ path: path.join(evidenceDir, 'books-boundary-after-down-reversal.png'), animations: 'disabled' });
  const shared = beforeModeSwitch.visible.filter((index) => afterModeSwitch.visible.includes(index));
  const maxSharedPoseShift = Math.max(0, ...shared.map((index) => (
    Math.abs(beforeModeSwitch.heroes[index].relativeY - afterModeSwitch.heroes[index].relativeY)
  )));
  const maxVisibleHeightDelta = Math.max(0, ...beforeModeSwitch.heroes.map((hero) => (
    Math.abs(hero.visiblePx - afterModeSwitch.heroes[hero.index].visiblePx)
  )));
  const report = {
    layout,
    booksBoundary,
    fullReverseStack,
    beforeModeSwitch,
    afterModeSwitch,
    modeSwitchScrollDelta: afterModeSwitch.local - beforeModeSwitch.local,
    visibleLayerDrop: beforeModeSwitch.visible.length - afterModeSwitch.visible.length,
    maxSharedPoseShift,
    maxVisibleHeightDelta,
  };
  fs.writeFileSync(path.join(evidenceDir, 'books-boundary-reproduction.json'), JSON.stringify(report, null, 2));

  expect(beforeModeSwitch.reverse, 'the reverse deck should own the frame before the handoff').toBe(true);
  expect(beforeModeSwitch.visible.length).toBeGreaterThan(5);
  expect(afterModeSwitch.visible.length, 'a one-pixel direction change should not drop the reverse stack').toBeGreaterThanOrEqual(beforeModeSwitch.visible.length - 2);
  expect(maxSharedPoseShift, 'shared banner layers should not jump across a one-pixel scroll change').toBeLessThanOrEqual(8);
  expect(maxVisibleHeightDelta, 'a one-pixel boundary crossing should not abruptly clip a full banner').toBeLessThanOrEqual(64);
  await context.close();
});

test('mobile real-content reverse deck stays continuous across all 11 brand boundaries in Arabic and English', async ({ browser }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const reports = [];

  for (const locale of ['ar', 'en']) {
    const context = await browser.newContext({
      viewport: { width: 392, height: 720 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
      locale: locale === 'ar' ? 'ar' : 'en-US',
    });
    await context.addInitScript((language) => {
      localStorage.setItem('play-language', language);
      if (document.documentElement) document.documentElement.style.scrollBehavior = 'auto';
      document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.scrollBehavior = 'auto';
      }, { once: true });
    }, locale);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
    await installRealContentFixture(page, locale);
    await page.goto('http://127.0.0.1:4173/?view=showcases', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('#showcases .hero-stage > .home-brand').length === 12);
    await page.waitForFunction(() => {
      const images = [...document.querySelectorAll('#showcases .brand-showcase__image')];
      return images.length === 12 && images.every((image) => image.complete && image.naturalWidth > 0);
    });
    await page.evaluate(async () => {
      await Promise.all([...document.querySelectorAll('#showcases .brand-showcase__image')].map((image) => image.decode()));
    });
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1500))]));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const layout = await page.evaluate(() => {
      const root = document.querySelector('#showcases');
      const shell = root?.querySelector('.hero-stage-shell');
      const stage = root?.querySelector('.hero-stage');
      const sections = [...(stage?.querySelectorAll(':scope > .home-brand') || [])];
      const firstHero = sections[0]?.querySelector('.brand-showcase');
      const stageHeight = firstHero?.offsetHeight || 0;
      const pinHeight = stage?.getBoundingClientRect().height || 0;
      const headerHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
      let cursor = 0;
      const heroes = sections.map((section, index) => {
        const el = section.querySelector('.brand-showcase');
        const offset = cursor;
        cursor += stageHeight;
        const strip = section.querySelector('.home-brand__product-layer > .brand-strip');
        if (strip) cursor += strip.offsetHeight;
        const href = el?.querySelector('a[href*="/brands/"]')?.getAttribute('href') || '';
        return { index, offset, slug: href.split('/').filter(Boolean).at(-1) || null };
      });
      return {
        count: sections.length,
        stageHeight,
        pinHeight,
        shellStart: shell ? shell.getBoundingClientRect().top + scrollY - headerHeight : 0,
        heroes,
        direction: document.documentElement.dir,
        assets: sections.map((section) => {
          const banner = section.querySelector('.brand-showcase');
          const image = banner?.querySelector('.brand-showcase__image');
          const logo = banner?.querySelector('.brand-showcase__brand-logo');
          const strip = section.querySelector('.home-brand__product-layer > .brand-strip');
          return {
            imageLoaded: Boolean(image?.complete && image.naturalWidth > 0),
            imageWidth: image?.naturalWidth || 0,
            logoLoaded: Boolean(logo?.complete && logo.naturalWidth > 0),
            stripCards: strip?.querySelectorAll('.brand-strip-card').length || 0,
          };
        }),
      };
    });
    expect(layout.count, `${locale}: all 12 Home banners`).toBe(12);
    expect(layout.direction, `${locale}: locale direction`).toBe(locale === 'ar' ? 'rtl' : 'ltr');
    expect(layout.heroes.map((hero) => hero.slug)).toEqual([
      'baby', 'kids', 'play', 'build', 'learn', 'create', 'games', 'move', 'collect', 'plush', 'books', 'muslim',
    ]);
    expect(layout.assets).toHaveLength(12);
    expect(layout.assets.every((asset) => asset.imageLoaded && asset.logoLoaded), `${locale}: all real banners and logos are loaded`).toBe(true);
    expect(layout.assets.some((asset) => asset.stripCards > 0), `${locale}: real product strip cards are present`).toBe(true);

    const finalBoundary = layout.heroes[11].offset;
    await setLocal(page, layout.shellStart, finalBoundary + 8);
    const enteredReverse = await setLocal(page, layout.shellStart, finalBoundary - 8);
    expect(enteredReverse.reverse, `${locale}: reverse mode starts at Muslim`).toBe(true);
    const boundaries = [];

    for (let current = 11; current > 0; current -= 1) {
      const boundary = layout.heroes[current].offset;
      // Cross the boundary in both directions. Sampling only +1/+2 stays on
      // the same side and incorrectly expects reverse ownership at Muslim's
      // original entry boundary before that boundary was crossed.
      const upBefore = await setLocal(page, layout.shellStart, boundary + 2);
      const upAfter = await setLocal(page, layout.shellStart, boundary - 2);
      const upDelta = frameDelta(upBefore, upAfter);
      const downBefore = upAfter;
      const downAfter = await setLocal(page, layout.shellStart, boundary + 2);
      const downDelta = frameDelta(downBefore, downAfter);
      const partialStart = await setLocal(page, layout.shellStart, boundary - 20);
      const partialReverse = await setLocal(page, layout.shellStart, boundary - 12);
      const partialReturn = await setLocal(page, layout.shellStart, boundary - 20);
      const partialDelta = frameDelta(partialStart, partialReturn);

      // Probe the immediate ownership flip one scroll pixel at a time in each
      // direction. These frames exercise the real DOM transforms and clips.
      const slowFrames = [];
      for (let local = boundary + 4; local >= boundary - 4; local -= 1) {
        slowFrames.push(await setLocal(page, layout.shellStart, local));
      }
      let slowUpMaxPoseShift = 0;
      let slowUpMaxVisibleDelta = 0;
      for (let index = 1; index < slowFrames.length; index += 1) {
        const delta = frameDelta(slowFrames[index - 1], slowFrames[index]);
        slowUpMaxPoseShift = Math.max(slowUpMaxPoseShift, delta.sharedPoseShift);
        slowUpMaxVisibleDelta = Math.max(slowUpMaxVisibleDelta, delta.visibleHeightDelta);
      }
      const slowDownFrames = [];
      for (let local = boundary - 4; local <= boundary + 4; local += 1) {
        slowDownFrames.push(await setLocal(page, layout.shellStart, local));
      }
      let slowDownMaxPoseShift = 0;
      let slowDownMaxVisibleDelta = 0;
      for (let index = 1; index < slowDownFrames.length; index += 1) {
        const delta = frameDelta(slowDownFrames[index - 1], slowDownFrames[index]);
        slowDownMaxPoseShift = Math.max(slowDownMaxPoseShift, delta.sharedPoseShift);
        slowDownMaxVisibleDelta = Math.max(slowDownMaxVisibleDelta, delta.visibleHeightDelta);
      }

      // Quick repeated reversals return to the same scroll-derived pose; the
      // middle visits are deliberately on opposite sides of the same owner.
      const rapidStart = await setLocal(page, layout.shellStart, boundary - 2);
      await setLocal(page, layout.shellStart, boundary + 2);
      await setLocal(page, layout.shellStart, boundary - 2);
      const rapidReturn = await setLocal(page, layout.shellStart, boundary - 2);
      const rapidDelta = frameDelta(rapidStart, rapidReturn);

      const result = {
        current: layout.heroes[current].slug,
        previous: layout.heroes[current - 1].slug,
        boundary,
        down: { before: downBefore, after: downAfter, ...downDelta },
        up: { before: downAfter, after: upAfter, ...upDelta },
        partial: { start: partialStart, reversed: partialReverse, returned: partialReturn, ...partialDelta },
        slow: { upMaxPoseShift: slowUpMaxPoseShift, upMaxVisibleDelta: slowUpMaxVisibleDelta, downMaxPoseShift: slowDownMaxPoseShift, downMaxVisibleDelta: slowDownMaxVisibleDelta },
        rapid: { start: rapidStart, returned: rapidReturn, ...rapidDelta },
      };
      console.log(`${locale} ${result.previous}/${result.current}`, JSON.stringify({
        down: { pose: downDelta.sharedPoseShift, visible: downDelta.visibleHeightDelta, dropped: downDelta.droppedLayers.length },
        up: { pose: upDelta.sharedPoseShift, visible: upDelta.visibleHeightDelta, dropped: upDelta.droppedLayers.length },
        slowUp: { pose: slowUpMaxPoseShift, visible: slowUpMaxVisibleDelta },
        slowDown: { pose: slowDownMaxPoseShift, visible: slowDownMaxVisibleDelta },
      }));
      boundaries.push(result);
      expect(downBefore.visible.length, `${locale} ${result.previous}/${result.current} down crossing has a visible deck`).toBeGreaterThan(0);
      expect(downAfter.visible.length, `${locale} ${result.previous}/${result.current} down crossing has a visible deck`).toBeGreaterThan(0);
      expect(upAfter.visible.length, `${locale} ${result.previous}/${result.current} up crossing has a visible deck`).toBeGreaterThan(0);
      expect(upAfter.reverse, `${locale} ${result.previous}/${result.current} up crossing retains reverse ownership`).toBe(true);
      if (current < 11) {
        expect(downAfter.reverse, `${locale} ${result.previous}/${result.current} internal down crossing retains reverse ownership`).toBe(true);
        expect(downDelta.droppedLayers, `${locale} ${result.previous}/${result.current} internal down reversal drops no stacked banner`).toEqual([]);
        for (const heroIndex of upBefore.visible.filter((index) => index < current)) {
          expect(upAfter.visible, `${locale} ${result.previous}/${result.current} previously stacked banner ${heroIndex} remains visible on up crossing`)
            .toContain(heroIndex);
        }
        for (const heroIndex of upDelta.droppedLayers) {
          expect(heroIndex, `${locale} ${result.previous}/${result.current} upward boundary only removes a later owner leaving the viewport`)
            .toBeGreaterThanOrEqual(current);
        }
        for (const heroIndex of upAfter.visible.filter((index) => index < current)) {
          expect(downAfter.visible, `${locale} ${result.previous}/${result.current} previously stacked banner ${heroIndex} remains visible on reversal`)
            .toContain(heroIndex);
        }
      } else {
        expect(downAfter.reverse, `${locale} Muslim entry releases reverse ownership after crossing back down`).toBe(false);
      }
      for (const frame of [downBefore, downAfter, upAfter]) {
        for (const hero of frame.heroes.filter((item) => item.visiblePx > 0.5)) {
          expect(hero.visibility, `${locale} ${result.previous}/${result.current} ${hero.slug} visible card CSS state`).toBe('visible');
          expect(hero.opacity, `${locale} ${result.previous}/${result.current} ${hero.slug} visible card opacity`).toBeGreaterThan(0.9);
          expect(hero.display, `${locale} ${result.previous}/${result.current} ${hero.slug} visible card display`).not.toBe('none');
        }
        if (frame.pinned) {
          expect(frame.maxInteriorGap, `${locale} ${result.previous}/${result.current} stage has no interior gap`).toBeLessThanOrEqual(1);
        }
      }
      expect(downDelta.sharedPoseShift, `${locale} ${result.previous}/${result.current} immediate down pose continuity`).toBeLessThanOrEqual(8);
      expect(downDelta.visibleHeightDelta, `${locale} ${result.previous}/${result.current} immediate down clip continuity`).toBeLessThanOrEqual(64);
      expect(upDelta.sharedPoseShift, `${locale} ${result.previous}/${result.current} immediate up pose continuity`).toBeLessThanOrEqual(8);
      expect(upDelta.visibleHeightDelta, `${locale} ${result.previous}/${result.current} immediate up clip continuity`).toBeLessThanOrEqual(64);
      expect(upDelta.droppedLayers.length, `${locale} ${result.previous}/${result.current} no layer disappears on up crossing`).toBeLessThanOrEqual(1);
      if (current === 11) {
        expect(downAfter.activeSlug, `${locale}: the reverse deck returns to its normal Muslim owner after the entry boundary`).toBe('muslim');
      }
      expect(partialReturn.heroes.map((hero) => [hero.relativeY, hero.visiblePx, hero.clipTop, hero.clipBottom]),
        `${locale} ${result.previous}/${result.current} partial reversal returns to the same pose`)
        .toEqual(partialStart.heroes.map((hero) => [hero.relativeY, hero.visiblePx, hero.clipTop, hero.clipBottom]));
      expect(partialDelta.sharedPoseShift, `${locale} ${result.previous}/${result.current} partial reversal pose`).toBe(0);
      expect(partialDelta.visibleHeightDelta, `${locale} ${result.previous}/${result.current} partial reversal clipping`).toBe(0);
      expect(slowUpMaxPoseShift, `${locale} ${result.previous}/${result.current} slow up step`).toBeLessThanOrEqual(8);
      expect(slowUpMaxVisibleDelta, `${locale} ${result.previous}/${result.current} slow up clipping`).toBeLessThanOrEqual(64);
      expect(slowDownMaxPoseShift, `${locale} ${result.previous}/${result.current} slow down step`).toBeLessThanOrEqual(8);
      expect(slowDownMaxVisibleDelta, `${locale} ${result.previous}/${result.current} slow down clipping`).toBeLessThanOrEqual(64);
      for (const frame of [...slowFrames, ...slowDownFrames].filter((sample) => sample.pinned)) {
        if (frame.maxInteriorGap > 1) console.log(`${locale} ${result.previous}/${result.current} gap`, JSON.stringify({ local: frame.local, gap: frame.maxInteriorGap, largest: frame.largestInteriorGap, heroes: frame.heroes.filter((hero) => hero.visiblePx > 0.5).map((hero) => ({ slug: hero.slug, y: hero.relativeY, height: hero.height, clipBottom: hero.clipBottom, visiblePx: hero.visiblePx, strip: hero.strip })) }));
        expect(frame.maxInteriorGap, `${locale} ${result.previous}/${result.current} slow scrub has no interior gap`).toBeLessThanOrEqual(1);
      }
      expect(rapidDelta.sharedPoseShift, `${locale} ${result.previous}/${result.current} rapid return pose`).toBe(0);
      expect(rapidDelta.visibleHeightDelta, `${locale} ${result.previous}/${result.current} rapid return clipping`).toBe(0);

      if (locale === 'ar' && ['books', 'plush', 'collect', 'kids'].includes(result.current)) {
        await setLocal(page, layout.shellStart, boundary - 2);
        await page.screenshot({ path: path.join(evidenceDir, `${result.previous}-${result.current}-boundary-before.png`), animations: 'disabled' });
        await setLocal(page, layout.shellStart, boundary + 2);
        await page.screenshot({ path: path.join(evidenceDir, `${result.previous}-${result.current}-boundary-after.png`), animations: 'disabled' });
      }
    }

    expect(pageErrors, `${locale}: no runtime errors during the full boundary matrix`).toEqual([]);
    const report = { locale, layout, enteredReverse, boundaries };
    fs.writeFileSync(path.join(evidenceDir, `all-boundaries-${locale}.json`), JSON.stringify(report, null, 2));
    reports.push(report);
    await context.close();
  }
  expect(reports.map((report) => report.boundaries.length)).toEqual([11, 11]);
});

test('real-content tablet and desktop keep all 12 banner dimensions, media, logos, and product lanes', async ({ browser }) => {
  test.setTimeout(120_000);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const cases = [
    { width: 1024, height: 768, name: 'tablet-1024x768' },
    { width: 1366, height: 768, name: 'desktop-1366x768' },
  ];
  const reports = [];

  for (const viewport of cases) {
    for (const locale of ['ar', 'en']) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: false,
        hasTouch: viewport.width <= 1100,
        deviceScaleFactor: 1,
        locale: locale === 'ar' ? 'ar' : 'en-US',
      });
      await context.addInitScript((language) => {
        localStorage.setItem('play-language', language);
        if (document.documentElement) document.documentElement.style.scrollBehavior = 'auto';
        document.addEventListener('DOMContentLoaded', () => {
          document.documentElement.style.scrollBehavior = 'auto';
        }, { once: true });
      }, locale);
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
      await installRealContentFixture(page, locale);
      await page.goto('http://127.0.0.1:4173/?view=showcases', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelectorAll('#showcases .hero-stage > .home-brand').length === 12);
      await page.locator('#showcases').scrollIntoViewIfNeeded();
      await page.evaluate(() => {
        document.querySelectorAll('#showcases .brand-showcase__image').forEach((image) => { image.loading = 'eager'; });
      });
      await page.waitForFunction(() => {
        const images = [...document.querySelectorAll('#showcases .brand-showcase__image')];
        return images.length === 12 && images.every((image) => image.complete && image.naturalWidth > 0);
      });
      await page.waitForFunction(() => {
        const logos = [...document.querySelectorAll('#showcases .brand-showcase__brand-logo')];
        return logos.length === 12 && logos.every((logo) => logo.complete && logo.naturalWidth > 0);
      });
      await page.evaluate(async () => {
        const images = [...document.querySelectorAll('#showcases .brand-showcase__image, #showcases .brand-showcase__brand-logo')];
        await Promise.all(images.map((image) => image.decode()));
      });
      const layout = await page.evaluate(() => {
        const root = document.querySelector('#showcases');
        const stage = root.querySelector('.hero-stage');
        const sections = [...stage.querySelectorAll(':scope > .home-brand')];
        const stageHeight = sections[0].querySelector('.brand-showcase').getBoundingClientRect().height;
        return {
          stageHeight,
          pinHeight: stage.getBoundingClientRect().height,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
          heroes: sections.map((section) => {
            const banner = section.querySelector('.brand-showcase');
            const image = banner.querySelector('.brand-showcase__image');
            const logo = banner.querySelector('.brand-showcase__brand-logo');
            const strip = section.querySelector('.home-brand__product-layer > .brand-strip');
            const rect = banner.getBoundingClientRect();
            return {
              slug: banner.querySelector('a[href*="/brands/"]')?.getAttribute('href')?.split('/').filter(Boolean).at(-1) || null,
              width: rect.width,
              height: rect.height,
              imageLoaded: image.complete && image.naturalWidth > 0,
              imageWidth: image.naturalWidth,
              imageFit: getComputedStyle(image).objectFit,
              logoLoaded: logo.complete && logo.naturalWidth > 0,
              stripHeight: strip?.offsetHeight || 0,
              stripCards: strip?.querySelectorAll('.brand-strip-card').length || 0,
            };
          }),
        };
      });
      expect(layout.heroes.map((hero) => hero.slug)).toEqual([
        'baby', 'kids', 'play', 'build', 'learn', 'create', 'games', 'move', 'collect', 'plush', 'books', 'muslim',
      ]);
      expect(layout.horizontalOverflow, `${viewport.name} ${locale}: no horizontal overflow`).toBe(false);
      expect(layout.heroes).toHaveLength(12);
      for (const hero of layout.heroes) {
        expect(hero.width, `${viewport.name} ${locale} ${hero.slug}: banner width`).toBeCloseTo(viewport.width, 0);
        expect(hero.height, `${viewport.name} ${locale} ${hero.slug}: full-size banner height`).toBeCloseTo(layout.stageHeight, 0);
        expect(hero.imageLoaded, `${viewport.name} ${locale} ${hero.slug}: real banner image`).toBe(true);
        expect(hero.imageFit, `${viewport.name} ${locale} ${hero.slug}: approved crop fit`).toBe('cover');
        expect(hero.logoLoaded, `${viewport.name} ${locale} ${hero.slug}: real brand logo`).toBe(true);
      }
      if (viewport.width >= 1101) {
        expect(layout.stageHeight, `${viewport.name} ${locale}: desktop banner still fills its pinned stage`).toBeCloseTo(layout.pinHeight, 0);
      } else {
        expect(layout.stageHeight, `${viewport.name} ${locale}: tablet banner remains shorter than its pin`).toBeLessThan(layout.pinHeight);
      }
      expect(layout.heroes.some((hero) => hero.stripHeight > 0 && hero.stripCards > 0), `${viewport.name} ${locale}: real product lanes remain present`).toBe(true);
      expect(pageErrors, `${viewport.name} ${locale}: no runtime errors`).toEqual([]);
      await page.screenshot({ path: path.join(evidenceDir, `${viewport.name}-${locale}-banner-geometry.png`), animations: 'disabled' });
      reports.push({ viewport, locale, layout });
      await context.close();
    }
  }
  fs.writeFileSync(path.join(evidenceDir, 'tablet-desktop-geometry.json'), JSON.stringify(reports, null, 2));
});
