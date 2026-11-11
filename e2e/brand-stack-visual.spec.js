import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const sizes = process.env.REVIEW_WIDTH ? [Number(process.env.REVIEW_WIDTH)] : process.env.REVIEW_QUICK === '1' ? [375] : [375, 390, 412];
const locales = process.env.REVIEW_LOCALE ? [process.env.REVIEW_LOCALE] : process.env.REVIEW_QUICK === '1' ? [process.env.REVIEW_AR === '1' ? 'ar' : 'en'] : ['en', 'ar'];
const frames = Array.from({ length: 21 }, (_, index) => index * 5);
const transitions = [
  { current: 'move', previous: 'games', currentIndex: 7, previousIndex: 6, name: 'move-games' },
  { current: 'create', previous: 'learn', currentIndex: 5, previousIndex: 4, name: 'create-learn' },
  { current: 'muslim', previous: 'books', currentIndex: 11, previousIndex: 10, name: 'muslim-books' },
];

async function scrollByWheel(page, deltaY, pause = 40) {
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, deltaY);
  await page.waitForTimeout(pause);
  return { before, after: await page.evaluate(() => scrollY) };
}

test('captures the full mobile reverse deck across brands, sizes, and languages', async ({ browser }) => {
  const evidence = path.resolve('brand-motion-evidence', 'stack-acceptance');
  fs.mkdirSync(evidence, { recursive: true });
  const measurements = [];

  for (const width of sizes) {
    for (const locale of locales) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
        locale: locale === 'ar' ? 'ar' : 'en-US',
      });
      await context.addInitScript((value) => localStorage.setItem('play-language', value), locale);
      const page = await context.newPage();
      console.log(`Opening ${width}px ${locale}`);
      await page.goto('/?view=showcases', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#showcases[data-home-brand-deck] .home-brand')).toHaveCount(12);
      await page.waitForTimeout(250);

      for (const [pairIndex, transition] of transitions.entries()) {
        console.log(`Capturing ${transition.name}`);
        if (pairIndex > 0) {
          await page.reload({ waitUntil: 'domcontentloaded' });
          await expect(page.locator('#showcases[data-home-brand-deck] .home-brand')).toHaveCount(12);
          await page.waitForTimeout(150);
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
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
            const strip = section.querySelector(':scope > .brand-strip');
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
          const movement = await scrollByWheel(page, Math.min(280, remaining), 35);
          expect(movement.after).toBeGreaterThan(movement.before);
        }
        expect(await page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(settledY + 50);
        const captureBoundaryY = settledY - 2;
        await scrollByWheel(page, captureBoundaryY - await page.evaluate(() => scrollY), 100);
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await expect(page.locator('#showcases')).toHaveAttribute('data-mobile-hero-up');

        let anchors = null;
        for (const percent of frames) {
          const local = setup.end - (setup.end - setup.start) * percent / 100;
          const targetY = setup.rootTop + local;
          const currentY = await page.evaluate(() => scrollY);
          if (percent > 0 && targetY < currentY - 0.5) {
            const movement = await scrollByWheel(page, targetY - currentY);
            expect(movement.after).toBeLessThan(movement.before);
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          }
          const state = await page.evaluate(({ currentIndex, previousIndex, percent }) => {
            const root = document.querySelector('#showcases');
            const stage = root.querySelector('.hero-stage');
            const sections = [...stage.querySelectorAll(':scope > .home-brand')];
            const stageHeight = sections[0].querySelector('.brand-showcase').getBoundingClientRect().height;
            const pinHeight = stage.getBoundingClientRect().height;
            const stageRect = stage.getBoundingClientRect();
            const heroes = sections.map((section, index) => {
              const hero = section.querySelector('.brand-showcase');
              const transform = new DOMMatrix(getComputedStyle(hero).transform);
              const clips = getComputedStyle(hero).clipPath.match(/[\d.]+/g)?.map(Number) || [0, 0];
              const style = getComputedStyle(hero);
              const logo = hero.querySelector('.brand-showcase__brand-logo');
              const heroRect = hero.getBoundingClientRect();
              const logoRect = logo?.getBoundingClientRect();
              const logoVisibleHeight = logoRect
                ? Math.max(0, Math.min(logoRect.bottom, heroRect.bottom - (clips[2] || 0), stageRect.bottom)
                  - Math.max(logoRect.top, heroRect.top + (clips[0] || 0), stageRect.top))
                : 0;
              return {
                brand: section.querySelector('.brand-showcase__link')?.getAttribute('href')?.split('/').filter(Boolean).at(-1) || `hero-${index}`,
                y: transform.m42,
                clipTop: clips[0] || 0,
                clipBottom: clips[2] || 0,
                height: heroRect.height,
                visibility: style.visibility,
                opacity: Number(style.opacity),
                zIndex: style.zIndex,
                rect: { top: heroRect.top, bottom: heroRect.bottom },
                clipPath: style.clipPath,
                logo: Boolean(logo && getComputedStyle(logo).display !== 'none' && getComputedStyle(logo).visibility !== 'hidden'),
                logoLoaded: Boolean(logo?.complete && logo.naturalWidth > 0),
                logoVisibleHeight,
              };
            });
            const strips = sections.map((section) => ({
              brand: section.querySelector(':scope > .brand-strip')?.dataset.brand,
              exists: Boolean(section.querySelector(':scope > .brand-strip')),
              hidden: section.querySelector(':scope > .brand-strip')?.classList.contains('is-concealed') ?? true,
              y: section.querySelector(':scope > .brand-strip')
                ? new DOMMatrix(getComputedStyle(section.querySelector(':scope > .brand-strip')).transform).m42
                : 0,
              height: section.querySelector(':scope > .brand-strip')?.offsetHeight || 0,
            }));
            const active = sections.flatMap((section, index) => section.hasAttribute('data-active') ? [index] : []);
            return {
              stageHeight, pinHeight, heroes, strips, active, scrollY,
              mobileUp: root.hasAttribute('data-mobile-hero-up'),
            };
          }, { currentIndex: setup.currentIndex, previousIndex: setup.previousIndex, percent });
          expect(state.active).toHaveLength(1);
          expect(state.heroes[setup.currentIndex].brand).toBe(transition.current);
          expect(state.heroes[setup.previousIndex].brand).toBe(transition.previous);
          const visibleIntervals = [
            ...state.heroes.map((pose) => ({
              top: pose.y + pose.clipTop,
              bottom: pose.y + pose.height - pose.clipBottom,
            })),
            ...state.strips.filter((strip) => strip.exists && !strip.hidden).map((strip) => ({
              top: strip.y,
              bottom: strip.y + strip.height,
            })),
          ].filter((interval) => interval.bottom > 0 && interval.top < state.pinHeight)
            .sort((left, right) => left.top - right.top);
          let coveredTo = 0;
          for (const interval of visibleIntervals) {
            if (interval.top > coveredTo + 1) throw new Error(`white gap from ${coveredTo}px to ${interval.top}px at ${percent}%\n${JSON.stringify({ visibleIntervals, heroes: state.heroes.map(({brand,y,clipTop,clipBottom,height,visibility,opacity,zIndex})=>({brand,y,clipTop,clipBottom,height,visibility,opacity,zIndex})), strips: state.strips, pinHeight: state.pinHeight }, null, 2)}`);
            coveredTo = Math.max(coveredTo, interval.bottom);
          }
          expect(coveredTo).toBeGreaterThanOrEqual(state.pinHeight - 1);
          state.heroes.slice(setup.currentIndex + 1).forEach((pose, offset) => {
            expect(pose.y, `later brand ${pose.brand} must stay parked at ${percent}% of ${transition.name}; state=${JSON.stringify({ mobileUp: state.mobileUp, active: state.active, scrollY: state.scrollY, pinHeight: state.pinHeight, pose })}`).toBeGreaterThanOrEqual(state.pinHeight);
          });
          if (percent === 0) {
            expect(state.mobileUp).toBe(true);
            expect(state.active[0]).toBe(setup.currentIndex);
            anchors = state.heroes.slice(0, setup.previousIndex).map((pose) => pose.y);
            for (let index = 0; index < setup.previousIndex; index += 1) {
              const pose = state.heroes[index];
              expect(pose.logo && pose.logoLoaded, `loaded original logo for ${pose.brand}`).toBe(true);
              expect(pose.logoVisibleHeight, `visible original logo for ${pose.brand}`).toBeGreaterThan(15);
              expect(state.stageHeight - pose.clipTop - pose.clipBottom, `compact anchored peek for ${pose.brand}`).toBeGreaterThanOrEqual(48);
            }
          } else if (percent < 100) {
            expect(state.strips.every((strip) => strip.hidden), 'all product strips stay concealed in flight').toBe(true);
            const older = state.heroes.slice(0, setup.previousIndex).map((pose) => pose.y);
            expect(older).toEqual(anchors);
            for (let index = 0; index < setup.previousIndex; index += 1) {
              expect(state.heroes[index].logoVisibleHeight, `logo stays visible for ${state.heroes[index].brand} at ${percent}%`).toBeGreaterThan(15);
            }
          } else {
            expect(state.active[0]).toBe(setup.previousIndex);
            for (let index = 0; index < setup.previousIndex; index += 1) {
              expect(state.heroes[index].logoVisibleHeight, `settled stack logo remains visible for ${state.heroes[index].brand}`).toBeGreaterThan(15);
            }
            const settledStrip = state.strips[setup.previousIndex];
            if (settledStrip?.exists) expect(settledStrip.hidden).toBe(false);
          }

          const imagePath = path.join(evidence, `${width}-${locale}-${transition.name}-${String(percent).padStart(3, '0')}.png`);
          const screenshot = await page.screenshot({ path: imagePath });
          const whiteBands = await page.evaluate(async (base64) => {
            const image = new Image();
            image.src = `data:image/png;base64,${base64}`;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.drawImage(image, 0, 0);
            const stage = document.querySelector('#showcases .hero-stage').getBoundingClientRect();
            const top = Math.max(0, Math.ceil(stage.top));
            const bottom = Math.min(canvas.height, Math.ceil(stage.bottom));
            const pixels = context.getImageData(0, top, canvas.width, bottom - top).data;
            const rows = [];
            for (let y = 0; y < bottom - top; y += 1) {
              let white = 0;
              for (let x = 0; x < canvas.width; x += 1) {
                const i = (y * canvas.width + x) * 4;
                if (pixels[i] > 245 && pixels[i + 1] > 245 && pixels[i + 2] > 245 && pixels[i + 3] > 245) white += 1;
              }
              if (white / canvas.width > 0.985) rows.push(top + y);
            }
            const bands = [];
            rows.forEach((row) => {
              const last = bands[bands.length - 1];
              if (last && row === last.bottom + 1) last.bottom = row;
              else bands.push({ top: row, bottom: row });
            });
            return bands.filter((band) => band.bottom - band.top + 1 >= 2);
          }, screenshot.toString('base64'));
          // At settled endpoints the active brand's real product strip can
          // create a legitimate white row. Mid-transition strips are hidden,
          // so a fully white band there indicates an uncovered stage seam.
          if (percent > 0 && percent < 100) {
            expect(whiteBands, `painted white gap inside stage at ${percent}%`).toEqual([]);
          }
          measurements.push({ width, locale, transition: transition.name, percent, activeIndex: state.active[0], pinHeight: state.pinHeight, scrollY: state.scrollY, heroes: state.heroes.map(({brand,y,clipTop,clipBottom,visibility,opacity,zIndex,rect,clipPath,logoLoaded,logoVisibleHeight})=>({brand,y,clipTop,clipBottom,visibility,opacity,zIndex,rect,clipPath,logoLoaded,logoVisibleHeight})), strips: state.strips.map(({brand,hidden,y,height})=>({brand,hidden,y,height})) });
        }

        // Reverse direction immediately at an in-between frame; the scroll
        // position and active deck remain responsive without a delayed latch.
        const reverseStart = setup.rootTop + setup.end - (setup.end - setup.start) * 0.5;
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), reverseStart);
        const before = await page.evaluate(() => scrollY);
        await page.mouse.wheel(0, 80);
        await page.waitForTimeout(120);
        const after = await page.evaluate(() => scrollY);
        expect(after).toBeGreaterThan(before);
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), settledY);
      }
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
