import { useLayoutEffect, useRef } from 'react';
import { heroStageMotion, latchStageMode, stageGeometry, stageReleaseBox, stageSlidePos, stepHeroDirection } from './heroScrollProgress';

/**
 * The approved Home banner stage.
 * Desktop Home passes mobile=false, so the enable check stays
 * desktop && !reduced-motion. Other sequences pass mobile=true to run
 * the same hold, cover, and upward deck on small screens too.
 */
export function useHeroStageMotion(rootId, mobile = false) {
  const syncHeroes = useRef(() => {});

  useLayoutEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return undefined;

    const desktop = window.matchMedia('(min-width: 1101px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    let frame = 0;
    let needsMeasure = true;
    let geometryCache = null;
    let measureVersion = 0;
    let appliedVersion = -1;
    let appliedY = null;
    let cleared = false;
    let observer = null;
    const observedStrips = new Set();

    const direction = { y: window.scrollY, mode: 'down', pos: 0 };
    let shellTop = 0;
    let stageHeight = 812;
    let pinHeight = 812;
    let headerOffset = 88;
    let slides = [];

    // Cached DOM references to avoid repeated queries
    const shellEl = root.querySelector('.hero-stage-shell');
    const stageEl = root.querySelector('.hero-stage');

    const motionEnabled = () => (mobile || desktop.matches) && !reduced.matches && slides.length > 0;

    const clearMotion = () => {
      if (cleared) return;
      cleared = true;
      root.removeAttribute('data-hero-motion');
      root.style.setProperty('--brand-rail-height', '0px');
      document.body.classList.remove('hero-stage-pin');
      shellEl?.style.removeProperty('--hero-stage-span');
      if (stageEl) {
        stageEl.style.top = '';
        stageEl.style.height = '';
      }
      slides.forEach((slide) => {
        const el = slide.el;
        if (el) {
          el.style.transform = '';
          el.style.clipPath = '';
          el.style.zIndex = '';
          el.style.willChange = '';
        }
        if (slide.kind === 'strip') {
          el?.classList.remove('is-concealed');
        }
        slide.section?.removeAttribute('data-active');
      });
    };

    const cacheDOMElements = () => {
      // Pre-set will-change on animated elements for GPU compositing
      slides.forEach((slide) => {
        if (slide.el) {
          if (slide.el.style.willChange !== 'transform, clip-path') slide.el.style.willChange = 'transform, clip-path';
        }
      });
    };

    const observeGeometry = () => {
      if (!observer) return;
      const currentStrips = new Set(slides.filter((slide) => slide.kind === 'strip').map((slide) => slide.el));
      observedStrips.forEach((el) => {
        if (!currentStrips.has(el)) { observer.unobserve(el); observedStrips.delete(el); }
      });
      currentStrips.forEach((el) => {
        if (!observedStrips.has(el)) { observer.observe(el); observedStrips.add(el); }
      });
    };

    const measure = () => {
      // Read header offset only when needed (resize/media change)
      headerOffset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 88;
      const viewportHeight = window.innerHeight;

      if (desktop.matches) {
        stageHeight = Math.max(1, Math.round(viewportHeight - headerOffset));
        pinHeight = stageHeight;
      } else {
        const divisor = window.innerWidth <= 760 ? 2 : 3;
        stageHeight = Math.max(160, Math.round((viewportHeight - headerOffset) / divisor));
        pinHeight = Math.max(stageHeight, Math.round(viewportHeight - headerOffset));
      }

      // Rebuild slides array and cache DOM references
      slides = [];
      stageEl?.querySelectorAll(':scope > .home-brand').forEach((section, heroIndex) => {
        const hero = section.querySelector(':scope > .brand-showcase');
        const strip = section.querySelector(':scope > .brand-strip');
        if (hero) slides.push({ kind: 'hero', heroIndex, el: hero, section });
        if (strip) {
          const height = strip.offsetHeight;
          slides.push({
            kind: 'strip',
            heroIndex,
            el: strip,
            section,
            height: height > 0 ? height : undefined,
          });
        }
      });

      // Compute shellTop (layout read)
      if (shellEl) shellTop = shellEl.getBoundingClientRect().top + window.scrollY;

      // Recompute geometry on every measure call since stageHeight changes on resize/orientation
      geometryCache = stageGeometry(slides, stageHeight);
      measureVersion += 1;
      cleared = false;

      // All geometry reads above finish before compositing/layout writes.
      cacheDOMElements();

      const enabled = motionEnabled();
      if (shellEl && stageEl && enabled) {
        const span = geometryCache.span + pinHeight;
        const nextSpan = `${span}px`;
        if (shellEl.style.getPropertyValue('--hero-stage-span') !== nextSpan) {
          shellEl.style.setProperty('--hero-stage-span', nextSpan);
        }
        if (stageEl.style.top !== `${headerOffset}px`) stageEl.style.top = `${headerOffset}px`;
        if (stageEl.style.height !== `${pinHeight}px`) stageEl.style.height = `${pinHeight}px`;
      } else if (shellEl || stageEl) {
        shellEl?.style.removeProperty('--hero-stage-span');
        if (stageEl) {
          stageEl.style.top = '';
          stageEl.style.height = '';
        }
      }
      observeGeometry();
    };

    const apply = () => {
      const y = window.scrollY;
      if (appliedY === y && appliedVersion === measureVersion) return;
      appliedY = y;
      appliedVersion = measureVersion;
      const enabled = motionEnabled();
      if (!enabled) {
        direction.mode = 'down';
        direction.y = window.scrollY;
        clearMotion();
        return;
      }

      cleared = false;
      if (!root.hasAttribute('data-hero-motion')) root.setAttribute('data-hero-motion', '');
      const delta = y - direction.y;
      const nextMode = stepHeroDirection(direction.mode, delta);

      // Use cached geometry
      const span = geometryCache?.span ?? 0;
      const local = Math.min(span, Math.max(0, y - (shellTop - headerOffset)));
      const pos = stageSlidePos(slides, local, stageHeight, geometryCache);

      direction.mode = latchStageMode(direction.mode, delta, direction.pos, pos, slides);
      if (direction.mode !== 'up') direction.mode = 'down';
      if (nextMode === direction.mode) direction.mode = nextMode;

      const motion = heroStageMotion({
        slides,
        local,
        stageHeight,
        mode: direction.mode,
        geometry: geometryCache,
      });
      const release = stageReleaseBox(slides, stageHeight, pinHeight, y - (shellTop - headerOffset), direction.mode, geometryCache, motion);

      if (shellEl && stageEl) {
        const nextSpan = `${release.shellHeight}px`;
        if (shellEl.style.getPropertyValue('--hero-stage-span') !== nextSpan) {
          shellEl.style.setProperty('--hero-stage-span', nextSpan);
        }
        const nextBox = `${release.boxHeight}px`;
        if (stageEl.style.height !== nextBox) stageEl.style.height = nextBox;
      }

      direction.pos = pos;
      direction.y = y;

      if (release.atEnd) {
        slides.forEach((slide, index) => {
          if (index === slides.length - 1) return;
          const away = slide.kind === 'strip' && slide.height > 0 ? Math.round(slide.height) : stageHeight;
          motion[index] = { y: -away, clipTop: 0, clipBottom: 0, hidden: slide.kind === 'strip', z: 1 };
        });
      }

      const pin = y >= shellTop - headerOffset && y <= shellTop - headerOffset + span;
      if (document.body.classList.contains('hero-stage-pin') !== pin) {
        document.body.classList.toggle('hero-stage-pin', pin);
      }

      const activeHero = slides.reduce((best, slide, index) => (
        slide.kind === 'hero' && index <= Math.round(pos) ? slide.heroIndex : best
      ), 0);

      // Apply styles using cached element references from slides array
      slides.forEach((slide, index) => {
        const pose = motion[index] || { y: stageHeight, clipTop: 0, clipBottom: 0, hidden: false, z: 1 };
        const clip = (pose.clipTop || pose.clipBottom) ? `inset(${pose.clipTop}px 0 ${pose.clipBottom}px 0)` : '';
        const el = slide.el;
        if (el) {
          const transform = `translate3d(0, ${pose.y}px, 0)`;
          const zIndex = String(pose.z || 1);
          // CSSOM serializes zero units and inset shorthand differently from
          // our input strings. Cache the last writes instead of comparing those
          // serialized strings, so parked/held slides really skip DOM work.
          const previous = slide.appliedStyle || (slide.appliedStyle = {});
          if (previous.transform !== transform) { el.style.transform = transform; previous.transform = transform; }
          if (previous.clip !== clip) { el.style.clipPath = clip; previous.clip = clip; }
          if (previous.zIndex !== zIndex) { el.style.zIndex = zIndex; previous.zIndex = zIndex; }
        }
        if (slide.kind === 'strip') {
          el?.classList.toggle('is-concealed', Boolean(pose.hidden));
        }
        if (slide.kind === 'hero' && slide.heroIndex === activeHero && !slide.section?.hasAttribute('data-active')) {
          slide.section?.setAttribute('data-active', '');
        }
      });
    };

    const schedule = (measureFirst) => {
      needsMeasure = needsMeasure || measureFirst;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (needsMeasure) {
          needsMeasure = false;
          measure();
        }
        apply();
      });
    };

    const onScroll = () => schedule(false);
    const onLayout = () => schedule(true);

    syncHeroes.current = apply;

    // Initial measure and apply
    measure();
    needsMeasure = false;
    apply();

    observer = new ResizeObserver((entries) => {
      // The release animation changes the parent's height itself. That is not
      // new input geometry: only a moved shell or a resized strip needs a measure.
      const stripChanged = entries.some((entry) => {
        const slide = slides.find((item) => item.kind === 'strip' && item.el === entry.target);
        if (!slide) return false;
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.offsetHeight;
        return Math.round(height) !== Math.round(slide.height || 0);
      });
      const nextTop = shellEl ? shellEl.getBoundingClientRect().top + window.scrollY : shellTop;
      if (stripChanged || nextTop !== shellTop) onLayout();
    });
    if (root.parentElement) observer.observe(root.parentElement);
    observeGeometry();

    const stage = root.querySelector('.hero-stage');
    const stageObserver = new MutationObserver(onLayout);
    if (stage) stageObserver.observe(stage, { childList: true, subtree: true });

    window.addEventListener('scroll', onScroll, { passive: true });
    stage?.addEventListener('load', onLayout, true);
    window.addEventListener('resize', onLayout);
    desktop.addEventListener('change', onLayout);
    reduced.addEventListener('change', onLayout);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      stage?.removeEventListener('load', onLayout, true);
      window.removeEventListener('resize', onLayout);
      observer.disconnect();
      stageObserver.disconnect();
      root.removeAttribute('data-hero-motion');
      document.body.classList.remove('hero-stage-pin');
      desktop.removeEventListener('change', onLayout);
      reduced.removeEventListener('change', onLayout);
      // Clean up will-change
      slides.forEach((slide) => {
        if (slide.el) slide.el.style.willChange = '';
      });
    };
  }, [rootId, mobile]);

  useLayoutEffect(() => {
    syncHeroes.current();
  });
}