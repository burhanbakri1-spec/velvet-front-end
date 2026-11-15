import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { installRealContentFixture } from './realContentFixture.js';

const cases = [
  { width: 1024, height: 768, label: 'tablet-1024x768' },
  { width: 1280, height: 800, label: 'desktop-1280x800' },
  { width: 1366, height: 768, label: 'desktop-1366x768' },
  { width: 1440, height: 900, label: 'desktop-1440x900' },
  { width: 1920, height: 1080, label: 'desktop-1920x1080' },
];
const locales = ['en', 'ar'];
const canonicalOrder = ['baby', 'kids', 'play', 'build', 'learn', 'create', 'games', 'move', 'collect', 'plush', 'books', 'muslim'];
const evidenceDirectory = path.join(path.resolve(process.env.PERF009_EVIDENCE_DIR || 'brand-motion-evidence'), 'perf009-desktop-parity');

async function waitFrames(page, count = 2) {
  await page.evaluate((frameCount) => new Promise((resolve) => {
    let remaining = frameCount;
    const next = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  }), count);
}

function expectStageCoverage(frame, label) {
  expect(frame.maxInteriorGap, `${label}: no gap between stacked banners and the active product lane`).toBeLessThanOrEqual(1);
  // A short final product lane can end above the bottom of the pinned viewport.
  // That white area is unused viewport space, not a seam between visible layers;
  // keep measuring it in the report while checking actual layer-to-layer gaps.
}

async function setLocal(page, shellStart, local) {
  await page.evaluate(({ top, localY }) => window.scrollTo({ top: Math.max(0, top + localY), behavior: 'instant' }), {
    top: shellStart,
    localY: local,
  });
  await waitFrames(page);
  return snapshot(page);
}

async function wheelBy(page, deltaY) {
  const before = await page.evaluate(() => scrollY);
  await page.mouse.move(Math.round(page.viewportSize().width / 2), Math.round(page.viewportSize().height / 2));
  await page.mouse.wheel(0, deltaY);
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 3_000, message: `native wheel ${deltaY}px changes document scroll` })
    .not.toBe(before);
  await waitFrames(page);
  return snapshot(page);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#showcases');
    const shell = root?.querySelector('.hero-stage-shell');
    const stage = root?.querySelector('.hero-stage');
    const stageRect = stage?.getBoundingClientRect();
    const header = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 88;
    const sections = [...(stage?.querySelectorAll(':scope > .home-brand') || [])];
    const heroes = sections.map((section, index) => {
      const hero = section.querySelector('.brand-showcase');
      const image = hero?.querySelector('.brand-showcase__image');
      const logo = hero?.querySelector('.brand-showcase__brand-logo');
      const style = getComputedStyle(hero);
      const imageStyle = image ? getComputedStyle(image) : null;
      const rect = hero.getBoundingClientRect();
      const imageRect = image?.getBoundingClientRect();
      const logoRect = logo?.getBoundingClientRect();
      const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
      const clips = style.clipPath.match(/-?\d*\.?\d+px/g)?.map((value) => Number.parseFloat(value)) || [];
      const clipTop = clips[0] || 0;
      const clipBottom = clips[2] || 0;
      const y = matrix.m42;
      const height = rect.height;
      const visibleTop = Math.max(0, y + clipTop);
      const visibleBottom = Math.min(stageRect?.height || 0, y + height - clipBottom);
      const logoTop = logoRect ? logoRect.top - (stageRect?.top || 0) : 0;
      const logoBottom = logoRect ? logoRect.bottom - (stageRect?.top || 0) : 0;
      const logoVisible = Math.max(0, Math.min(logoBottom, y + height - clipBottom, stageRect?.height || 0)
        - Math.max(logoTop, y + clipTop, 0));
      const strip = section.querySelector(':scope > .home-brand__product-layer > .brand-strip');
      const stripStyle = strip ? getComputedStyle(strip) : null;
      const stripY = strip ? new DOMMatrix(stripStyle.transform === 'none' ? undefined : stripStyle.transform).m42 : 0;
      const stripHeight = strip?.getBoundingClientRect().height || 0;
      const stripVisible = strip && !strip.classList.contains('is-concealed')
        ? Math.max(0, Math.min(stageRect?.height || 0, stripY + stripHeight) - Math.max(0, stripY))
        : 0;
      return {
        index,
        slug: hero?.querySelector('.brand-showcase__link')?.getAttribute('href')?.split('/').filter(Boolean).at(-1) || null,
        active: section.hasAttribute('data-active'),
        y,
        height,
        clipTop,
        clipBottom,
        visiblePx: Math.max(0, visibleBottom - Math.max(0, visibleTop)),
        logoVisiblePx: logoVisible,
        z: style.zIndex,
        visibility: style.visibility,
        opacity: Number(style.opacity),
        imageSrc: image?.currentSrc || image?.src || '',
        imageLoaded: Boolean(image?.complete && image.naturalWidth > 0),
        imageNaturalWidth: image?.naturalWidth || 0,
        imageBoxHeight: imageRect?.height || 0,
        imageFit: imageStyle?.objectFit || '',
        imagePosition: imageStyle?.objectPosition || '',
        logoLoaded: Boolean(logo?.complete && logo.naturalWidth > 0),
        logoNaturalWidth: logo?.naturalWidth || 0,
        clientTop: rect.top,
        clientBottom: rect.bottom,
        strip: strip ? {
          hidden: strip.classList.contains('is-concealed'),
          y: stripY,
          clientTop: strip.getBoundingClientRect().top,
          height: stripHeight,
          visiblePx: stripVisible,
          computedVisibility: stripStyle.visibility,
          computedOpacity: Number(stripStyle.opacity),
          productCount: strip.querySelectorAll('.brand-strip-card').length,
          loadedProducts: [...strip.querySelectorAll('.brand-strip-card__image')]
            .filter((item) => item.complete && item.naturalWidth > 0).length,
        } : null,
      };
    });
    const shellRect = shell?.getBoundingClientRect();
    const intervals = [
      ...heroes.map((hero) => ({ top: hero.y + hero.clipTop, bottom: hero.y + hero.height - hero.clipBottom, kind: 'hero' })),
      ...heroes.filter((hero) => hero.strip && !hero.strip.hidden)
        .map((hero) => ({ top: hero.strip.y, bottom: hero.strip.y + hero.strip.height, kind: 'strip' })),
    ].map((item) => ({ ...item, top: Math.max(0, item.top), bottom: Math.min(stageRect?.height || 0, item.bottom) }))
      .filter((item) => item.bottom > item.top)
      .sort((left, right) => left.top - right.top);
    let coveredTo = 0;
    let maxInteriorGap = 0;
    for (const interval of intervals) {
      if (interval.top > coveredTo + 1) maxInteriorGap = Math.max(maxInteriorGap, interval.top - coveredTo);
      coveredTo = Math.max(coveredTo, interval.bottom);
    }
    const tailGap = stageRect ? Math.max(0, stageRect.height - coveredTo) : 0;
    const maxGap = Math.max(maxInteriorGap, tailGap);
    return {
      scrollY,
      shellStart: shellRect ? shellRect.top + scrollY - header : 0,
      local: shellRect ? scrollY - (shellRect.top + scrollY - header) : 0,
      header,
      stageHeight: heroes[0]?.height || 0,
      pinHeight: Math.round((window.innerHeight - header) * 100) / 100,
      sceneHeight: stageRect?.height || 0,
      stageTop: stageRect?.top || 0,
      shellTop: shellRect?.top || 0,
      shellHeight: shellRect?.height || 0,
      bodyPinned: document.body.classList.contains('hero-stage-pin'),
      precedingSection: (() => {
        const previous = root?.previousElementSibling;
        const rect = previous?.getBoundingClientRect();
        return previous ? { label: previous.innerText?.trim().slice(0, 90) || previous.getAttribute('aria-label') || previous.tagName, top: rect?.top || 0, bottom: rect?.bottom || 0 } : null;
      })(),
      active: heroes.find((hero) => hero.active)?.slug || null,
      activeCount: heroes.filter((hero) => hero.active).length,
      phase: root?.getAttribute('data-home-reverse-phase') || null,
        reverse: Boolean(root?.getAttribute('data-home-reverse-phase')),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      maxGap,
      maxInteriorGap,
      tailGap,
      heroes,
    };
  });
}

async function waitForRealBannerAssets(page) {
  await expect.poll(() => page.locator('#showcases .brand-showcase__image').evaluateAll((images) => (
    images.length === 12 && images.every((image) => image.currentSrc.startsWith('https://api-staging.igroup.website/uploads/kids-velvet/')
      && image.complete && image.naturalWidth > 0)
  )), { timeout: 75_000, message: 'all 12 real Velvet banner media requests complete' }).toBe(true);
}

for (const viewport of cases) {
  test.skip(process.env.REAL_CONTENT_FIXTURE !== '1', 'requires the opt-in cached real-content fixture');
  test(`real-content Home deck parity ${viewport.label} Arabic and English`, async ({ browser }) => {
    test.setTimeout(360_000);
    fs.mkdirSync(evidenceDirectory, { recursive: true });
    const report = [];
    for (const locale of locales) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.width <= 760,
        hasTouch: viewport.width <= 1100,
        deviceScaleFactor: viewport.width <= 760 ? 1 : undefined,
        locale: locale === 'ar' ? 'ar' : 'en-US',
      });
      await context.addInitScript((language) => {
        localStorage.setItem('play-language', language);

      }, locale);
      const page = await context.newPage();
      const pageErrors = [];
      const failedMedia = [];
      page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
      page.on('requestfailed', (request) => {
        if (request.url().includes('/uploads/kids-velvet/') && request.failure()?.errorText !== 'net::ERR_ABORTED') {
          failedMedia.push({ url: request.url(), error: request.failure()?.errorText });
        }
      });
      await installRealContentFixture(page, locale, { includeBabyProductMedia: true });
      await page.goto('/?view=showcases', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#showcases[data-home-brand-deck] .home-brand')).toHaveCount(12);
      await waitForRealBannerAssets(page);
      await expect.poll(() => page.locator('#showcases .home-brand:first-child .brand-strip-card').count(), {
        timeout: 75_000,
        message: 'the read-only Staging catalog supplies eligible Baby products',
      }).toBeGreaterThan(0);
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');

      let state = await snapshot(page);
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), state.shellStart);
      await waitFrames(page);
      state = await snapshot(page);
      const layout = await page.evaluate(() => {
        const root = document.querySelector('#showcases');
        const stage = root.querySelector('.hero-stage');
        const sections = [...stage.querySelectorAll(':scope > .home-brand')];
        const stageHeight = sections[0].querySelector('.brand-showcase').getBoundingClientRect().height;
        let cursor = 0;
        const brands = sections.map((section) => {
          const hero = section.querySelector('.brand-showcase');
          const slug = hero.querySelector('.brand-showcase__link')?.getAttribute('href')?.split('/').filter(Boolean).at(-1);
          const offset = cursor;
          const strip = section.querySelector(':scope > .home-brand__product-layer > .brand-strip');
          const stripHeight = strip?.offsetHeight || 0;
          cursor += stageHeight + stripHeight;
          return { slug, offset, stripHeight, stripProducts: strip?.querySelectorAll('.brand-strip-card').length || 0 };
        });
        const shell = root.querySelector('.hero-stage-shell').getBoundingClientRect();
        const header = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 88;
        return {
          brands,
          stageHeight,
          pinHeight: Math.round((innerHeight - header) * 100) / 100,
          shellStart: shell.top + scrollY - header,
          span: cursor - (brands.at(-1).stripHeight || stageHeight),
        };
      });
      expect(layout.brands.map((brand) => brand.slug), `${viewport.label} ${locale} canonical brand order`).toEqual(canonicalOrder);
      expect(state.horizontalOverflow, `${viewport.label} ${locale} initial horizontal overflow`).toBe(false);
      expect(layout.stageHeight, `${viewport.label} ${locale} banner geometry`).toBeGreaterThan(0);
      expect(state.heroes, `${viewport.label} ${locale} all 12 full-size banners`).toHaveLength(12);
      for (const banner of state.heroes) {
        expect(banner.imageLoaded, `${viewport.label} ${locale} ${banner.slug} real banner image`).toBe(true);
        expect(banner.imageBoxHeight, `${viewport.label} ${locale} ${banner.slug} restored full-stage height`).toBeCloseTo(layout.stageHeight, 0);
        expect(banner.imageFit, `${viewport.label} ${locale} ${banner.slug} baseline cover crop`).toBe('cover');
        expect(banner.logoLoaded, `${viewport.label} ${locale} ${banner.slug} real brand logo`).toBe(true);
      }
      if (viewport.width >= 1101) expect(layout.stageHeight, `${viewport.label} desktop banner fills the original pinned stage`).toBeCloseTo(layout.pinHeight, 0);
      if (viewport.width === 1024) expect(layout.stageHeight, `${viewport.label} tablet banner fit`).toBeLessThan(layout.pinHeight);
      if (viewport.width === 1024) expect(layout.stageHeight, `${viewport.label} tablet minimum`).toBeGreaterThanOrEqual(160);
      if (viewport.width >= 1101) expect(Math.min(436, layout.stageHeight), `${viewport.label} overlay reverse stack room`).toBeGreaterThan(0);
      expect(layout.brands.find((brand) => brand.slug === 'baby')?.stripProducts, 'Baby has real eligible products').toBeGreaterThan(0);
      console.log(`${viewport.label} ${locale} real layout`, JSON.stringify(layout));

      const slideRows = [];
      const snapshotsByBoundary = [];
      const screenshotBase = `${viewport.label}-${locale}`;
      await page.screenshot({ path: path.join(evidenceDirectory, `${screenshotBase}-forward-start.png`) });

      // Walk the complete forward sequence through browser scroll positions.
      let lastForwardActive = -1;
      const finalBannerCenter = layout.brands.at(-1).offset + Math.round(layout.stageHeight * 0.5);
      for (let local = 0; local <= finalBannerCenter; local += Math.max(96, Math.round(layout.stageHeight * 0.38))) {
        const target = Math.min(local, finalBannerCenter);
        const next = await setLocal(page, layout.shellStart, target);
        expect(next.activeCount, `${screenshotBase} forward owner at ${target}`).toBe(1);
        expect(next.horizontalOverflow, `${screenshotBase} forward horizontal overflow at ${target}`).toBe(false);
        expectStageCoverage(next, `${screenshotBase} forward stage at ${target}`);
        const activeIndex = layout.brands.findIndex((brand) => brand.slug === next.active);
        expect(activeIndex, `${screenshotBase} forward brand is present and ordered at ${target}; state=${JSON.stringify({ active: next.active, scrollY: next.scrollY, local: next.local, phase: next.phase, reverse: next.reverse, lastForwardActive, activeIndex })}`).toBeGreaterThanOrEqual(lastForwardActive);
        expect(activeIndex, `${screenshotBase} forward brand order at ${target}; active=${next.active}`).toBeGreaterThanOrEqual(0);
        lastForwardActive = activeIndex;
      }
      const finalBanner = await setLocal(page, layout.shellStart, finalBannerCenter);
      expect(finalBanner.active, `${screenshotBase} final forward brand`).toBe('muslim');
      await page.screenshot({ path: path.join(evidenceDirectory, `${screenshotBase}-forward-terminal.png`) });

      const stackRoom = Math.max(0, layout.pinHeight - layout.stageHeight, Math.min(436, layout.stageHeight));
      const step = Math.min(58, stackRoom / Math.max(1, canonicalOrder.length - 1));
      // Cover every ownership pair from the end back to Baby. For each pair,
      // enter from its actual banner boundary, inspect the locked full stack,
      // then verify the outgoing banner alone moves while the older cards stay put.
      for (let current = canonicalOrder.length - 1; current > 0; current -= 1) {
        const boundary = layout.brands[current].offset;
        const lower = layout.brands[current - 1].offset;
        const localLock = boundary - current * step;
        const downStart = await setLocal(page, layout.shellStart, boundary + 3);
        expect(downStart.horizontalOverflow, `${screenshotBase} pair ${current} down start`).toBe(false);
        const crossed = await wheelBy(page, -8);
        expect(crossed.reverse, `${screenshotBase} pair ${current} reverse ownership`).toBe(true);
        const locked = await setLocal(page, layout.shellStart, localLock);
        expect(locked.phase, `${screenshotBase} pair ${current} lock phase`).toBe('banner');
        expect(locked.active, `${screenshotBase} pair ${current} active banner`).toBe(canonicalOrder[current]);
        expect(locked.sceneHeight, `${screenshotBase} pair ${current} pinned scene height`).toBeCloseTo(layout.pinHeight, 0);
        expect(locked.activeCount, `${screenshotBase} pair ${current} single active banner`).toBe(1);
        expectStageCoverage(locked, `${screenshotBase} pair ${current} locked stage`);
        expect(locked.horizontalOverflow, `${screenshotBase} pair ${current} no horizontal overflow`).toBe(false);
        for (const card of locked.heroes) {
          if (card.strip?.hidden) {
            expect(card.strip.computedVisibility, `${screenshotBase} pair ${current} concealed strip ${card.slug} is actually hidden`).toBe('hidden');
            expect(card.strip.computedOpacity, `${screenshotBase} pair ${current} concealed strip ${card.slug} is transparent`).toBe(0);
          }
        }
        for (let earlier = 0; earlier < current; earlier += 1) {
          const card = locked.heroes[earlier];
          expect(card.visiblePx, `${screenshotBase} ${card.slug} visible stack slice in ${canonicalOrder[current]}`).toBeGreaterThanOrEqual(Math.min(64, layout.stageHeight) - 1);
          expect(card.logoVisiblePx, `${screenshotBase} ${card.slug} logo portion remains visible in ${canonicalOrder[current]}`).toBeGreaterThan(0);
          expect(card.imageLoaded, `${screenshotBase} ${card.slug} real banner media`).toBe(true);
          expect(card.imageBoxHeight, `${screenshotBase} ${card.slug} fixed image height`).toBeCloseTo(layout.stageHeight, 0);
        }
        for (const later of locked.heroes.slice(current + 1)) {
          expect(later.visiblePx, `${screenshotBase} later brand ${later.slug} stays offstage`).toBe(0);
        }
        const midpointLocal = localLock - Math.max(4, Math.round((localLock - lower) * 0.45));
        const midpoint = await setLocal(page, layout.shellStart, midpointLocal);
        const nearEnd = await setLocal(page, layout.shellStart, Math.max(lower + 2, lower + Math.round((localLock - lower) * 0.02)));
        expect(midpoint.active, `${screenshotBase} pair ${current} midway owner`).toBe(canonicalOrder[current]);
        if (midpoint.heroes[current].y >= layout.pinHeight) {
          expect(midpoint.heroes[current].visiblePx, `${screenshotBase} pair ${current} offstage midpoint is not painted`).toBe(0);
          expect(nearEnd.heroes[current].visiblePx, `${screenshotBase} pair ${current} offstage endpoint is not painted`).toBe(0);
        } else {
          expect(nearEnd.heroes[current].y, `${screenshotBase} pair ${current} visible banner moves down progressively`).toBeGreaterThan(midpoint.heroes[current].y);
        }
        for (let earlier = 0; earlier < current; earlier += 1) {
          expect(midpoint.heroes[earlier].y, `${screenshotBase} pair ${current} older card ${canonicalOrder[earlier]} remains anchored`).toBe(locked.heroes[earlier].y);
          expect(nearEnd.heroes[earlier].y, `${screenshotBase} pair ${current} older card ${canonicalOrder[earlier]} remains anchored near end`).toBe(locked.heroes[earlier].y);
        }
        expectStageCoverage(midpoint, `${screenshotBase} pair ${current} midpoint`);
        expectStageCoverage(nearEnd, `${screenshotBase} pair ${current} near end`);
        for (const card of midpoint.heroes) {
          if (card.strip?.hidden) {
            expect(card.strip.computedVisibility, `${screenshotBase} pair ${current} hidden strip ${card.slug} does not leak into the scene`).toBe('hidden');
            expect(card.strip.computedOpacity, `${screenshotBase} pair ${current} hidden strip ${card.slug} has no visible paint`).toBe(0);
          }
        }
        const visibleStrips = midpoint.heroes.filter((hero) => hero.strip && hero.strip.visiblePx > 1);
        expect(visibleStrips.length, `${screenshotBase} pair ${current} only the outgoing lane may enter`).toBeLessThanOrEqual(1);
        for (const stripOwner of visibleStrips) {
          expect(stripOwner.slug, `${screenshotBase} pair ${current} strip belongs to outgoing banner`).toBe(canonicalOrder[current]);
          expect(Math.abs(stripOwner.strip.y - stripOwner.y - layout.stageHeight),
            `${screenshotBase} pair ${current} product lane remains attached under its banner`).toBeLessThanOrEqual(1);
        }

        if ([1, 5, 10, 11].includes(current)) {
          await setLocal(page, layout.shellStart, localLock);
          await page.screenshot({ path: path.join(evidenceDirectory, `${screenshotBase}-pair-${canonicalOrder[current - 1]}-${canonicalOrder[current]}-locked.png`) });
          await setLocal(page, layout.shellStart, midpointLocal);
          await page.screenshot({ path: path.join(evidenceDirectory, `${screenshotBase}-pair-${canonicalOrder[current - 1]}-${canonicalOrder[current]}-mid.png`) });
        }

        // Scrub across the same boundary in both directions, then return to the
        // same scroll-derived pose. This exposes stale offstage transforms.
        const reversePoint = Math.max(lower + 2, Math.round((localLock + midpointLocal) / 2));
        const firstPose = await setLocal(page, layout.shellStart, reversePoint);
        await wheelBy(page, 12);
        const retraced = await wheelBy(page, -12);
        expect(retraced.active, `${screenshotBase} pair ${current} reversal owner stable`).toBe(firstPose.active);
        if (firstPose.heroes[current].visiblePx > 0 || retraced.heroes[current].visiblePx > 0) {
          expect(Math.abs(retraced.heroes[current].y - firstPose.heroes[current].y),
            `${screenshotBase} pair ${current} visible re-entry ${canonicalOrder[current]} has no stale pose`).toBeLessThanOrEqual(1);
        }
        for (let earlier = 0; earlier < current; earlier += 1) {
          expect(Math.abs(retraced.heroes[earlier].y - firstPose.heroes[earlier].y),
            `${screenshotBase} pair ${current} re-entry ${canonicalOrder[earlier]} has no jump`).toBeLessThanOrEqual(1);
          expect(retraced.heroes[earlier].visiblePx, `${screenshotBase} pair ${current} re-entry ${canonicalOrder[earlier]} remains visible`).toBeGreaterThan(0);
        }
        snapshotsByBoundary.push({
          current: canonicalOrder[current],
          previous: canonicalOrder[current - 1],
          boundary,
          lockLocal: localLock,
          stackStep: step,
          lockVisible: locked.heroes.slice(0, current).map((hero) => ({ slug: hero.slug, visiblePx: hero.visiblePx, logoVisiblePx: hero.logoVisiblePx, y: hero.y, z: hero.z })),
          midpoint: { activeY: midpoint.heroes[current].y, phase: midpoint.phase, maxGap: midpoint.maxGap },
          nearEnd: { activeY: nearEnd.heroes[current].y, previousVisiblePx: nearEnd.heroes[current - 1].visiblePx, maxGap: nearEnd.maxGap },
        });
      }

      const preBoundary = await setLocal(page, layout.shellStart, 2);
      await page.screenshot({ path: path.join(evidenceDirectory, `${screenshotBase}-baby-boundary-plus-2.png`) });
      const babyState = await setLocal(page, layout.shellStart, 0);
      await page.screenshot({ path: path.join(evidenceDirectory, `${screenshotBase}-baby-boundary-zero.png`) });
      const documentExit = await setLocal(page, layout.shellStart, -2);
      await page.screenshot({ path: path.join(evidenceDirectory, `${screenshotBase}-baby-document-exit-minus-2.png`) });
      const precedingFrames = [];
      for (const offset of [-8, -16, -32, -48]) {
        const frame = await setLocal(page, layout.shellStart, offset);
        precedingFrames.push(frame);
        await page.screenshot({ path: path.join(evidenceDirectory, `${screenshotBase}-baby-document-${Math.abs(offset)}px.png`) });
      }
      const boundaryFrames = [
        { offset: 2, ...preBoundary },
        { offset: 0, ...babyState },
        { offset: -2, ...documentExit },
        ...precedingFrames.map((frame, index) => ({ offset: [-8, -16, -32, -48][index], ...frame })),
      ];
      const boundarySummary = boundaryFrames.map(({ offset, ...frame }) => ({
        offset,
        scrollY: frame.scrollY,
        local: frame.local,
        active: frame.active,
        phase: frame.phase,
        bodyPinned: frame.bodyPinned,
        stageTop: frame.stageTop,
        sceneHeight: frame.sceneHeight,
        maxGap: frame.maxGap,
        precedingSection: frame.precedingSection,
        baby: {
          clientTop: frame.heroes[0].clientTop,
          height: frame.heroes[0].height,
          visiblePx: frame.heroes[0].visiblePx,
          stripHidden: frame.heroes[0].strip.hidden,
          stripVisibility: frame.heroes[0].strip.computedVisibility,
        },
        leakingStrips: frame.heroes.filter((hero) => hero.strip?.hidden && hero.strip.computedVisibility !== 'hidden').map((hero) => hero.slug),
      }));
      console.log(`${screenshotBase} Baby document-boundary frames`, JSON.stringify(boundarySummary));      expect(babyState.active).toBe('baby');
      expect(babyState.reverse).toBe(true);
      const baby = babyState.heroes[0];
      expect(baby.imageLoaded, `${screenshotBase} Baby real banner asset`).toBe(true);
      expect(baby.height, `${screenshotBase} Baby fixed responsive height`).toBeCloseTo(layout.stageHeight, 0);
      expect(baby.strip?.hidden, `${screenshotBase} Baby product strip restored when settled`).toBe(false);
      expect(baby.strip?.productCount, `${screenshotBase} Baby strip contains real catalog products`).toBeGreaterThan(0);
      expectStageCoverage(babyState, `${screenshotBase} Baby settled stage`);
      for (const frame of boundaryFrames) {
        expect(frame.heroes[0].visiblePx, `${screenshotBase} Baby stays visible at document boundary offset ${frame.local}`).toBeGreaterThan(0);
        expectStageCoverage(frame, `${screenshotBase} Baby boundary offset ${frame.local}`);
        expect(frame.heroes.filter((hero) => hero.strip?.hidden && hero.strip.computedVisibility !== 'hidden'),
          `${screenshotBase} boundary offset ${frame.local} hides every concealed strip`).toHaveLength(0);
      }
      expect(precedingFrames.at(-1).precedingSection?.label).toContain(
        locale === 'ar' ? 'ألعاب تناسب كل عمر' : 'Toys for Every Age',
      );
      expect(precedingFrames.at(-1).precedingSection.bottom, `${screenshotBase} Toys section re-enters viewport`).toBeGreaterThan(0);
      expect(Math.abs(documentExit.heroes[0].clientTop - babyState.heroes[0].clientTop), `${screenshotBase} Baby moves continuously across stage-to-document boundary`).toBeLessThanOrEqual(4);
      expect(documentExit.bodyPinned, `${screenshotBase} stage releases to document ownership above deck start`).toBe(false);
      for (const frame of precedingFrames) expect(frame.scrollY, `${screenshotBase} native document continues scrolling before deck`).toBeLessThan(babyState.scrollY);

      await expect.poll(() => page.locator('#showcases .home-brand:first-child .brand-strip-card__image').evaluateAll((images) => (
        images.some((image) => image.complete && image.naturalWidth > 0)
      )), { timeout: 45_000, message: 'real Baby product image loads on the strip' }).toBe(true);
      await page.screenshot({ path: path.join(evidenceDirectory, `${screenshotBase}-baby-settled-strip.png`) });

      expect(pageErrors, `${screenshotBase} page errors`).toEqual([]);
      expect(failedMedia, `${screenshotBase} real media request failures`).toEqual([]);
      report.push({
        viewport,
        locale,
        layout,
        banners: state.heroes.map(({ slug, height, imageBoxHeight, imageNaturalWidth, imageFit, imagePosition, imageSrc, logoLoaded, logoNaturalWidth }) => ({
          slug, height, imageBoxHeight, imageNaturalWidth, imageFit, imagePosition, imageSrc, logoLoaded, logoNaturalWidth,
        })),
        baby: { height: baby.height, productCount: baby.strip?.productCount, loadedProducts: baby.strip?.loadedProducts },
        boundaryFrames: boundarySummary,
        boundaries: snapshotsByBoundary,
      });
      await context.close();
    }
    fs.writeFileSync(path.join(evidenceDirectory, `${viewport.label}-summary.json`), JSON.stringify(report, null, 2));
  });
}
