import { expect, test } from '@playwright/test';
import { installRealContentFixture } from './realContentFixture.js';

const expectedBrands = [
  'VELVET BABY', 'VELVET KIDS', 'VELVET PLAY', 'VELVET BUILD', 'VELVET LEARN', 'VELVET CREATE',
  'VELVET GAMES', 'VELVET MOVE', 'VELVET COLLECT', 'VELVET PLUSH', 'VELVET BOOKS', 'VELVET MUSLIM',
];

async function openHome(browser, { width, height, locale = 'en', mobile = true }) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: mobile ? 1 : undefined,
    locale: locale === 'ar' ? 'ar' : 'en-US',
  });
  await context.addInitScript((selectedLocale) => {
    localStorage.setItem('play-language', selectedLocale);
    const disableSmoothScroll = () => {
      if (document.documentElement) document.documentElement.style.scrollBehavior = 'auto';
    };
    disableSmoothScroll();
    document.addEventListener('DOMContentLoaded', disableSmoothScroll, { once: true });
  }, locale);
  const page = await context.newPage();
  await installRealContentFixture(page, locale);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack || error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?view=showcases', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#showcases[data-home-brand-deck] .home-brand')).toHaveCount(12);
  await page.waitForTimeout(250);
  return { context, page, errors };
}

async function scrollWheel(page, deltaY) {
  const viewport = page.viewportSize();
  await page.mouse.move(Math.round(viewport.width / 2), Math.round(viewport.height / 3));
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, deltaY);
  for (let sample = 0; sample < 20; sample += 1) {
    await page.waitForTimeout(20);
    if (await page.evaluate(() => scrollY) !== before) break;
  }
  await page.waitForTimeout(60);
  return { before, after: await page.evaluate(() => scrollY) };
}

async function waitForNativeTouchSettle(page) {
  let previous = await page.evaluate(() => scrollY);
  let stillFrames = 0;
  for (let sample = 0; sample < 40 && stillFrames < 3; sample += 1) {
    await page.waitForTimeout(50);
    const current = await page.evaluate(() => scrollY);
    stillFrames = current === previous ? stillFrames + 1 : 0;
    previous = current;
  }
  expect(stillFrames).toBe(3);
}

test('mobile reverse reveals the stacked previous banner and parks later brands', async ({ browser }) => {
  const { context, page, errors } = await openHome(browser, { width: 390, height: 844 });
  const createY = await page.evaluate(() => {
    const root = document.querySelector('#showcases');
    const sections = [...root.querySelectorAll('.home-brand')];
    const stageHeight = sections[0].querySelector('.brand-showcase').getBoundingClientRect().height;
    const header = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 72;
    const beforeCreate = sections.slice(0, 5).reduce((total, section) => (
      total + stageHeight + (section.querySelector('.brand-strip')?.offsetHeight || 0)
    ), 0);
    return root.querySelector('.hero-stage-shell').getBoundingClientRect().top + scrollY - header + beforeCreate;
  });
  await page.evaluate((y) => scrollTo(0, y), createY);
  await page.waitForTimeout(100);
  const first = await scrollWheel(page, -100);
  expect(first.after).toBeLessThan(first.before);
  await expect(page.locator('#showcases')).toHaveAttribute('data-mobile-hero-up');
  const poses = await page.locator('#showcases').evaluate((root) => {
    const heroY = (index) => new DOMMatrix(getComputedStyle(root.querySelectorAll('.home-brand')[index].querySelector('.brand-showcase')).transform).m42;
    const learnHero = root.querySelectorAll('.home-brand')[4].querySelector('.brand-showcase');
    return {
      learn: heroY(4),
      create: heroY(5),
      games: heroY(6),
      learnClip: getComputedStyle(learnHero).clipPath,
      pinHeight: root.querySelector('.hero-stage').getBoundingClientRect().height,
      stageHeight: root.querySelector('.hero-stage').getBoundingClientRect().height,
      active: root.querySelectorAll('.home-brand[data-active]').length,
    };
  });
  expect(poses.learn).toBeGreaterThanOrEqual(0);
  expect(poses.learn).toBeLessThan(poses.create);
  expect(poses.learnClip).toContain('inset(');
  expect(poses.create).toBeGreaterThan(0);
  expect(poses.games).toBeGreaterThanOrEqual(poses.pinHeight);
  expect(poses.stageHeight).toBe(844 - 72);
  expect(poses.active).toBe(1);
  const reverse = await scrollWheel(page, 100);
  expect(reverse.after).toBeGreaterThan(reverse.before);
  expect(await page.locator('.home-brand[data-active]').count()).toBe(1);
  expect(errors).toEqual([]);
  await context.close();
});

test('native page scrolling resumes beyond both ends of the mobile Home deck', async ({ browser }) => {
  const { context, page, errors } = await openHome(browser, { width: 390, height: 844 });
  const { start, stageEnd } = await page.locator('#showcases .hero-stage-shell').evaluate((shell) => {
    const top = shell.getBoundingClientRect().top + scrollY;
    const span = Number.parseFloat(shell.style.getPropertyValue('--hero-stage-span'));
    return { start: top, stageEnd: top + span };
  });
  await page.evaluate((y) => scrollTo(0, y), start + 100);
  await page.waitForTimeout(100);
  const above = await scrollWheel(page, -260);
  expect(above.after).toBeLessThan(start);
  await expect(page.locator('body')).not.toHaveClass(/hero-stage-pin/);

  await page.evaluate((y) => { document.documentElement.scrollTop = y; }, Math.max(start, stageEnd - 50));
  await page.waitForTimeout(100);
  await expect(page.locator('body')).not.toHaveClass(/hero-stage-pin/);
  let below = await scrollWheel(page, 220);
  expect(below.after).toBeGreaterThan(below.before);
  const handoff = await page.locator('#showcases .hero-stage-shell').evaluate((shell) => ({
    shellBottom: shell.getBoundingClientRect().bottom,
    footerTop: document.querySelector('#footer')?.getBoundingClientRect().top ?? Infinity,
    viewportHeight: innerHeight,
  }));
  expect(handoff.footerTop).toBeLessThan(handoff.viewportHeight);
  expect(handoff.shellBottom).toBeLessThanOrEqual(handoff.footerTop + 1);
  await expect(page.locator('body')).not.toHaveClass(/hero-stage-pin/);
  expect(errors).toEqual([]);
  await context.close();
});

test('reduced motion keeps the mobile Home brands in native page flow', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  await context.addInitScript(() => localStorage.setItem('play-language', 'en'));
  const page = await context.newPage();
  await installRealContentFixture(page, 'en');
  await page.goto('/en?view=showcases', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#showcases .home-brand')).toHaveCount(12);
  await expect(page.locator('#showcases')).not.toHaveAttribute('data-hero-motion');
  const firstBanner = page.locator('#showcases .brand-showcase').first();
  expect(await firstBanner.evaluate((element) => getComputedStyle(element).position)).toBe('relative');
  const movement = await scrollWheel(page, 300);
  expect(movement.after).toBeGreaterThan(movement.before);
  await context.close();
});

test('home order, canonical strip scope, and unique exposed cards stay correct', async ({ browser }) => {
  const { context, page, errors } = await openHome(browser, { width: 390, height: 844 });
  const brands = await page.locator('.home-brand').evaluateAll((sections) => sections.map((section) => ({
    name: section.querySelector('.brand-showcase h2')?.textContent.trim(),
    slug: section.querySelector('.brand-strip')?.dataset.brand || null,
    cards: [...(section.querySelector('.brand-strip__group')?.querySelectorAll('.brand-strip-card') || [])]
      .map((card) => card.getAttribute('href')),
  })));
  expect(brands.map((brand) => brand.name)).toEqual(expectedBrands);
  for (const brand of brands) {
    if (!brand.slug) continue;
    expect(brand.name.toLowerCase()).toContain(brand.slug);
    expect(new Set(brand.cards).size).toBe(brand.cards.length);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});

for (const viewport of [
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: 'Android 412x915', width: 412, height: 915 },
]) {
  test(`mobile ${viewport.name}: wheel, touch, reversal, and handoffs remain continuous`, async ({ browser }) => {
    const { context, page, errors } = await openHome(browser, viewport);
    await page.locator('#showcases').scrollIntoViewIfNeeded();
    let y = await page.evaluate(() => scrollY);
    let downMoves = 0;
    for (let index = 0; index < 12; index += 1) {
      const result = await scrollWheel(page, 280);
      if (result.after > result.before) downMoves += 1;
      y = result.after;
      expect(await page.locator('.home-brand[data-active]').count()).toBe(1);
    }
    expect(downMoves).toBeGreaterThanOrEqual(11);

    const cdp = await context.newCDPSession(page);
    const midX = Math.round(viewport.width / 2);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: midX, y: viewport.height - 160 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: midX, y: 180 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(y);
    await waitForNativeTouchSettle(page);

    for (const delta of [-180, 180, -180, 180]) {
      const result = await scrollWheel(page, delta);
      expect(delta > 0 ? result.after > result.before : result.after < result.before).toBe(true);
      expect(await page.locator('.home-brand[data-active]').count()).toBe(1);
    }

    let upMoves = 0;
    for (let index = 0; index < 9; index += 1) {
      const result = await scrollWheel(page, -280);
      if (result.after < result.before) upMoves += 1;
      expect(await page.locator('.home-brand[data-active]').count()).toBe(1);
    }
    expect(upMoves).toBeGreaterThanOrEqual(8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('Arabic RTL mobile scroll and mobile search still work', async ({ browser }) => {
  const { context, page, errors } = await openHome(browser, { width: 390, height: 844, locale: 'ar' });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const down = await scrollWheel(page, 280);
  expect(down.after).toBeGreaterThan(down.before);
  expect(await page.locator('.home-brand[data-active]').count()).toBe(1);
  await page.locator('.mobile-header-search-trigger').click();
  await expect(page.locator('#mobile-header-search')).toBeFocused();
  await page.locator('#mobile-header-search').fill('toy');
  await page.locator('#mobile-header-search').press('Enter');
  await expect(page).toHaveURL(/\/ar\/products\?search=toy/);
  expect(errors).toEqual([]);
  await context.close();
});

test('desktop banner sequence remains ordered and scrolls in both directions', async ({ browser }) => {
  const { context, page, errors } = await openHome(browser, { width: 1440, height: 900, mobile: false });
  expect(await page.locator('.home-brand').evaluateAll((sections) => sections.map((section) => section.querySelector('.brand-showcase h2')?.textContent.trim()))).toEqual(expectedBrands);
  await page.locator('#showcases').scrollIntoViewIfNeeded();
  const down = await scrollWheel(page, 480);
  expect(down.after).toBeGreaterThan(down.before);
  expect(await page.locator('.home-brand[data-active]').count()).toBe(1);
  const up = await scrollWheel(page, -320);
  expect(up.after).toBeLessThan(up.before);
  expect(await page.locator('.home-brand[data-active]').count()).toBe(1);
  expect(errors).toEqual([]);
  await context.close();
});

test('mobile Home Hero keeps native wheel and touch scrolling', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    localStorage.setItem('play-language', 'en');
    const disableSmoothScroll = () => {
      if (document.documentElement) document.documentElement.style.scrollBehavior = 'auto';
    };
    disableSmoothScroll();
    document.addEventListener('DOMContentLoaded', disableSmoothScroll, { once: true });
  });
  const page = await context.newPage();
  await installRealContentFixture(page, 'en');
  await page.goto('/?view=top', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => scrollTo(0, 0));
  const wheel = await scrollWheel(page, 320);
  expect(wheel.after).toBeGreaterThan(wheel.before);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 180 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 700 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => scrollY)).toBeLessThan(wheel.after);
  expect(await page.locator('#top .play-button').count()).toBe(1);
  await context.close();
});

test('brand subcategory page still renders with mobile scroll', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => localStorage.setItem('play-language', 'en'));
  const page = await context.newPage();
  await installRealContentFixture(page, 'en');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/en/brands/muslim/category/quran-learning', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.category-showcases .home-brand')).toHaveCount(3);
  const down = await scrollWheel(page, 320);
  expect(down.after).toBeGreaterThan(down.before);
  const up = await scrollWheel(page, -240);
  expect(up.after).toBeLessThan(up.before);
  expect(errors).toEqual([]);
  await context.close();
});
