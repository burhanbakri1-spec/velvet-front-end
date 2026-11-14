import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installRealContentFixture } from './realContentFixture.js';

const sizes = process.env.REVIEW_WIDTH ? [Number(process.env.REVIEW_WIDTH)] : process.env.REVIEW_QUICK === '1' ? [375] : [375, 390, 412];
const locales = process.env.REVIEW_LOCALE ? [process.env.REVIEW_LOCALE] : process.env.REVIEW_QUICK === '1' ? [process.env.REVIEW_AR === '1' ? 'ar' : 'en'] : ['en', 'ar'];
const frames = [0, 25, 50, 75, 100];
const mediaWait = Number(process.env.REAL_MEDIA_WAIT_MS) || 45_000;
const transitions = [
  { current: 'move', previous: 'games', currentIndex: 7, previousIndex: 6, name: 'move-games' },
  { current: 'create', previous: 'learn', currentIndex: 5, previousIndex: 4, name: 'create-learn' },
  { current: 'muslim', previous: 'books', currentIndex: 11, previousIndex: 10, name: 'muslim-books' },
];

async function scrollByWheel(page, deltaY) {
  const viewport = page.viewportSize();
  await page.mouse.move(Math.round(viewport.width / 2), Math.round(viewport.height / 3));
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, deltaY);
  for (let frame = 0; frame < 40; frame += 1) {
    await page.waitForTimeout(20);
    if (await page.evaluate(() => scrollY) !== before) break;
  }
  await page.waitForTimeout(60);
  return { before, after: await page.evaluate(() => scrollY) };
}

async function moveToScrollY(page, targetY) {
  let movement = { before: await page.evaluate(() => scrollY), after: await page.evaluate(() => scrollY) };
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const current = await page.evaluate(() => scrollY);
    const distance = targetY - current;
    if (Math.abs(distance) <= 2) return { ...movement, targetY, settledY: current };
    movement = await scrollByWheel(page, Math.sign(distance) * Math.min(160, Math.abs(distance)));
  }
  const settledY = await page.evaluate(() => scrollY);
  expect(Math.abs(settledY - targetY), `native wheel input reaches requested frame within 2px; target=${targetY}, actual=${settledY}`).toBeLessThanOrEqual(2);
  return { ...movement, targetY, settledY };
}

async function waitForNativeScrollSettle(page) {
  let previous = await page.evaluate(() => scrollY);
  let stable = 0;
  for (let frame = 0; frame < 120 && stable < 4; frame += 1) {
    await page.waitForTimeout(40);
    const current = await page.evaluate(() => scrollY);
    stable = current === previous ? stable + 1 : 0;
    previous = current;
  }
  expect(stable, 'preview navigation finishes its initial scroll before native gesture input').toBe(4);
}

async function installNativeScrollProbe(page) {
  await page.evaluate(() => {
    window.__nativeScrollProbe = { wheels: [], touchMoves: [], scrolls: [] };
    window.addEventListener('wheel', (event) => window.__nativeScrollProbe.wheels.push({
      deltaY: event.deltaY, cancelable: event.cancelable, defaultPrevented: event.defaultPrevented,
      target: `${event.target?.tagName}.${event.target?.className || ''}`,
      time: Math.round(performance.now()),
    }), { passive: true });
    window.addEventListener('touchmove', (event) => window.__nativeScrollProbe.touchMoves.push({
      cancelable: event.cancelable, defaultPrevented: event.defaultPrevented, touches: event.touches.length,
      target: `${event.target?.tagName}.${event.target?.className || ''}`,
      time: Math.round(performance.now()),
    }), { passive: false });
    window.addEventListener('scroll', () => window.__nativeScrollProbe.scrolls.push({ y: scrollY, time: Math.round(performance.now()) }), { passive: true });
  });
}

async function visibleLogoHeight(page, brand) {
  return page.evaluate((slug) => {
    const section = [...document.querySelectorAll('#showcases .home-brand')].find((item) =>
      item.querySelector('.brand-showcase__link')?.getAttribute('href')?.endsWith(`/brands/${slug}`));
    const hero = section?.querySelector('.brand-showcase');
    const logo = hero?.querySelector('.brand-showcase__brand-logo');
    const heroRect = hero?.getBoundingClientRect();
    const logoRect = logo?.getBoundingClientRect();
    const stageRect = document.querySelector('#showcases .hero-stage')?.getBoundingClientRect();
    const clips = getComputedStyle(hero).clipPath.match(/[\d.]+px/g)?.map((value) => Number.parseFloat(value)) || [];
    if (!heroRect || !logoRect || !stageRect) return 0;
    return Math.max(0, Math.min(logoRect.bottom, heroRect.bottom - (clips[2] || 0), stageRect.bottom)
      - Math.max(logoRect.top, heroRect.top + (clips[0] || 0), stageRect.top));
  }, brand);
}

test('captures the mobile reverse deck across brands, sizes, and languages', async ({ browser }) => {
  test.setTimeout(300_000);
  const evidence = path.resolve('brand-motion-evidence', 'stack-architecture');
  fs.mkdirSync(evidence, { recursive: true });
  const measurements = [];

  for (const width of sizes) {
    for (const locale of locales) {
      const context = await browser.newContext({
        viewport: { width, height: 812 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
        locale: locale === 'ar' ? 'ar' : 'en-US',
      });
      await context.addInitScript((value) => {
        localStorage.setItem('play-language', value);
        // The showcase preview performs one smooth scrollIntoView on mount.
        // Disable only that preview navigation animation so native wheel input
        // starts from a settled page; the deck motion remains scroll-driven.
        if (document.documentElement) document.documentElement.style.scrollBehavior = 'auto';
      }, locale);
      const page = await context.newPage();
      const failedImageRequests = [];
      const realMediaResponses = [];
      const completedMediaRequests = [];
      page.on('requestfailed', (request) => {
        const failure = request.failure()?.errorText;
        if (/\.(?:png|jpe?g|webp|svg)(?:\?|$)/i.test(request.url()) && failure !== 'net::ERR_ABORTED') {
          failedImageRequests.push({ url: request.url(), failure });
        }
      });
      page.on('response', (response) => {
        if (response.url().includes('/uploads/kids-velvet/') && /\.(?:png|jpe?g|webp|svg)(?:\?|$)/i.test(response.url())) {
          realMediaResponses.push({ url: response.url(), status: response.status() });
        }
      });
      page.on('requestfinished', (request) => {
        if (request.url().includes('/uploads/kids-velvet/') && /\.(?:png|jpe?g|webp|svg)(?:\?|$)/i.test(request.url())) completedMediaRequests.push(request.url());
      });
      await installRealContentFixture(page, locale);
      console.log(`Opening ${width}px ${locale}`);
      await page.goto('/?view=showcases', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#showcases[data-home-brand-deck] .home-brand')).toHaveCount(12);
      await waitForNativeScrollSettle(page);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await waitForNativeScrollSettle(page);
      await installNativeScrollProbe(page);
      await page.waitForTimeout(250);

      for (const [pairIndex, transition] of transitions.entries()) {
        console.log(`Capturing ${transition.name}`);
        if (pairIndex > 0) {
          await page.reload({ waitUntil: 'domcontentloaded' });
          await expect(page.locator('#showcases[data-home-brand-deck] .home-brand')).toHaveCount(12);
          await waitForNativeScrollSettle(page);
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
          await waitForNativeScrollSettle(page);
          await installNativeScrollProbe(page);
        }
        const setup = await page.evaluate(({ currentIndex, previousIndex }) => {
          const root = document.querySelector('#showcases');
          const stage = root.querySelector('.hero-stage');
          const sections = [...stage.querySelectorAll(':scope > .home-brand')];
          const shell = root.querySelector('.hero-stage-shell');
          const headerHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 72;
          const viewportHeight = root.querySelector('[data-hero-viewport]')?.getBoundingClientRect().height || window.innerHeight;
          const stageHeight = Math.max(160, Math.round((viewportHeight - headerHeight) / 2));
          let offset = 0;
          const offsets = sections.map((section) => {
            const result = offset;
            const strip = section.querySelector(':scope > .home-brand__product-layer > .brand-strip');
            const stripHeight = strip ? strip.offsetHeight || stageHeight : 0;
            offset += stageHeight + stripHeight;
            return result;
          });
          return {
            currentIndex,
            previousIndex,
            start: offsets[previousIndex],
            end: offsets[currentIndex],
            rootTop: shell.getBoundingClientRect().top + scrollY - headerHeight,
          };
        }, transition);
        expect(setup.currentIndex).toBeGreaterThan(setup.previousIndex);
        expect(setup.currentIndex - setup.previousIndex).toBe(1);

        // Start from the settled current banner, then use real upward input
        // and keep every frame sample moving monotonically through the deck.
        const settledY = setup.rootTop + setup.end;
        const forwardTarget = settledY + 100;
        for (let step = 0; step < 80 && await page.evaluate(() => scrollY) < forwardTarget - 2; step += 1) {
          const remaining = forwardTarget - await page.evaluate(() => scrollY);
          const movement = await scrollByWheel(page, Math.min(280, remaining));
          if (movement.after <= movement.before) {
            const blocked = await page.evaluate(() => {
              const root = document.querySelector('#showcases');
              const shell = root?.querySelector('.hero-stage-shell');
              const stage = root?.querySelector('.hero-stage');
              const rect = (element) => {
                const box = element?.getBoundingClientRect();
                return box && { top: box.top, bottom: box.bottom, height: box.height };
              };
              return {
                scrollY, scrollHeight: document.documentElement.scrollHeight, clientHeight: document.documentElement.clientHeight,
                bodyClass: document.body.className, bodyOverflow: getComputedStyle(document.body).overflow,
                htmlOverflow: getComputedStyle(document.documentElement).overflow,
                active: root?.querySelector('.home-brand[data-active] .brand-showcase__link')?.getAttribute('href'),
                shell: rect(shell), stage: rect(stage), root: rect(root),
                probe: window.__nativeScrollProbe,
                targetAtCenter: (() => {
                  const element = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
                  const style = element && getComputedStyle(element);
                  return element && { tag: element.tagName, className: String(element.className || ''), overflowX: style.overflowX, overflowY: style.overflowY, touchAction: style.touchAction, overscrollBehavior: style.overscrollBehavior };
                })(),
              };
            });
            throw new Error(`Native forward scroll stopped unexpectedly: ${JSON.stringify({ step, movement, remaining, forwardTarget, blocked, failedImageRequests })}`);
          }
        }
        expect(await page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(settledY + 50);
        const phaseABefore = await page.evaluate((brandIndex) => {
          const root = document.querySelector('#showcases');
          const section = root.querySelectorAll('.home-brand')[brandIndex];
          const strip = section.querySelector('.brand-strip');
          return {
            scrollY,
            reverse: root.hasAttribute('data-mobile-hero-up'),
            phase: root.getAttribute('data-mobile-reverse-phase'),
            stripY: strip ? new DOMMatrix(getComputedStyle(strip).transform).m42 : null,
            stripHidden: strip?.classList.contains('is-concealed'),
          };
        }, transition.currentIndex);
        const naturalReturn = await scrollByWheel(page, -40);
        const phaseAAfter = await page.evaluate((brandIndex) => {
          const root = document.querySelector('#showcases');
          const section = root.querySelectorAll('.home-brand')[brandIndex];
          const strip = section.querySelector('.brand-strip');
          return {
            reverse: root.hasAttribute('data-mobile-hero-up'),
            phase: root.getAttribute('data-mobile-reverse-phase'),
            stripY: strip ? new DOMMatrix(getComputedStyle(strip).transform).m42 : null,
            stripHidden: strip?.classList.contains('is-concealed'),
          };
        }, transition.currentIndex);
        expect(naturalReturn.after).toBeLessThan(naturalReturn.before);
        expect(phaseABefore.reverse).toBe(false);
        expect(phaseAAfter.reverse).toBe(false, 'reverse ownership waits for the measured hero boundary');
        expect(phaseABefore.phase).toBe(null);
        expect(phaseAAfter.phase).toBe(null);
        expect(phaseABefore.stripHidden).toBe(false);
        expect(phaseAAfter.stripHidden).toBe(false);
        expect(phaseAAfter.stripY).not.toBe(phaseABefore.stripY);
        await scrollByWheel(page, 40);
        const captureBoundaryY = settledY - 2;
        await moveToScrollY(page, captureBoundaryY);
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await expect(page.locator('#showcases')).toHaveAttribute('data-mobile-hero-up');

        let entranceOrigin = null;
        let lockedAnchors = null;
        let lastMovingBannerY = null;
        for (const percent of frames) {
          const local = setup.end - (setup.end - setup.start) * percent / 100;
          const targetY = setup.rootTop + local;
          const currentY = await page.evaluate(() => scrollY);
          if (Math.abs(targetY - currentY) > 2) {
            const movement = await moveToScrollY(page, targetY);
            if (percent > 0 && targetY < currentY - 0.5) expect(movement.settledY).toBeLessThan(currentY);
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          }
          const state = await page.evaluate(({ currentIndex, previousIndex, percent }) => {
            const root = document.querySelector('#showcases');
            const stage = root.querySelector('.hero-stage');
            const sections = [...stage.querySelectorAll(':scope > .home-brand')];
            const stageHeight = sections[0].querySelector('.brand-showcase').getBoundingClientRect().height;
            const stageRect = stage.getBoundingClientRect();
            const headerHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 72;
            const viewportHeight = root.querySelector('[data-hero-viewport]')?.getBoundingClientRect().height || innerHeight;
            const pinHeight = Math.max(stageHeight, Math.round(viewportHeight - headerHeight));
            const heroes = sections.map((section, index) => {
              const hero = section.querySelector('.brand-showcase');
              const transform = new DOMMatrix(getComputedStyle(hero).transform);
              const clips = getComputedStyle(hero).clipPath.match(/[\d.]+/g)?.map(Number) || [0, 0];
              const style = getComputedStyle(hero);
              const logo = hero.querySelector('.brand-showcase__brand-logo');
              const heroRect = hero.getBoundingClientRect();
              const logoRect = logo?.getBoundingClientRect();
              const image = hero.querySelector('.brand-showcase__image');
              const imageRect = image?.getBoundingClientRect();
              const logoVisibleHeight = logoRect
                ? Math.max(0, Math.min(logoRect.bottom, heroRect.bottom - (clips[2] || 0), stageRect.bottom)
                  - Math.max(logoRect.top, heroRect.top + (clips[0] || 0), stageRect.top))
                : 0;
              return {
                brand: section.querySelector('.brand-showcase__link')?.getAttribute('href')?.split('/').filter(Boolean).at(-1) || `hero-${index}`,
                y: transform.m42,
                scaleY: transform.m22,
                clipTop: clips[0] || 0,
                clipBottom: clips[2] || 0,
                height: heroRect.height,
                visibility: style.visibility,
                opacity: Number(style.opacity),
                zIndex: style.zIndex,
                rect: { top: heroRect.top, bottom: heroRect.bottom },
                imageRect: imageRect ? { top: imageRect.top, bottom: imageRect.bottom, width: imageRect.width, height: imageRect.height } : null,
                imageNatural: image ? { width: image.naturalWidth, height: image.naturalHeight } : null,
        imageLoaded: Boolean(image?.complete && image.naturalWidth > 0),
                clipPath: style.clipPath,
                logo: Boolean(logo && getComputedStyle(logo).display !== 'none' && getComputedStyle(logo).visibility !== 'hidden'),
                logoLoaded: Boolean(logo?.complete && logo.naturalWidth > 0),
                logoVisibleHeight,
              };
            });
            const strips = sections.map((section) => ({
              brand: section.querySelector(':scope > .home-brand__product-layer > .brand-strip')?.dataset.brand,
              exists: Boolean(section.querySelector(':scope > .home-brand__product-layer > .brand-strip')),
              hidden: section.querySelector(':scope > .home-brand__product-layer > .brand-strip')?.classList.contains('is-concealed') ?? true,
              y: section.querySelector(':scope > .home-brand__product-layer > .brand-strip')
                ? new DOMMatrix(getComputedStyle(section.querySelector(':scope > .home-brand__product-layer > .brand-strip')).transform).m42
                : 0,
              height: section.querySelector(':scope > .home-brand__product-layer > .brand-strip')?.offsetHeight || 0,
              separateLayer: Boolean(section.querySelector('.home-brand__banner-layer') && section.querySelector('.home-brand__product-layer')
                && !section.querySelector('.home-brand__banner-layer').contains(section.querySelector('.brand-strip'))),
            }));
            const active = sections.flatMap((section, index) => section.hasAttribute('data-active') ? [index] : []);
            return {
              stageHeight, pinHeight, sceneHeight: stageRect.height, heroes, strips, active, scrollY,
              mobileUp: root.hasAttribute('data-mobile-hero-up'),
              phase: root.getAttribute('data-mobile-reverse-phase'),
            };
          }, { currentIndex: setup.currentIndex, previousIndex: setup.previousIndex, percent });
          expect(state.active).toHaveLength(1);
          expect(state.heroes[setup.currentIndex].brand).toBe(transition.current);
          expect(state.heroes[setup.previousIndex].brand).toBe(transition.previous);
          for (const hero of state.heroes) {
            expect(hero.height).toBe(state.stageHeight, `fixed box size for ${hero.brand} at ${percent}%`);
            if (hero.imageRect) expect(hero.imageRect.height).toBe(state.stageHeight, `fixed image box size for ${hero.brand} at ${percent}%`);
            expect(hero.scaleY).toBe(1, `banner ${hero.brand} never scales to cover the viewport at ${percent}%`);
          }
          expect(state.sceneHeight).toBe(state.pinHeight, `pinned stage stays a fixed height at ${percent}%`);
          const visibleIntervals = [
            ...state.heroes.map((pose) => ({
              top: pose.y + pose.clipTop,
              bottom: pose.y + pose.height - pose.clipBottom,
            })),
            ...state.strips.filter((strip) => strip.exists && !strip.hidden).map((strip) => ({
              top: strip.y,
              bottom: strip.y + strip.height,
            })),
          ].filter((interval) => interval.bottom > 0 && interval.top < state.sceneHeight)
            .sort((left, right) => left.top - right.top);
          let coveredTo = 0;
          for (const interval of visibleIntervals) {
            if (interval.top > coveredTo + 1) throw new Error(`white gap from ${coveredTo}px to ${interval.top}px at ${percent}%\n${JSON.stringify({ visibleIntervals, heroes: state.heroes.map(({brand,y,clipTop,clipBottom,height,visibility,opacity,zIndex})=>({brand,y,clipTop,clipBottom,height,visibility,opacity,zIndex})), strips: state.strips, pinHeight: state.pinHeight }, null, 2)}`);
            coveredTo = Math.max(coveredTo, interval.bottom);
          }
          expect(coveredTo, `the rendered card/strip stack has no uncovered internal band at ${percent}%: ${JSON.stringify({ visibleIntervals, heroes: state.heroes.map(({ brand, y, clipTop, clipBottom, height, visibility, opacity, zIndex }) => ({ brand, y, clipTop, clipBottom, height, visibility, opacity, zIndex })), strips: state.strips, sceneHeight: state.sceneHeight, pinHeight: state.pinHeight })}`).toBeGreaterThan(0);
          state.heroes.slice(setup.currentIndex + 1).forEach((pose, offset) => {
            expect(pose.y, `later brand ${pose.brand} must stay parked at ${percent}% of ${transition.name}; state=${JSON.stringify({ mobileUp: state.mobileUp, active: state.active, scrollY: state.scrollY, pinHeight: state.pinHeight, pose })}`).toBeGreaterThanOrEqual(state.pinHeight);
          });
          if (percent === 0) {
            expect(state.mobileUp).toBe(true);
            expect(state.phase).toBe('stack-entrance');
            expect(state.active[0]).toBe(setup.currentIndex);
            entranceOrigin = state.heroes.slice(0, setup.currentIndex + 1).map((pose) => pose.y);
            if (process.env.REAL_CONTENT_FIXTURE === '1' && width === 375 && locale === 'en' && transition.name === 'move-games') {
              await page.screenshot({ path: path.join(evidence, 'real-content-stack-diagnostic.png') });
            }
            try {
              await expect.poll(() => page.evaluate((brand) => {
                const section = [...document.querySelectorAll('#showcases .home-brand')].find((item) =>
                  item.querySelector('.brand-showcase__link')?.getAttribute('href')?.endsWith(`/brands/${brand}`));
                const image = section?.querySelector('.brand-showcase__image');
                return Boolean(image?.complete && image.naturalWidth > 0);
              }, transition.current), {
                timeout: mediaWait,
                message: `active Staging banner for ${transition.current} finishes loading before frame capture`,
              }).toBe(true);
            } catch (error) {
              const image = await page.evaluate(async (brand) => {
                const section = [...document.querySelectorAll('#showcases .home-brand')].find((item) =>
                  item.querySelector('.brand-showcase__link')?.getAttribute('href')?.endsWith(`/brands/${brand}`));
                const element = section?.querySelector('.brand-showcase__image');
                const decode = element ? await Promise.race([
                  element.decode().then(() => 'resolved').catch((error) => `rejected:${error.name}`),
                  new Promise((resolve) => setTimeout(() => resolve('pending'), 1000)),
                ]) : 'missing';
                return {
                  src: element?.src,
                  loading: element?.loading,
                  priority: element?.fetchPriority,
                  complete: element?.complete,
                  naturalWidth: element?.naturalWidth,
                  decode,
                  incomplete: [...document.images].filter((img) => img.src.includes('/uploads/kids-velvet/') && !img.complete).map((img) => ({ src: img.currentSrc || img.src, loading: img.loading, naturalWidth: img.naturalWidth, priority: img.fetchPriority })),
                  resources: performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/uploads/kids-velvet/')).map((entry) => ({ url: entry.name, duration: Math.round(entry.duration), transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize })),
                };
              }, transition.current);
              console.log('Active Staging banner did not finish', JSON.stringify({ brand: transition.current, image, responses: realMediaResponses.filter((response) => response.url === image.src), completed: completedMediaRequests.includes(image.src), failures: failedImageRequests.filter((request) => request.url === image.src) }));
              throw error;
            }
            for (let index = 0; index <= setup.currentIndex; index += 1) {
              const pose = state.heroes[index];
              await expect.poll(() => page.evaluate((brand) => {
                const section = [...document.querySelectorAll('#showcases .home-brand')].find((item) =>
                  item.querySelector('.brand-showcase__link')?.getAttribute('href')?.endsWith(`/brands/${brand}`));
                const image = section?.querySelector('.brand-showcase__image');
                return Boolean(image?.complete && image.naturalWidth > 0);
              }, pose.brand), {
                timeout: mediaWait,
                message: `original Staging banner for ${pose.brand} finishes loading before frame capture`,
              }).toBe(true);
              await expect.poll(() => page.evaluate((brand) => {
                const section = [...document.querySelectorAll('#showcases .home-brand')].find((item) =>
                  item.querySelector('.brand-showcase__link')?.getAttribute('href')?.endsWith(`/brands/${brand}`));
                const image = section?.querySelector('.brand-showcase__brand-logo');
                return Boolean(image?.complete && image.naturalWidth > 0);
              }, pose.brand), {
                timeout: mediaWait,
                message: `original Staging logo for ${pose.brand} finishes loading before frame capture`,
              }).toBe(true);
              const logoLoaded = await page.evaluate((brand) => {
                const section = [...document.querySelectorAll('#showcases .home-brand')].find((item) =>
                  item.querySelector('.brand-showcase__link')?.getAttribute('href')?.endsWith(`/brands/${brand}`));
                const image = section?.querySelector('.brand-showcase__brand-logo');
                return Boolean(image?.complete && image.naturalWidth > 0);
              }, pose.brand);
              expect(pose.logo && logoLoaded, `loaded original logo for ${pose.brand}`).toBe(true);
            }
          } else if (percent < 100) {
            expect(state.phase === 'stack-entrance' || state.phase === 'banner').toBe(true);
            const visibleStrips = state.strips.filter((strip) => !strip.hidden);
            const outgoingStrip = state.strips[setup.currentIndex];
            expect(visibleStrips).toHaveLength(outgoingStrip?.exists ? 1 : 0);
            if (outgoingStrip?.exists) {
              expect(visibleStrips[0].brand).toBe(transition.current);
              expect(visibleStrips[0].separateLayer).toBe(true);
              expect(visibleStrips[0].y).toBe(state.heroes[setup.currentIndex].y + state.stageHeight);
              const stripTop = visibleStrips[0].y;
              const stripBottom = stripTop + visibleStrips[0].height;
              const visibleCards = state.heroes.filter((hero) => (
                hero.y + hero.height - hero.clipBottom > 0 && hero.y + hero.clipTop < state.pinHeight
              ));
              expect(visibleCards.every((hero) => {
                const cardTop = hero.y + hero.clipTop;
                const cardBottom = hero.y + hero.height - hero.clipBottom;
                return stripBottom <= cardTop + 1 || stripTop >= cardBottom - 1;
              }), 'product lane does not overlap any visible banner face').toBe(true);
            }
            if (state.phase === 'stack-entrance') {
              expect(entranceOrigin).not.toBeNull();
              const groupDelta = state.heroes[setup.currentIndex].y - entranceOrigin[setup.currentIndex];
              for (let index = 0; index <= setup.currentIndex; index += 1) {
                expect(state.heroes[index].y - entranceOrigin[index], `all cards move as one group during stack entrance at ${percent}%`).toBe(groupDelta);
              }
            } else {
              const currentAnchors = state.heroes.slice(0, setup.previousIndex + 1).map((pose) => pose.y);
              if (!lockedAnchors) lockedAnchors = currentAnchors;
              expect(currentAnchors).toEqual(lockedAnchors);
              const movingBannerY = state.heroes[setup.currentIndex].y;
              if (lastMovingBannerY !== null) expect(movingBannerY).toBeGreaterThan(lastMovingBannerY);
              lastMovingBannerY = movingBannerY;
              for (let index = 0; index <= setup.previousIndex; index += 1) {
                expect(state.heroes[index].logoVisibleHeight, `logo remains visible for ${state.heroes[index].brand} at ${percent}%`).toBeGreaterThan(15);
                expect(await visibleLogoHeight(page, state.heroes[index].brand), `loaded logo peek for ${state.heroes[index].brand}`).toBeGreaterThan(15);
              }
            }
          } else {
            expect(state.phase).toBe('banner');
            expect(state.active[0]).toBe(setup.previousIndex);
            expect(state.heroes.slice(0, setup.previousIndex + 1).map((pose) => pose.y)).toEqual(lockedAnchors);
            for (let index = 0; index <= setup.previousIndex; index += 1) {
              expect(state.heroes[index].logoVisibleHeight, `settled stack logo remains visible for ${state.heroes[index].brand}`).toBeGreaterThan(15);
            }
            const settledStrip = state.strips[setup.previousIndex];
            if (settledStrip?.exists) {
              expect(settledStrip.hidden, `settled ${transition.previous} product strip at 100%: ${JSON.stringify({ scrollY: state.scrollY, start: setup.start, end: setup.end, mobileUp: state.mobileUp, active: state.active, strip: settledStrip, previousHero: state.heroes[setup.previousIndex], currentHero: state.heroes[setup.currentIndex] })}`).toBe(false);
            }
          }

          const imagePath = path.join(evidence, `${width}-${locale}-${transition.name}-${String(percent).padStart(3, '0')}.png`);
          await page.screenshot({ path: imagePath });
          measurements.push({ width, locale, transition: transition.name, percent, activeIndex: state.active[0], pinHeight: state.pinHeight, sceneHeight: state.sceneHeight, scrollY: state.scrollY, heroes: state.heroes.map(({brand,y,clipTop,clipBottom,visibility,opacity,zIndex,rect,imageRect,imageNatural,clipPath,logoLoaded,logoVisibleHeight})=>({brand,y,clipTop,clipBottom,visibility,opacity,zIndex,rect,imageRect,imageNatural,clipPath,logoLoaded,logoVisibleHeight})), strips: state.strips.map(({brand,hidden,y,height})=>({brand,hidden,y,height})) });
        }

        // Reverse direction immediately at an in-between frame; the scroll
        // position and active deck remain responsive without a delayed latch.
        const reverseStart = setup.rootTop + setup.end - (setup.end - setup.start) * 0.5;
        await moveToScrollY(page, reverseStart);
        const before = await page.evaluate(() => scrollY);
        await scrollByWheel(page, 80);
        await page.waitForTimeout(120);
        const after = await page.evaluate(() => scrollY);
        expect(after).toBeGreaterThan(before);
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), settledY);
      }
      expect(failedImageRequests, `${width}px ${locale} real Staging media requests`).toEqual([]);
      expect(realMediaResponses.length, 'real banner/logo/product media responses').toBeGreaterThan(0);
      expect(realMediaResponses.filter((response) => response.status !== 200), 'all loaded Staging media returns HTTP 200').toEqual([]);
      console.log(`Real media responses ${width}px ${locale}: ${realMediaResponses.length} HTTP 200`);
      await context.close();
    }
  }
  fs.writeFileSync(path.join(evidence, 'measurements.json'), JSON.stringify(measurements, null, 2));
  const gallery = [`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Velvet reverse transition frames</title>
<style>:root{font:14px Arial,sans-serif;color:#1f1820;background:#f1efed}*{box-sizing:border-box}body{margin:auto;padding:24px;max-width:1900px}h1{margin:0 0 8px}p{margin:0 0 20px;color:#625d59}.device{margin:24px 0;padding:18px;background:white;border-radius:14px}.device h2{margin:0 0 14px}.transition{margin:18px 0}.transition h3{margin:0 0 8px;text-transform:capitalize}.frames{display:grid;grid-template-columns:repeat(21,minmax(70px,1fr));gap:6px;overflow-x:auto;min-width:1600px}.frame{position:relative;display:block;overflow:hidden;border-radius:6px;background:#e8e6e3}.frame img{width:100%;display:block}.frame span{position:absolute;left:4px;bottom:4px;padding:3px 5px;border-radius:12px;background:#19151ddd;color:white;font-size:11px}a{color:inherit}</style><body><h1>Velvet mobile reverse transitions</h1><p>Actual Chromium screenshots · move/games, create/learn, muslim/books · frame every 5% · 375/390/412px · English and Arabic. Open a frame to inspect it at full size.</p>`];
  for (const width of sizes) for (const locale of locales) {
    gallery.push(`<section class="device"><h2>${width}px · ${locale === 'ar' ? 'RTL · Arabic' : 'LTR · English'}</h2>`);
    for (const transition of transitions) {
      gallery.push(`<section class="transition"><h3>${transition.name}</h3><div class="frames">`);
      for (const percent of frames) {
        const file = `${width}-${locale}-${transition.name}-${String(percent).padStart(3, '0')}.png`;
        gallery.push(`<a class="frame" href="${file}" target="_blank"><img loading="lazy" src="${file}" alt="${width}px ${locale} ${transition.name} at ${percent}%"><span>${percent}%</span></a>`);
      }
      gallery.push('</div></section>');
    }
    gallery.push('</section>');
  }
  gallery.push('</body></html>');
  fs.writeFileSync(path.join(evidence, 'index.html'), gallery.join('\n'));
});
