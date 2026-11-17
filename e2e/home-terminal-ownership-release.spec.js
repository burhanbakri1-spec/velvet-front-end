import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { installRealContentFixture } from './realContentFixture.js';

const evidenceDir = path.resolve(process.env.CONTINUITY_EVIDENCE_DIR || 'continuity-evidence');
const viewports = [
  { name: '320x720', width: 320, height: 720, mobile: true },
  { name: '390x720', width: 390, height: 720, mobile: true },
  { name: '392x720', width: 392, height: 720, mobile: true },
  { name: '430x932', width: 430, height: 932, mobile: true },
  { name: '1366x768', width: 1366, height: 768, mobile: false },
];

test('Home Muslim terminal releases and re-enters reverse ownership across locales and viewport sizes', async ({ browser }) => {
  test.setTimeout(180_000);
  fs.mkdirSync(evidenceDir, { recursive: true });

  for (const locale of ['ar', 'en']) {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.mobile,
        hasTouch: viewport.mobile,
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
        const last = document.querySelector('#showcases .hero-stage > .home-brand:last-child .brand-showcase__image');
        return last?.complete && last.naturalWidth > 0;
      });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

      const layout = await page.evaluate(() => {
        const root = document.querySelector('#showcases');
        const shell = root.querySelector('.hero-stage-shell');
        const stage = root.querySelector('.hero-stage');
        const sections = [...stage.querySelectorAll(':scope > .home-brand')];
        const stageHeight = sections[0].querySelector('.brand-showcase').offsetHeight;
        const pinHeight = stage.getBoundingClientRect().height;
        const headerHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
        let cursor = 0;
        let span = 0;
        sections.forEach((section) => {
          span = cursor;
          cursor += stageHeight;
          const strip = section.querySelector('.home-brand__product-layer > .brand-strip');
          if (strip) {
            span = cursor;
            cursor += strip.offsetHeight;
          }
        });
        const shellStart = shell.getBoundingClientRect().top + scrollY - headerHeight;
        return {
          shellStart,
          span,
          stageHeight,
          pinHeight,
          terminalBanner: sections.at(-1).querySelector('.brand-showcase').querySelector('a[href*="/brands/"]')?.getAttribute('href'),
          nextSection: root.nextElementSibling?.tagName || null,
        };
      });
      const terminalBoundary = layout.span;

      const sample = async (local, stableFrames = 2) => {
        await page.evaluate(({ top, offset }) => window.scrollTo({ top: top + offset, behavior: 'instant' }), {
          top: layout.shellStart,
          offset: local,
        });
        await page.evaluate((frames) => new Promise((resolve) => {
          let count = 0;
          const next = () => {
            count += 1;
            if (count >= frames) resolve();
            else requestAnimationFrame(next);
          };
          requestAnimationFrame(next);
        }), stableFrames);
        return page.evaluate(() => {
          const root = document.querySelector('#showcases');
          const stage = root.querySelector('.hero-stage');
          const active = stage.querySelector('.home-brand[data-active] .brand-showcase a[href*="/brands/"]')?.getAttribute('href') || null;
          return {
            local: scrollY - (root.querySelector('.hero-stage-shell').getBoundingClientRect().top + scrollY
              - (Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0)),
            reverse: root.hasAttribute('data-home-reverse-phase') || root.hasAttribute('data-mobile-hero-up'),
            phase: root.getAttribute('data-home-reverse-phase'),
            pinned: document.body.classList.contains('hero-stage-pin'),
            active,
          };
        });
      };

      await sample(terminalBoundary + 8);
      const reverse = await sample(terminalBoundary - 8);
      expect(reverse.reverse, `${locale} ${viewport.name}: reverse ownership enters at Muslim`).toBe(true);
      expect(reverse.active, `${locale} ${viewport.name}: Muslim remains the active banner`).toContain('/muslim');
      if (viewport.name === '392x720') {
        await page.screenshot({ path: path.join(evidenceDir, `home-${locale}-${viewport.name}-terminal-reverse.png`), animations: 'disabled' });
      }

      const released = await sample(terminalBoundary + 2, 8);
      expect(released.reverse, `${locale} ${viewport.name}: raw scroll past terminal releases reverse ownership after eight frames`).toBe(false);
      expect(released.active, `${locale} ${viewport.name}: Muslim is active after release`).toContain('/muslim');
      if (viewport.name === '392x720') {
        await page.screenshot({ path: path.join(evidenceDir, `home-${locale}-${viewport.name}-terminal-released.png`), animations: 'disabled' });
      }

      for (const [index, local] of [terminalBoundary - 2, terminalBoundary + 2, terminalBoundary - 2, terminalBoundary + 2].entries()) {
        const state = await sample(local, 3);
        expect(state.reverse, `${locale} ${viewport.name}: repeated terminal crossing ${index + 1}`).toBe(index % 2 === 0);
      }

      await sample(terminalBoundary + layout.pinHeight + layout.stageHeight, 8);
      const exit = await page.evaluate(() => ({
        pinned: document.body.classList.contains('hero-stage-pin'),
        nextTop: document.querySelector('#showcases')?.nextElementSibling?.getBoundingClientRect().top ?? null,
      }));
      expect(exit.pinned, `${locale} ${viewport.name}: Home pin releases after the terminal stage`).toBe(false);
      expect(exit.nextTop, `${locale} ${viewport.name}: the following Home section enters`).toBeLessThan(viewport.height);
      expect(pageErrors, `${locale} ${viewport.name}: no browser runtime errors`).toEqual([]);
      console.log(`${locale} ${viewport.name}`, JSON.stringify({ layout, reverse, released, exit }));
      await context.close();
    }
  }
});
