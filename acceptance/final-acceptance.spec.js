import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { getBrand, velvetProducts } from '../src/data/velvetCatalog.js';
import { applyPlatformContent } from '../src/data/platformContent.js';
import { selectBrandStripProducts } from '../src/data/brandProductStrip.js';
import { getStorefrontCategories } from '../src/data/storefrontVisibility.js';

const evidenceDir = path.resolve('test-results/final-acceptance');

async function openPage(browser, pathName, width, payload) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 700, hasTouch: width < 700 });
  await context.addInitScript(() => {
    localStorage.setItem('play-language', 'en');
  });
  const page = await context.newPage();
  const pageErrors = [];
  const failedRequests = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.url()} ${request.failure()?.errorText || ''}`));
  await page.route('**/api/storefront/analytics/visitor**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('**/api/reviews**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('https://api-staging.igroup.website/api/storefront/content**', async (route) => {
    const request = route.request();
    const cors = {
      'access-control-allow-origin': request.headers().origin || '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'X-Company-Id, X-Site-Id',
      vary: 'Origin',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    return route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', headers: cors, body: JSON.stringify(payload) });
  });
  await page.goto(pathName, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  await page.waitForSelector('#showcases[data-hero-motion] .hero-stage > .home-brand .brand-showcase', { timeout: 30_000 });
  await page.waitForFunction(() => {
    const shell = document.querySelector('#showcases .hero-stage-shell');
    if (!shell) return false;
    const shellTop = shell.getBoundingClientRect().top;
    return [...document.images]
      .filter((image) => image.getBoundingClientRect().top < shellTop)
      .every((image) => image.complete);
  }, { timeout: 15_000 });
  await page.waitForTimeout(200);
  return { context, page, pageErrors, failedRequests };
}

async function layout(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#showcases');
    const shell = root?.querySelector('.hero-stage-shell');
    const stage = root?.querySelector('.hero-stage');
    const sections = [...(stage?.querySelectorAll(':scope > .home-brand') || [])];
    let cursor = 0;
    const stageHeight = sections[0]?.querySelector('.brand-showcase')?.offsetHeight || 0;
    const offsets = sections.map((section) => {
      const offset = cursor;
      cursor += stageHeight;
      cursor += section.querySelector('.brand-strip')?.offsetHeight || 0;
      return offset;
    });
    const headerOffset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
    return {
      categories: sections.length,
      stageHeight,
      stripCount: sections.filter((section) => section.querySelector('.brand-strip')).length,
      offsets,
      shellStart: shell ? shell.getBoundingClientRect().top + scrollY - headerOffset : 0,
      direction: getComputedStyle(document.documentElement).direction,
    };
  });
}

async function positionAndSnapshot(page, targetLocal, shellStart, boundary, mode, phase) {
  const currentShellStart = () => page.evaluate(() => {
    const shell = document.querySelector('#showcases .hero-stage-shell');
    const headerOffset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
    return shell ? shell.getBoundingClientRect().top + scrollY - headerOffset : 0;
  });
  if (mode === 'forward') {
    const start = await currentShellStart();
    await page.evaluate(({ start, local }) => {
      window.scrollTo({ top: start - 5, behavior: 'instant' });
      window.requestAnimationFrame(() => window.scrollTo({ top: start + local, behavior: 'instant' }));
    }, { start, local: targetLocal });
  } else {
    const start = await currentShellStart();
    await page.evaluate(async ({ start, edge, local }) => {
      window.scrollTo({ top: start + edge + 24, behavior: 'instant' });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const shell = document.querySelector('#showcases .hero-stage-shell');
      const headerOffset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
      const adjustedStart = shell ? shell.getBoundingClientRect().top + scrollY - headerOffset : start;
      window.scrollTo({ top: adjustedStart + local, behavior: 'instant' });
    }, { start, edge: boundary, local: targetLocal });
  }
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => {
    const root = document.querySelector('#showcases');
    const stage = root?.querySelector('.hero-stage');
    const stageRect = stage?.getBoundingClientRect();
    const heroes = [...(stage?.querySelectorAll(':scope > .home-brand') || [])].map((section, index) => {
      const hero = section.querySelector('.brand-showcase');
      const style = getComputedStyle(hero);
      const rect = hero.getBoundingClientRect();
      const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
      const parts = style.clipPath.match(/inset\((.*)\)/)?.[1]?.split(/[ ,]+/) || [];
      const clipTop = Number.parseFloat(parts[0]) || 0;
      const clipBottom = Number.parseFloat(parts[2]) || 0;
      const strip = section.querySelector('.brand-strip');
      const stripStyle = strip ? getComputedStyle(strip) : null;
      const stripMatrix = stripStyle ? new DOMMatrix(stripStyle.transform === 'none' ? undefined : stripStyle.transform) : null;
      const stripRect = strip?.getBoundingClientRect();
      const visible = Math.max(0, Math.min(stageRect?.bottom || 0, rect.bottom - clipBottom) - Math.max(stageRect?.top || 0, rect.top + clipTop));
      return {
        index,
        title: hero.querySelector('h2')?.textContent?.trim(),
        y: matrix.m42,
        relativeY: rect.top - (stageRect?.top || 0),
        clipTop,
        clipBottom,
        visible: Math.round(visible),
        z: Number(style.zIndex) || 0,
        active: section.hasAttribute('data-active'),
        hasStrip: Boolean(strip),
        stripY: stripMatrix?.m42 ?? null,
        stripZ: stripStyle ? Number(stripStyle.zIndex) || 0 : null,
        stripOpacity: stripStyle ? stripStyle.opacity : null,
        stripVisibility: stripStyle ? stripStyle.visibility : null,
        stripRect: stripRect ? { x: stripRect.x, y: stripRect.y, width: stripRect.width, height: stripRect.height } : null,
        stripVisible: stripRect && stageRect ? Math.max(0, Math.min(stageRect.bottom, stripRect.bottom) - Math.max(stageRect.top, stripRect.top)) : 0,
      };
    });
    return {
      scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      shellTop: root?.querySelector('.hero-stage-shell')?.getBoundingClientRect().top,
      localScroll: Math.round(scrollY - ((root?.querySelector('.hero-stage-shell')?.getBoundingClientRect().top || 0) + scrollY - (Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0))),
      homeReversePhase: root?.getAttribute('data-home-reverse-phase'),
      mobileReversePhase: root?.getAttribute('data-mobile-reverse-phase'),
      mobileUp: root?.hasAttribute('data-mobile-hero-up') || false,
      heroes,
    };
  });
  const rect = await page.locator('#showcases .hero-stage').boundingBox();
  await page.screenshot({ path: path.join(evidenceDir, `${mode}-${phase.toFixed(1)}-${page.viewportSize().width}-${page.url().includes('/brands/') ? 'brand' : 'home'}.png`), clip: rect });
  return state;
}

async function rapidBoundaryCycle(page, shellStart, boundary) {
  const samples = [];
  for (const local of [boundary + 14, boundary - 4, boundary + 4, boundary - 4, boundary + 14]) {
    await page.evaluate((local) => {
      const shell = document.querySelector('#showcases .hero-stage-shell');
      const headerOffset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
      const start = shell ? shell.getBoundingClientRect().top + scrollY - headerOffset : 0;
      window.scrollTo({ top: start + local, behavior: 'instant' });
    }, local);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    samples.push(await page.evaluate(() => {
      const root = document.querySelector('#showcases');
      const stage = root?.querySelector('.hero-stage');
      const stageRect = stage?.getBoundingClientRect();
      const active = [...(stage?.querySelectorAll(':scope > .home-brand[data-active]') || [])]
        .map((section) => [...stage.querySelectorAll(':scope > .home-brand')].indexOf(section));
      const visible = [...(stage?.querySelectorAll(':scope > .home-brand .brand-showcase') || [])].filter((hero) => {
        const rect = hero.getBoundingClientRect();
        return stageRect && rect.bottom > stageRect.top + 1 && rect.top < stageRect.bottom - 1;
      }).length;
      return { active, visible, reversePhase: root?.getAttribute('data-home-reverse-phase'), mobileReversePhase: root?.getAttribute('data-mobile-reverse-phase') };
    }));
  }
  expect(samples.every((sample) => sample.visible > 0 && sample.active.length === 1)).toBe(true);
  return samples;
}

async function stageEndpoint(page, phase, name) {
  const position = await page.evaluate((selectedPhase) => {
    const root = document.querySelector('#showcases');
    const shell = root?.querySelector('.hero-stage-shell');
    const stage = root?.querySelector('.hero-stage');
    const headerOffset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
    const start = shell ? shell.getBoundingClientRect().top + scrollY - headerOffset : 0;
    const pinnedSpan = Number.parseFloat(getComputedStyle(shell).getPropertyValue('--hero-stage-span')) || 0;
    const stageHeight = stage?.getBoundingClientRect().height || innerHeight - headerOffset;
    const local = selectedPhase === 'entry' ? 0 : pinnedSpan + stageHeight + 20;
    window.scrollTo({ top: start + local, behavior: 'instant' });
    return local;
  }, phase);
  for (let attempt = 0; attempt < (phase === 'exit' ? 3 : 1); attempt += 1) {
    if (attempt > 0) {
      await page.evaluate((local) => {
        const root = document.querySelector('#showcases');
        const shell = root?.querySelector('.hero-stage-shell');
        const headerOffset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
        const start = shell ? shell.getBoundingClientRect().top + scrollY - headerOffset : 0;
        window.scrollTo({ top: start + local, behavior: 'instant' });
      }, position);
    }
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  await page.waitForTimeout(150);
  const result = await page.evaluate(() => {
    const root = document.querySelector('#showcases');
    const stage = root?.querySelector('.hero-stage');
    const bounds = stage?.getBoundingClientRect();
    const viewportVisible = Boolean(bounds && bounds.bottom > 0 && bounds.top < innerHeight);
    const visibleHeroes = viewportVisible ? [...(stage?.querySelectorAll(':scope > .home-brand .brand-showcase') || [])].filter((hero) => {
      const rect = hero.getBoundingClientRect();
      return rect.bottom > Math.max(0, bounds.top) && rect.top < Math.min(innerHeight, bounds.bottom);
    }).length : 0;
    const visibleStrips = viewportVisible ? [...(stage?.querySelectorAll(':scope > .home-brand .brand-strip') || [])].filter((strip) => {
      const rect = strip.getBoundingClientRect();
      return !strip.classList.contains('is-concealed')
        && getComputedStyle(strip).visibility !== 'hidden'
        && rect.bottom > Math.max(0, bounds.top) && rect.top < Math.min(innerHeight, bounds.bottom);
    }).length : 0;
    const active = [...(stage?.querySelectorAll(':scope > .home-brand[data-active]') || [])].length;
    const shell = root?.querySelector('.hero-stage-shell');
    return {
      viewportVisible, visibleHeroes, visibleStrips, active, top: bounds?.top ?? null, bottom: bounds?.bottom ?? null,
      scrollY, maxScroll: document.documentElement.scrollHeight - innerHeight,
      shellTop: shell?.getBoundingClientRect().top ?? null,
      shellBottom: shell?.getBoundingClientRect().bottom ?? null,
      shellHeight: shell?.getBoundingClientRect().height ?? null,
    };
  });
  await page.screenshot({ path: path.join(evidenceDir, `${name}-${page.viewportSize().width}-${page.url().includes('/brands/') ? 'brand' : 'home'}.png`) });
  return { requestedLocal: position, ...result };
}

test('compare Home and Brand category stage motion using read-only Staging catalog', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const stagingResponse = await fetch('https://api-staging.igroup.website/api/storefront/content?locale=en', {
    headers: { 'X-Company-Id': 'kids-velvet', 'X-Site-Id': 'kids-velvet-storefront' },
  });
  expect(stagingResponse.status).toBe(200);
  const stagingPayload = await stagingResponse.json();
  const report = [];
  const errors = [];
  for (const width of [390, 1366]) {
    const home = await openPage(browser, '/en/?view=showcases', width, stagingPayload);
    const brand = await openPage(browser, '/en/brands/baby', width, stagingPayload);
    const homeLayout = await layout(home.page);
    const brandLayout = await layout(brand.page);
    expect(homeLayout.categories).toBe(12);
    expect(brandLayout.categories).toBe(10);
    expect(brandLayout.stripCount).toBeGreaterThan(0);
    expect(brandLayout.stageHeight).toBe(homeLayout.stageHeight);
    expect(Math.abs(brandLayout.offsets[1] - homeLayout.offsets[1])).toBeLessThanOrEqual(3);

    const offsets = [homeLayout.offsets[1], brandLayout.offsets[1]];
    const stageHeights = [homeLayout.stageHeight, brandLayout.stageHeight];
    const phases = {};
    for (const direction of ['forward', 'reverse']) {
      phases[direction] = {};
      for (const phase of [.2, .5, .8]) {
        const homeLocal = direction === 'reverse' ? offsets[0] - stageHeights[0] * phase : offsets[0] * phase;
        const brandLocal = direction === 'reverse' ? offsets[1] - stageHeights[1] * phase : offsets[1] * phase;
        phases[direction][phase] = {
          home: await positionAndSnapshot(home.page, homeLocal, homeLayout.shellStart, offsets[0], direction, phase),
          brand: await positionAndSnapshot(brand.page, brandLocal, brandLayout.shellStart, offsets[1], direction, phase),
        };
        const paired = phases[direction][phase];
        expect(paired.brand.homeReversePhase).toBe(paired.home.homeReversePhase);
        for (const index of [0, 1]) {
          const left = paired.home.heroes[index];
          const right = paired.brand.heroes[index];
          const leftLayerVisible = left.visible > 4 || left.stripVisible > 4;
          const rightLayerVisible = right.visible > 4 || right.stripVisible > 4;
          const layerVisible = leftLayerVisible || rightLayerVisible;
          expect(leftLayerVisible, `${width}px ${direction} ${phase}: hero ${index} visibility`).toBe(rightLayerVisible);
          if (!layerVisible) continue;
          for (const key of ['relativeY', 'clipTop', 'clipBottom', 'visible', 'z', 'active', 'hasStrip', 'stripVisible']) {
            if (typeof left[key] === 'number') expect(Math.abs(left[key] - right[key]), `${width}px ${direction} ${phase}: hero ${index} ${key}`).toBeLessThanOrEqual(4);
            else expect(right[key], `${width}px ${direction} ${phase}: hero ${index} ${key}`).toBe(left[key]);
          }
          if (left.stripVisible > 0 || right.stripVisible > 0) {
            expect(Math.abs(left.stripY - right.stripY), `${width}px ${direction} ${phase}: hero ${index} visible strip pose`).toBeLessThanOrEqual(4);
          }
        }
      }
    }
    const boundaryCycle = {
      home: await rapidBoundaryCycle(home.page, homeLayout.shellStart, homeLayout.offsets[1]),
      brand: await rapidBoundaryCycle(brand.page, brandLayout.shellStart, brandLayout.offsets[1]),
    };
    expect(boundaryCycle.brand.map((sample) => sample.active)).toEqual(boundaryCycle.home.map((sample) => sample.active));
    expect(boundaryCycle.brand.map((sample) => sample.reversePhase)).toEqual(boundaryCycle.home.map((sample) => sample.reversePhase));
    const endpoints = {};
    // Category stages place the current category's product strip in the lower
    // lane where Home can show a second banner, so compare owner and clean
    // entry/exit occupancy instead of requiring equal hero counts.
    for (const phase of ['entry', 'exit']) {
      endpoints[phase] = {
        home: await stageEndpoint(home.page, phase, phase),
        brand: await stageEndpoint(brand.page, phase, phase),
      };
      console.log(`${width}px ${phase} endpoints`, JSON.stringify(endpoints[phase]));
      expect(endpoints[phase].brand.active).toBe(endpoints[phase].home.active);
    }
    expect(endpoints.entry.home.visibleHeroes).toBeGreaterThan(0);
    expect(endpoints.entry.brand.visibleHeroes).toBeGreaterThan(0);
    if (width <= 430) {
      expect(endpoints.entry.home.visibleStrips).toBeGreaterThan(0);
      expect(endpoints.entry.brand.visibleStrips).toBeGreaterThan(0);
    }
    expect(endpoints.exit.home.visibleHeroes).toBe(0);
    expect(endpoints.exit.brand.visibleHeroes).toBe(0);
    expect(endpoints.exit.home.visibleStrips).toBe(0);
    expect(endpoints.exit.brand.visibleStrips).toBe(0);
    errors.push(...home.pageErrors.map((message) => `home/${width}: ${message}`), ...brand.pageErrors.map((message) => `brand/${width}: ${message}`));
    errors.push(...home.failedRequests.map((message) => `home/${width}: ${message}`), ...brand.failedRequests.map((message) => `brand/${width}: ${message}`));
    report.push({ width, homeLayout, brandLayout, phases, boundaryCycle, endpoints });
    await home.context.close();
    await brand.context.close();
  }
  expect(errors).toEqual([]);
  fs.writeFileSync(path.join(evidenceDir, 'motion-comparison.json'), JSON.stringify(report, null, 2));
});

test('verify every live Staging Brand Page, category strip relationship, View All route, and cart flow', async ({ browser }) => {
  test.setTimeout(420_000);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const response = await fetch('https://api-staging.igroup.website/api/storefront/content?locale=en', {
    headers: { 'X-Company-Id': 'kids-velvet', 'X-Site-Id': 'kids-velvet-storefront' },
  });
  expect(response.status).toBe(200);
  const payload = await response.json();
  applyPlatformContent(payload, 'https://api-staging.igroup.website');
  const openLive = async (locale, width, brandSlug = 'baby', waitForProduct = true) => {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      isMobile: width <= 430,
      hasTouch: width <= 430,
      deviceScaleFactor: 1,
    });
    await context.addInitScript((language) => {
      localStorage.setItem('play-language', language);
      localStorage.removeItem('play-store-cart-v1');
    }, locale);
    const page = await context.newPage();
    await page.route('**/api/storefront/analytics/visitor**', (route) => route.fulfill({ status: 204, body: '' }));
    await page.route('**/api/reviews**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('https://api-staging.igroup.website/api/storefront/content**', async (route) => {
      const request = route.request();
      const cors = {
        'access-control-allow-origin': request.headers().origin || '*',
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': 'X-Company-Id, X-Site-Id',
        vary: 'Origin',
      };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      return route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', headers: cors, body: JSON.stringify(payload) });
    });
    await page.goto(`/${locale}/brands/${brandSlug}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#showcases .home-brand .brand-showcase');
    if (waitForProduct) await page.waitForSelector('#showcases .brand-strip-card');
    return { context, page };
  };

  const brandBoundaryEvidence = [];
  for (const locale of ['en', 'ar']) {
    const { context, page } = await openLive(locale, 390, 'baby', false);
    for (const platformBrand of payload.brands || []) {
      const slug = String(platformBrand.slug || '');
      if (slug !== 'baby') await page.goto(`/${locale}/brands/${slug}`, { waitUntil: 'domcontentloaded' });
      const brand = getBrand(slug);
      expect(brand, `${locale}/${slug} resolves to a catalog brand`).not.toBeNull();
      const categories = getStorefrontCategories(brand);
      const sections = page.locator('#showcases .hero-stage > .home-brand');
      await expect(sections, `${locale}/${slug} renders every visible main category`).toHaveCount(categories.length);
      try {
        await page.waitForFunction(() => {
          const stage = document.querySelector('#showcases .hero-stage');
          const bounds = stage?.getBoundingClientRect();
          if (!stage || !bounds) return false;
          const activeImages = [...stage.querySelectorAll(':scope > .home-brand[data-active] .brand-showcase__image')];
          return activeImages.length > 0 && activeImages.every((image) => image.naturalWidth > 0);
        }, null, { timeout: 20_000 });
      } catch (error) {
        const imageStates = await page.evaluate(() => [...document.querySelectorAll('#showcases .brand-showcase__image')]
          .map((image) => ({ src: image.currentSrc || image.src, complete: image.complete, naturalWidth: image.naturalWidth })));
        console.log(`${locale}/${slug} banner image states`, JSON.stringify(imageStates));
        throw error;
      }
      const deck = await layout(page);
      for (let index = 0; index < categories.length; index += 1) {
        await page.evaluate(({ shellStart, local }) => {
          window.scrollTo({ top: shellStart + local, behavior: 'instant' });
        }, { shellStart: deck.shellStart, local: deck.offsets[index] });
        await page.waitForFunction((selectedIndex) => {
          const section = document.querySelectorAll('#showcases .hero-stage > .home-brand')[selectedIndex];
          const hero = section?.querySelector('.brand-showcase');
          const image = hero?.querySelector('.brand-showcase__image');
          const rect = hero?.getBoundingClientRect();
          return Boolean(rect && rect.bottom > 0 && rect.top < innerHeight && image?.naturalWidth > 0);
        }, index, { timeout: 20_000 });
      }
      const rendered = await page.evaluate(() => ({
        direction: getComputedStyle(document.documentElement).direction,
        sections: [...document.querySelectorAll('#showcases .hero-stage > .home-brand')].map((section) => {
          const hero = section.querySelector('.brand-showcase');
          const image = hero?.querySelector('.brand-showcase__image');
          const strip = section.querySelector('.brand-strip');
          const firstGroup = strip?.querySelector('.brand-strip__group');
          return {
            name: hero?.querySelector('h2')?.textContent?.trim() || '',
            image: image?.currentSrc || image?.src || '',
            imageWidth: image?.naturalWidth || 0,
            strip: strip ? {
              brand: strip.getAttribute('data-brand'),
              category: strip.getAttribute('data-category'),
              viewAll: strip.querySelector('.brand-strip__all')?.getAttribute('href') || '',
              products: [...(firstGroup?.querySelectorAll('.brand-strip-card') || [])]
                .map((card) => card.getAttribute('href') || ''),
            } : null,
          };
        }),
      }));
      expect(rendered.direction, `${locale}/${slug} direction`).toBe(locale === 'ar' ? 'rtl' : 'ltr');
      for (let index = 0; index < categories.length; index += 1) {
        const category = categories[index];
        const actual = rendered.sections[index];
        expect(actual.name, `${locale}/${slug}/${category.slug} banner title`).toBe(category.name[locale]);
        expect(actual.imageWidth, `${locale}/${slug}/${category.slug} real banner image`).toBeGreaterThan(0);
        if (category.heroImage) {
          expect(actual.image).toBe(new URL(category.heroImage, page.url()).href);
        }
        const expectedProducts = selectBrandStripProducts(velvetProducts, slug, { categorySlug: category.slug });
        if (expectedProducts.length) {
          expect(actual.strip, `${locale}/${slug}/${category.slug} category strip`).not.toBeNull();
          expect(actual.strip.brand).toBe(slug);
          expect(actual.strip.category).toBe(category.slug);
          expect(actual.strip.viewAll).toBe(`/${locale}/products?brand=${encodeURIComponent(slug)}&category=${encodeURIComponent(category.slug)}`);
          const expectedSlugs = expectedProducts.slice(0, 8).map((product) => product.slug);
          const actualSlugs = actual.strip.products.map((href) => new URL(href, page.url()).pathname.split('/').at(-1));
          expect(actualSlugs, `${locale}/${slug}/${category.slug} only related products`).toEqual(expectedSlugs);
        } else {
          expect(actual.strip, `${locale}/${slug}/${category.slug} has no unrelated strip`).toBeNull();
        }
      }

      if (locale === 'en' && slug === 'play') {
        expect(deck.categories).toBe(categories.length);
        expect(categories.length).toBeGreaterThan(11);
        for (let boundary = 1; boundary < deck.offsets.length; boundary += 1) {
          const samples = await rapidBoundaryCycle(page, deck.shellStart, deck.offsets[boundary]);
          brandBoundaryEvidence.push({ brand: slug, boundary, category: categories[boundary].slug, samples });
        }
      }
    }
    await context.close();
  }
  expect(brandBoundaryEvidence).toHaveLength(getStorefrontCategories(getBrand('play')).length - 1);
  fs.writeFileSync(path.join(evidenceDir, 'all-brand-pages-and-boundaries.json'), JSON.stringify(brandBoundaryEvidence, null, 2));

  for (const locale of ['en', 'ar']) {
    const { context, page } = await openLive(locale, 390);
    const viewAll = page.locator('#showcases .brand-strip__all').first();
    const href = await viewAll.getAttribute('href');
    expect(href).toMatch(new RegExp(`/${locale}/products\\?brand=baby&category=`));
    const category = await page.locator('#showcases .home-brand').first().locator('.brand-strip').getAttribute('data-category');
    expect(href).toContain(`category=${encodeURIComponent(category)}`);
    await viewAll.click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/products\\?brand=baby&category=${encodeURIComponent(category)}`));
    await context.close();
  }

  for (const width of [320, 390, 430]) {
    const { context, page } = await openLive('en', width);
    const productCard = page.locator('#showcases .brand-strip-card').first();
    const productHref = await productCard.getAttribute('href');
    expect(productHref).toMatch(/^\/en\/products\//);
    await productCard.evaluate((element) => element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })));
    await productCard.click();
    await expect(page).toHaveURL(new RegExp(`${productHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    const addButton = page.locator('.product-detail-buy__primary');
    await expect(addButton).toBeEnabled();
    await addButton.click();
    await page.evaluate(() => window.scrollTo({ top: 240, behavior: 'instant' }));
    const capsule = page.locator('.compact-header-actions');
    const stickyCart = page.locator('.compact-header-cart');
    await expect(capsule).toBeVisible();
    await expect(stickyCart).toHaveAttribute('aria-label', /1/);
    await expect(stickyCart.locator('.header-cart-count')).toHaveText('1');
    const geometry = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect().toJSON();
      return { capsule: rect('.compact-header-actions'), menu: rect('.menu-toggle'), logo: rect('.site-header .logo') };
    });
    expect(geometry.capsule.width).toBe(92);
    expect(geometry.capsule.height).toBe(44);
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    expect(overlaps(geometry.capsule, geometry.menu)).toBe(false);
    expect(overlaps(geometry.capsule, geometry.logo)).toBe(false);
    await page.screenshot({ path: path.join(evidenceDir, `live-cart-${width}.png`) });
    await stickyCart.click();
    await expect(page.locator('.cart-drawer.is-open')).toBeVisible();
    await expect(page.locator('.cart-drawer__name')).toBeVisible();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('play-store-cart-v1') || '[]'));
    expect(stored).toHaveLength(1);
    expect(stored[0].slug).toBe(productHref.split('/').at(-1));
    expect(stored[0].quantity).toBe(1);
    await context.close();
  }
});
