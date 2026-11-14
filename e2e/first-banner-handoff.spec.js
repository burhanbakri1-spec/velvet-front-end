import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installRealContentFixture } from './realContentFixture.js';

const viewports = [
  { width: 375, height: 812 },
  { width: 390, height: 812 },
  { width: 412, height: 812 },
];
const locales = ['en', 'ar'];
const runViewports = process.env.REVIEW_QUICK === '1' ? [viewports[0]] : viewports;
const runLocales = process.env.REVIEW_QUICK === '1' ? [process.env.REVIEW_AR === '1' ? 'ar' : 'en'] : locales;
const expectedReverseOrder = ['create', 'learn', 'build', 'play', 'kids', 'baby'];
const evidenceRoot = path.resolve('brand-motion-evidence', 'first-banner-architecture');

async function readState(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#showcases');
    const shell = root.querySelector('.hero-stage-shell');
    const stage = root.querySelector('.hero-stage');
    const sections = [...stage.querySelectorAll(':scope > .home-brand')];
    const slug = (section) => section?.querySelector('.brand-showcase__link')?.getAttribute('href')?.split('/').filter(Boolean).at(-1) || null;
    const header = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 72;
    const stageBox = stage.getBoundingClientRect();
    const hero = (section) => {
      const article = section.querySelector('.brand-showcase');
      const image = article.querySelector('.brand-showcase__image');
      const style = getComputedStyle(article);
      const rect = article.getBoundingClientRect();
      const imageRect = image?.getBoundingClientRect();
      const transform = new DOMMatrix(style.transform);
      const inset = style.clipPath.match(/[\d.]+px/g)?.map((value) => Number.parseFloat(value)) || [];
      const clipTop = inset[0] || 0;
      const clipBottom = inset[2] || 0;
      return {
        brand: slug(section), y: transform.m42, height: rect.height,
        rect: { top: rect.top, bottom: rect.bottom, height: rect.height },
        imageRect: imageRect ? { top: imageRect.top, bottom: imageRect.bottom, width: imageRect.width, height: imageRect.height } : null,
        visibleTop: rect.top + clipTop, visibleBottom: rect.bottom - clipBottom,
        clipTop, clipBottom, clipPath: style.clipPath, z: style.zIndex,
        visibility: style.visibility, opacity: Number(style.opacity),
        imageLoaded: Boolean(image?.complete && image.naturalWidth > 0),
      };
    };
    const stripRows = sections.map((section) => {
      const strip = section.querySelector(':scope > .home-brand__product-layer > .brand-strip');
      if (!strip) return null;
      const rect = strip.getBoundingClientRect();
      const style = getComputedStyle(strip);
      const viewport = strip.querySelector('.brand-strip__viewport');
      const viewportRect = viewport?.getBoundingClientRect();
      const cards = [...strip.querySelectorAll('.brand-strip-card')];
      const cardRows = cards.map((card) => {
        const box = card.getBoundingClientRect();
        const image = card.querySelector('.brand-strip-card__image');
        return {
          href: card.getAttribute('href'),
          visible: Boolean(viewportRect && box.right > viewportRect.left && box.left < viewportRect.right),
          imageSrc: image?.currentSrc || image?.src || '',
          imageLoaded: Boolean(image?.complete && image.naturalWidth > 0),
        };
      });
      return {
        brand: strip.dataset.brand, hidden: strip.classList.contains('is-concealed') || style.visibility === 'hidden',
        y: new DOMMatrix(style.transform).m42, height: rect.height,
        top: rect.top, bottom: rect.bottom,
        uniqueProducts: [...new Set(cardRows.map((card) => card.href))].length,
        visibleProducts: [...new Set(cardRows.filter((card) => card.visible).map((card) => card.href))].length,
        visibleLoadedProducts: [...new Set(cardRows.filter((card) => card.visible && card.imageLoaded).map((card) => card.href))].length,
        imageUrls: [...new Set(cardRows.map((card) => card.imageSrc))],
      };
    });
    const shellRect = shell.getBoundingClientRect();
    const rootStart = shellRect.top + scrollY - header;
    const localRaw = scrollY - rootStart;
    const kids = hero(sections[1]);
    const baseHeroHeight = kids.height;
    let offset = 0;
    const brandOffsets = sections.map((section) => {
      const result = offset;
      const strip = section.querySelector(':scope > .home-brand__product-layer > .brand-strip');
      offset += baseHeroHeight + (strip?.offsetHeight || 0);
      return result;
    });
    const documentRect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, height: box.height };
    };
    const heroes = sections.map(hero);
    const strips = stripRows.filter(Boolean);
    const visible = [
      ...heroes.filter((item) => item.visibility === 'visible' && item.opacity > 0)
        .map((item) => ({ top: item.visibleTop, bottom: item.visibleBottom, brand: item.brand, kind: 'hero' })),
      ...strips.filter((item) => !item.hidden).map((item) => ({ top: item.top, bottom: item.bottom, brand: item.brand, kind: 'strip' })),
    ].map((item) => ({ ...item, top: Math.max(item.top, stageBox.top), bottom: Math.min(item.bottom, stageBox.bottom) }))
      .filter((item) => item.bottom > item.top)
      .sort((a, b) => a.top - b.top);
    let cursor = stageBox.top;
    let maxGap = 0;
    visible.forEach((item) => {
      if (item.top > cursor + 1) maxGap = Math.max(maxGap, item.top - cursor);
      cursor = Math.max(cursor, item.bottom);
    });
    if (cursor < stageBox.bottom - 1) maxGap = Math.max(maxGap, stageBox.bottom - cursor);
    const age = documentRect('#shop-by-age');
    const intro = documentRect('#about');
    const pageHero = documentRect('#top');
    return {
      scrollY, rootStart, localRaw, local: Math.max(0, localRaw),
      firstPairProgress: Math.min(1, Math.max(0, (brandOffsets[1] - Math.max(0, localRaw)) / Math.max(1, brandOffsets[1]))),
      brandOffsets, pinHeight: Math.max(baseHeroHeight, Math.round(innerHeight - header)), active: slug(sections.find((section) => section.hasAttribute('data-active'))),
      activeCount: sections.filter((section) => section.hasAttribute('data-active')).length,
      babyCopies: [...document.querySelectorAll('.brand-showcase__link')].filter((link) => link.getAttribute('href')?.split('/').filter(Boolean).at(-1) === 'baby').length,
      mobileUp: root.hasAttribute('data-mobile-hero-up'), motion: root.hasAttribute('data-hero-motion'),
      pinClass: document.body.classList.contains('hero-stage-pin'),
      shell: { top: shellRect.top, bottom: shellRect.bottom, height: shellRect.height, span: shell.style.getPropertyValue('--mobile-up-stage-span') || shell.style.getPropertyValue('--hero-stage-span') },
      stage: { top: stageBox.top, bottom: stageBox.bottom, height: stageBox.height, position: getComputedStyle(stage).position, overflow: getComputedStyle(stage).overflow },
      baby: heroes[0], kids, heroes, strips, maxStageGap: maxGap,
      age, intro, pageHero,
      visibleDocumentSections: [
        ['shop-by-age', age], ['about', intro], ['top', pageHero],
      ].filter(([, box]) => box && box.bottom > header && box.top < innerHeight).map(([id]) => id),
      header,
    };
  });
}

async function wheel(page, deltaY, pause = 35) {
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, deltaY);
  await page.waitForTimeout(pause);
  const after = await page.evaluate(() => scrollY);
  return { before, after };
}

async function waitForTouchSettle(page) {
  let previous = await page.evaluate(() => scrollY);
  let stable = 0;
  for (let frame = 0; frame < 120 && stable < 3; frame += 1) {
    await page.waitForTimeout(40);
    const current = await page.evaluate(() => scrollY);
    stable = current === previous ? stable + 1 : 0;
    previous = current;
  }
  expect(stable).toBe(3);
}

async function touchScroll(context, page, viewport, scrollDelta) {
  const cdp = await context.newCDPSession(page);
  const x = Math.round(viewport.width / 2);
  const startY = Math.round(viewport.height / 2);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
  const steps = Math.max(3, Math.ceil(Math.abs(scrollDelta) / 5));
  for (let step = 1; step <= steps; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: startY - scrollDelta * step / steps }],
    });
    await page.waitForTimeout(30);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await waitForTouchSettle(page);
  await cdp.detach();
  return page.evaluate(() => scrollY);
}

async function saveFrame(page, directory, name) {
  await page.screenshot({ path: path.join(directory, name) });
}

test('real mobile scrolling keeps Baby continuous through the first-banner and document handoff', async ({ browser }) => {
  test.setTimeout(300_000);
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const manifest = [];
  const gallery = ['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Velvet first-banner boundary review</title>',
    '<style>body{font:14px Arial,sans-serif;margin:24px;background:#f3f1ef;color:#211a1d}.scenario{margin:30px 0;padding:18px;background:white;border-radius:12px}h1{margin:0 0 8px}p{margin:0 0 20px;color:#665}.frames{display:flex;gap:8px;overflow:auto}.frame{flex:0 0 150px;text-decoration:none;color:inherit}.frame img{width:100%;display:block;border-radius:6px}.frame b{display:block;padding:4px;font-size:11px}</style><h1>VELVET first-banner handoff</h1><p>Real mobile Chromium frames and measured DOM geometry from actual wheel and touch scrolling.</p>'];

  for (const viewport of runViewports) for (const locale of runLocales) {
    const key = `${viewport.width}-${locale}`;
    const directory = path.join(evidenceRoot, 'after-fix', key);
    fs.mkdirSync(directory, { recursive: true });
    gallery.push(`<section class="scenario"><h2>${viewport.width}px · ${locale === 'ar' ? 'Arabic RTL' : 'English LTR'}</h2><div class="frames">`);

    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
      locale: locale === 'ar' ? 'ar' : 'en-US',
    });
    await context.addInitScript((language) => {
      localStorage.setItem('play-language', language);
      if (document.documentElement) document.documentElement.style.scrollBehavior = 'auto';
    }, locale);
    const page = await context.newPage();
    await installRealContentFixture(page, locale, { brandLimit: 6, includeBabyProductMedia: true });
    await page.goto('/?view=showcases', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#showcases[data-home-brand-deck] .home-brand')).toHaveCount(12);
    await page.waitForTimeout(160);

    let state = await readState(page);
    const createTarget = state.rootStart + state.brandOffsets[5];
    for (let approach = 0; approach < 100 && (await page.evaluate(() => scrollY)) < createTarget - 2; approach += 1) {
      const remaining = createTarget - await page.evaluate(() => scrollY);
      await wheel(page, Math.min(360, remaining), 30);
    }
    await expect(page.locator('#showcases .home-brand[data-active] .brand-showcase__link')).toHaveAttribute('href', /\/brands\/create/);
    const journey = [{ ...await readState(page), step: 'Create' }];
    const seen = new Set(['create']);
    state = journey[0];
    for (let step = 0; step < 100 && (state.active !== 'baby' || state.local > 120); step += 1) {
      const delta = state.active === 'baby' ? -Math.min(120, Math.max(1, state.local - 120)) : -120;
      await wheel(page, delta, 35);
      state = await readState(page);
      journey.push(state);
      if (state.active) seen.add(state.active);
    }
    await expect.poll(() => page.locator('#showcases .home-brand[data-active] .brand-showcase__image').evaluate((image) => (
      image.getAttribute('src')?.includes('/2-1789208751356-b2j4wn.webp')
      && image.complete && image.naturalWidth > 0
    )), { timeout: 45_000, message: 'real Staging Baby banner finishes loading before geometry acceptance' }).toBe(true);
    state = await readState(page);
    expect(state.active).toBe('baby');
    for (const brand of expectedReverseOrder) expect(seen.has(brand), `real scroll visited ${brand}`).toBe(true);
    expect(state.babyCopies).toBe(1);
    expect(state.baby.visibility).toBe('visible');
    expect(state.baby.imageLoaded).toBe(true);
    expect(state.baby.visibleTop).toBe(state.stage.top, 'Baby stays anchored to the scene edge through its reveal');
    expect(state.baby.height).toBe(state.kids.height, 'the fixed-size banner boxes stay consistent');
    expect(state.baby.imageRect.height).toBe(state.baby.height, 'the image box keeps the banner height');
    expect(state.maxStageGap).toBeLessThanOrEqual(1);

    const boundaryFrames = [];
    const captureBoundary = async (label) => {
      const frame = `${key}-boundary-${String(boundaryFrames.length).padStart(3, '0')}.png`;
      let sample = await readState(page);
      expect(sample.activeCount).toBe(1);
      expect(sample.babyCopies).toBe(1);
      expect(sample.baby.visibility).toBe('visible');
      expect(sample.baby.opacity).toBe(1);
      expect(sample.baby.imageLoaded).toBe(true);
      expect(sample.baby.imageRect.height).toBe(sample.baby.height, 'Baby image geometry stays fixed during handoff');
      if (sample.maxStageGap > 1) console.log('Uncovered stage diagnostics', JSON.stringify({ label, scrollY: sample.scrollY, rootStart: sample.rootStart, local: sample.local, mobileUp: sample.mobileUp, baby: sample.baby, kids: sample.kids, stage: sample.stage, strips: sample.strips, heroes: sample.heroes.map(({ brand, y, height, rect, visibleTop, visibleBottom, clipTop, clipBottom, z, visibility }) => ({ brand, y, height, rect, visibleTop, visibleBottom, clipTop, clipBottom, z, visibility })) }, null, 2));
      expect(sample.maxStageGap, `no uncovered stage band at ${label}`).toBeLessThanOrEqual(1);
      const babyStrip = sample.strips.find((strip) => strip.brand === 'baby');
      if (sample.localRaw <= 1 && sample.active === 'baby' && babyStrip) {
        await expect.poll(async () => (await readState(page)).strips.find((strip) => strip.brand === 'baby')?.visibleLoadedProducts ?? 0, {
          timeout: 30_000,
          message: 'visible Baby product images finish loading from their Staging URLs',
        }).toBeGreaterThanOrEqual(3);
        sample = await readState(page);
        const settledBabyStrip = sample.strips.find((strip) => strip.brand === 'baby');
        expect(settledBabyStrip.hidden, 'Baby product strip is restored once Baby settles').toBe(false);
        expect(settledBabyStrip.uniqueProducts, 'Baby uses the six eligible Staging products').toBe(6);
        expect(settledBabyStrip.visibleProducts, 'Baby product cards enter the strip viewport').toBeGreaterThanOrEqual(3);
        expect(settledBabyStrip.visibleLoadedProducts, 'visible Baby product images load from Staging').toBeGreaterThanOrEqual(3);
        expect(Math.abs(settledBabyStrip.top - sample.baby.rect.bottom), 'Baby strip begins directly beneath its fixed banner').toBeLessThanOrEqual(1);
      }
      await saveFrame(page, directory, frame);

      boundaryFrames.push({ frame, label, ...sample });
      return sample;
    };

    await captureBoundary('Baby active before first boundary');
    for (let approach = 0; approach < 12 && await page.evaluate(() => scrollY) > state.rootStart - 20; approach += 1) {
      await wheel(page, -10, 40);
      state = await readState(page);
      const sample = await captureBoundary('slow 10px approach');
      boundaryFrames[boundaryFrames.length - 1].sampledState = sample;
      expect(sample.scrollY).toBeLessThanOrEqual(boundaryFrames[boundaryFrames.length - 2]?.scrollY ?? Infinity);
      // Each sample is taken after native wheel input and the next animation frame.
    }
    state = await readState(page);

    const documentFrames = [];
    for (let step = 0; step < 80 && state.scrollY > 0; step += 1) {
      await wheel(page, -30, 40);
      state = await readState(page);
      expect(state.babyCopies).toBe(1);
      expect(state.maxStageGap).toBeLessThanOrEqual(1);
      if (state.baby.rect.bottom > state.header && state.baby.rect.top < viewport.height) {
        expect(state.baby.visibility).toBe('visible');
        expect(state.baby.opacity).toBe(1);
      }
      const frame = `${key}-document-${String(documentFrames.length).padStart(3, '0')}.png`;
      await saveFrame(page, directory, frame);
      documentFrames.push({ frame, ...state });
    }
    expect(documentFrames.some((sample) => sample.visibleDocumentSections.includes('shop-by-age')), 'Toys for Every Age enters').toBe(true);
    expect(documentFrames.some((sample) => sample.visibleDocumentSections.includes('about')), 'the preceding intro content enters').toBe(true);
    expect(documentFrames.some((sample) => sample.visibleDocumentSections.includes('top')), 'the homepage hero enters after it').toBe(true);
    expect(documentFrames.at(-1).scrollY).toBe(0, 'the real document scroll reaches its natural top');
    expect(documentFrames.at(-1).visibleDocumentSections).toContain('top');

    // Return to just above the deck by real downward wheel input, then cross
    // the same boundary and reverse upward again without changing scrollY by
    // script. This checks both directions at the exact first-brand handoff.
    while ((await page.evaluate(() => scrollY)) < state.rootStart - 40) {
      const remaining = state.rootStart - 40 - await page.evaluate(() => scrollY);
      await wheel(page, Math.min(120, remaining), 35);
    }
    const beforeDown = await readState(page);
    expect(beforeDown.localRaw).toBeLessThan(0);
    const downMove = await wheel(page, 80, 80);
    const afterDown = await readState(page);
    expect(downMove.after).toBeGreaterThan(downMove.before);
    expect(afterDown.local).toBeGreaterThan(0);
    expect(afterDown.mobileUp).toBe(false);
    expect(afterDown.activeCount).toBe(1);
    expect(afterDown.baby.rect.bottom).toBeGreaterThan(0);
    expect(afterDown.baby.opacity).toBe(1);
    expect(afterDown.baby.imageRect.height).toBe(afterDown.baby.height);
    expect(afterDown.maxStageGap).toBeLessThanOrEqual(1);
    await saveFrame(page, directory, `${key}-down-reversal.png`);
    const upMove = await wheel(page, -80, 80);
    const afterUp = await readState(page);
    expect(upMove.after).toBeLessThan(upMove.before);
    expect(afterUp.localRaw).toBeLessThan(0);
    expect(afterUp.mobileUp).toBe(true, 'clamped first boundary restores UP ownership');
    expect(afterUp.baby.visibleTop).toBe(afterUp.stage.top);
    expect(afterUp.baby.height).toBe(afterUp.kids.height, 'Baby keeps the fixed measured banner box');
    expect(afterUp.baby.imageRect.height).toBe(afterUp.baby.height);
    expect(afterUp.baby.height).toBeLessThan(afterUp.pinHeight, 'the banner does not expand to fill the pinned viewport');
    expect(afterUp.baby.rect.bottom).toBeLessThan(viewport.height - 2, 'normal page content can enter below the banner');
    expect(afterUp.maxStageGap).toBeLessThanOrEqual(1);
    await saveFrame(page, directory, `${key}-up-reversal.png`);

    // Short, native touch gestures and a faster wheel sweep exercise the same
    // boundary without directly setting scroll progress.
    const touchBefore = await readState(page);
    const touchNear = await touchScroll(context, page, viewport, 25);
    const touchAtEdge = await readState(page);
    expect(touchNear).toBeGreaterThan(touchBefore.scrollY);
    expect(touchAtEdge.localRaw).toBeLessThan(0);
    expect(touchAtEdge.mobileUp).toBe(true);
    const touchDownY = await touchScroll(context, page, viewport, 80);
    const touchAfterDown = await readState(page);
    expect(touchDownY).toBeGreaterThan(touchNear);
    expect(touchAfterDown.local).toBeGreaterThan(0);
    expect(touchAfterDown.mobileUp).toBe(false);
    expect(touchAfterDown.baby.visibility).toBe('visible');
    expect(touchAfterDown.maxStageGap).toBeLessThanOrEqual(1);
    const touchUpY = await touchScroll(context, page, viewport, -80);
    const touchAfterUp = await readState(page);
    expect(touchUpY).toBeLessThan(touchDownY);
    expect(touchAfterUp.localRaw).toBeLessThan(0);
    expect(touchAfterUp.mobileUp).toBe(true);
    expect(touchAfterUp.baby.visibility).toBe('visible');
    expect(touchAfterUp.maxStageGap).toBeLessThanOrEqual(1);
    await saveFrame(page, directory, `${key}-touch-boundary.png`);

    const fastBefore = await page.evaluate(() => scrollY);
    await wheel(page, -480, 100);
    const fastAfter = await readState(page);
    expect(fastAfter.scrollY).toBeLessThan(fastBefore);
    expect(fastAfter.babyCopies).toBe(1);
    expect(fastAfter.maxStageGap).toBeLessThanOrEqual(1);
    if (fastAfter.baby.rect.bottom > fastAfter.header && fastAfter.baby.rect.top < viewport.height) {
      expect(fastAfter.baby.visibility).toBe('visible');
      expect(fastAfter.baby.opacity).toBe(1);
    }
    const fastDown = await wheel(page, 540, 100);
    const fastDownState = await readState(page);
    expect(fastDown.after).toBeGreaterThan(fastDown.before);
    expect(fastDownState.local).toBeGreaterThan(0);
    expect(fastDownState.mobileUp).toBe(false);
    expect(fastDownState.baby.visibility).toBe('visible');
    expect(fastDownState.maxStageGap).toBeLessThanOrEqual(1);
    await saveFrame(page, directory, `${key}-fast-boundary.png`);

    const scenario = { viewport, locale, journey, boundaryFrames, documentFrames, beforeDown, afterDown, afterUp, touchBefore, touchAtEdge, touchAfterDown, touchAfterUp, fastAfter, fastDownState };
    manifest.push(scenario);
    fs.writeFileSync(path.join(directory, 'measurements.json'), JSON.stringify(scenario, null, 2));
    for (const item of boundaryFrames) {
    }
    gallery.push(`<a class="frame" href="after-fix/${key}/${key}-down-reversal.png"><img loading="lazy" src="after-fix/${key}/${key}-down-reversal.png"><b>Immediate DOWN reversal</b></a><a class="frame" href="after-fix/${key}/${key}-up-reversal.png"><img loading="lazy" src="after-fix/${key}/${key}-up-reversal.png"><b>UP reversal</b></a><a class="frame" href="after-fix/${key}/${key}-touch-boundary.png"><img loading="lazy" src="after-fix/${key}/${key}-touch-boundary.png"><b>Short touch</b></a><a class="frame" href="after-fix/${key}/${key}-fast-boundary.png"><img loading="lazy" src="after-fix/${key}/${key}-fast-boundary.png"><b>Fast reversal</b></a>`);
    await context.close();
  }

  gallery.push('</div></section></body></html>');
  fs.writeFileSync(path.join(evidenceRoot, 'index.html'), gallery.join('\n'));
  fs.writeFileSync(path.join(evidenceRoot, 'measurements.json'), JSON.stringify(manifest, null, 2));
});
