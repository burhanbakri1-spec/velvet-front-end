import { useLayoutEffect, useRef } from 'react';
import { notebookReleaseAllowance, notebookTabLifts } from './notebookTabPreview';
import { activeHeroIndex, applyMobileUpHandoff, canDeferOffscreenPoseWrite, crossBannerUnwind, heroStageMotion, HOME_REVERSE_POSE_HANDOFF_DISTANCE, homeReverseEntry, homeReverseMotion, joinCategoryHandoff, latchHomeDeckMode, latchStageMode, mobileUpHandoff, restoreMobileUpLayout, stageGeometry, stageReleaseBox, stageSlidePos, stepHeroDirection } from './heroScrollProgress';

const MOBILE_UP_DECK_DEPTH = 8;

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
    let mobileUpLayoutAnchor = null;
    let lastLayoutRelease = null;
    let mobileUpPoseHandoff = null;
    let mobileHomeReverseEntry = null;
    let mobileHomeReverseExit = null;
    let lastHomeReversePose = null;
    let lastReverseHero = null;
    let crossUnwind = null;
    let completedCrossUnwind = false;
    let lastDeckFrame = null;
    let deckReverseBridge = null;

    const direction = { y: window.scrollY, mode: 'down', pos: 0 };
    let shellTop = 0;
    let stageHeight = 812;
    let pinHeight = 812;
    let headerOffset = 88;
    let slides = [];

    // Cached DOM references to avoid repeated queries
    const shellEl = root.querySelector('.hero-stage-shell');
    const stageEl = root.querySelector('.hero-stage');
    const notebookPreview = document.documentElement.getAttribute?.('data-notebook-clearance-preview');
    const homeNotebook = root.hasAttribute('data-home-brand-deck');
    const dynamicTabPreview = homeNotebook && notebookPreview === 'dynamic';
    const releasePreview = notebookPreview === 'release';
    const finalPreview = releasePreview
      && document.documentElement.hasAttribute('data-notebook-shared-exit');
    const fixedTabPreview = homeNotebook && (notebookPreview === 'combined' || releasePreview);
    let notebookRise = 0;
    let notebookPocket = 0;
    let notebookFixedLift = 0;
    const categoryNav = root.hasAttribute('data-brand-category-deck')
      ? root.closest('.category-page')?.querySelector(':scope > .page-nav--sticky')
      : null;
    const categoryHeader = finalPreview && root.hasAttribute('data-brand-category-deck')
      ? root.closest('.category-page')?.querySelector('.brand-hero')
      : null;
    let categoryNavHeight = 0;

    // Match the banners' small viewport, which stays fixed while Android's
    // browser toolbar retracts. innerHeight instead remaps every scroll slot.
    const viewportProbe = mobile ? document.createElement('div') : null;
    if (viewportProbe) {
      viewportProbe.setAttribute('data-hero-viewport', '');
      viewportProbe.setAttribute('aria-hidden', 'true');
      viewportProbe.style.cssText = 'position:absolute;top:0;left:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none;contain:strict;';
      root.appendChild(viewportProbe);
    }

    const motionEnabled = () => (mobile || desktop.matches) && !reduced.matches && slides.length > 0;

    const clearMotion = () => {
      if (cleared) return;
      cleared = true;
      root.removeAttribute('data-hero-motion');
      root.removeAttribute('data-mobile-hero-up');
      root.removeAttribute('data-mobile-reverse-phase');
      root.removeAttribute('data-home-reverse-phase');
      root.removeAttribute('data-notebook-unwinding');
      root.style.setProperty('--brand-rail-height', '0px');
      document.body.classList.remove('hero-stage-pin');
      categoryNav?.style.removeProperty('--category-nav-reveal');
      shellEl?.style.removeProperty('--hero-stage-span');
      shellEl?.style.removeProperty('--mobile-up-stage-span');
      mobileUpLayoutAnchor = null;
      lastLayoutRelease = null;
      mobileUpPoseHandoff = null;
      mobileHomeReverseEntry = null;
      mobileHomeReverseExit = null;
      lastHomeReversePose = null;
      lastReverseHero = null;
      crossUnwind = null;
      completedCrossUnwind = false;
      lastDeckFrame = null;
      deckReverseBridge = null;
      if (stageEl) {
        stageEl.style.top = '';
        stageEl.style.height = '';
      }
      slides.forEach((slide) => {
        const el = slide.el;
        if (el) {
          el.style.transform = '';
          el.style.clipPath = '';
          if (slide.artwork) slide.artwork.style.clipPath = '';
          if (slide.tabEdge) {
            slide.tabEdge.style.visibility = '';
            slide.tabEdge.style.removeProperty('--notebook-seam-clip');
          }
          el.style.zIndex = '';
          el.style.willChange = '';
          if (dynamicTabPreview) {
            el.style.removeProperty('--notebook-lift');
            el.style.removeProperty('--notebook-connector');
          }
          if (slide.kind === 'hero') el.style.height = '';
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
      const previousStageHeight = stageHeight;
      const previousPinHeight = pinHeight;
      // Read header offset only when needed (resize/media change)
      headerOffset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 88;
      categoryNavHeight = categoryNav?.offsetHeight || 0;
      const viewportHeight = !desktop.matches && viewportProbe
        ? viewportProbe.getBoundingClientRect().height || window.innerHeight
        : window.innerHeight;
      const availableHeight = Math.max(1, Math.round(viewportHeight - headerOffset));

      if (desktop.matches) {
        // Match the original desktop banner geometry: the banner fills the
        // pinned stage, with no per-banner inline height cap.
        stageHeight = availableHeight;
        pinHeight = stageHeight;
      } else {
        const divisor = window.innerWidth <= 760 ? 2 : 3;
        stageHeight = Math.max(160, Math.round((viewportHeight - headerOffset) / divisor));
        // Tablet banner/product pairs must be able to cover the pinned scene
        // without leaving a white tail under the outgoing banner. Fit the
        // banner to the shortest real strip in this Home deck, measured only
        // during layout work (never in the scroll frame).
        const homeDeck = rootId === 'showcases'
          && (root.hasAttribute('data-home-brand-deck') || root.hasAttribute('data-brand-category-deck'));
        if (homeDeck && window.innerWidth > 760 && window.innerWidth <= 1100) {
          const stripHeights = [...root.querySelectorAll('.home-brand__product-layer > .brand-strip')]
            .map((strip) => Math.round(strip.offsetHeight))
            .filter((height) => height > 0);
          if (stripHeights.length) {
            const shortestStrip = Math.min(...stripHeights);
            stageHeight = Math.max(stageHeight, availableHeight - shortestStrip);
          }
        }
        pinHeight = Math.max(stageHeight, availableHeight);
      }
      if (stageHeight !== previousStageHeight || pinHeight !== previousPinHeight) {
        mobileUpLayoutAnchor = null;
        lastLayoutRelease = null;
        mobileUpPoseHandoff = null;
        mobileHomeReverseEntry = null;
        mobileHomeReverseExit = null;
        lastHomeReversePose = null;
        lastReverseHero = null;
        crossUnwind = null;
        completedCrossUnwind = false;
        lastDeckFrame = null;
        deckReverseBridge = null;
      }

      // Rebuild slides array and cache DOM references
      slides = [];
      notebookRise = 0;
      stageEl?.querySelectorAll(':scope > .home-brand').forEach((section, heroIndex) => {
        const hero = section.querySelector(':scope > .home-brand__banner-layer > .brand-showcase');
        const strip = section.querySelector(':scope > .home-brand__product-layer > .brand-strip');
        if (hero) {
          const slide = { kind: 'hero', heroIndex, el: hero, section };
          if (releasePreview) {
            slide.artwork = hero.querySelector('.brand-showcase__artwork');
            if (slide.artwork) slide.tabEdge = hero.querySelector('.brand-showcase__notebook-edge');
          }
          if (dynamicTabPreview) {
            const tab = hero.querySelector('.brand-showcase__notebook-tab');
            if (tab && !notebookRise) notebookRise = tab.offsetHeight;
            slide.notebookHeight = stageHeight;
            const logo = hero.querySelector('.brand-showcase__brand-logo');
            if (logo) {
              const artTop = hero.getBoundingClientRect().top;
              const rect = logo.getBoundingClientRect();
              slide.notebookLogo = { top: rect.top - artTop, bottom: rect.bottom - artTop };
            }
          }
          slides.push(slide);
        }
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

      if (dynamicTabPreview) {
        const scale = Number.parseFloat(getComputedStyle(root).getPropertyValue('--notebook-pocket-scale'));
        notebookPocket = notebookRise * (scale || 1);
      }

      if (releasePreview && stageEl) {
        const rise = stageEl.querySelector('.brand-showcase__notebook-tab')?.offsetHeight || 0;
        notebookFixedLift = Number.parseFloat(getComputedStyle(root).getPropertyValue('--notebook-fixed-lift')) || 0;
        notebookPocket = rise + notebookFixedLift;
      }

      if (shellEl) {
        const scrollY = window.scrollY;
        const nextTop = shellEl.getBoundingClientRect().top + scrollY;
        const previousLocal = scrollY - shellTop + headerOffset;
        const offsetChange = nextTop - shellTop;
        if (finalPreview && geometryCache && offsetChange
          && document.body.classList.contains('hero-stage-pin')
          && previousLocal >= 0 && previousLocal <= geometryCache.span) {
          // A Brand Page header image can acquire its intrinsic height while
          // the deck is pinned. Keep the existing phase at the same viewport
          // position and keep the document shift out of the direction latch.
          window.scrollBy({ top: offsetChange, behavior: 'instant' });
          direction.y += window.scrollY - scrollY;
        }
        shellTop = nextTop;
      }

      // Recompute geometry on every measure call since stageHeight changes on resize/orientation
      geometryCache = stageGeometry(slides, stageHeight);
      geometryCache.notebookCover = rootId === 'showcases'
        && (root.hasAttribute('data-home-brand-deck') || root.hasAttribute('data-brand-category-deck'));
      measureVersion += 1;
      cleared = false;

      // All geometry reads above finish before compositing/layout writes.
      cacheDOMElements();

      const enabled = motionEnabled();
      slides.forEach((slide) => {
        if (slide.kind !== 'hero') return;
        // The pose rounds to CSS pixels; use that same height for the image
        // box so fractional viewport divisions cannot leave a hairline seam.
        const height = enabled ? `${stageHeight}px` : '';
        if (slide.el.style.height !== height) slide.el.style.height = height;
      });
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
      const previousMode = direction.mode;

      // Use cached geometry
      const span = geometryCache?.span ?? 0;
      const rawLocal = y - (shellTop - headerOffset);
      const local = Math.min(span, Math.max(0, rawLocal));
      const pos = stageSlidePos(slides, local, stageHeight, geometryCache);

      const mobileShowcase = rootId === 'showcases' && mobile && !desktop.matches;
      const isBrandCategoryDeck = root.hasAttribute('data-brand-category-deck');
      const isHomeDeck = rootId === 'showcases'
        && (root.hasAttribute('data-home-brand-deck') || isBrandCategoryDeck);
      const mobileHomeDeck = isHomeDeck && mobileShowcase;
      const homeReverseDeck = isHomeDeck && (mobile || desktop.matches);
      const rawPreviousLocal = direction.y - (shellTop - headerOffset);
      const previousLocal = Math.min(span, Math.max(0, rawPreviousLocal));
      direction.mode = homeReverseDeck
        ? latchHomeDeckMode(direction.mode, delta, rawPreviousLocal, rawLocal, slides, geometryCache, mobileHomeReverseEntry)
        : latchStageMode(direction.mode, delta, direction.pos, pos, slides);
      if (homeReverseDeck && !crossUnwind && previousMode === 'up' && delta > 0
        && lastHomeReversePose && mobileHomeReverseEntry && lastReverseHero != null
        && mobileHomeReverseEntry.heroIndex > lastReverseHero) {
        const index = slides.findIndex((slide) => slide.kind === 'hero' && slide.heroIndex === lastReverseHero);
        const boundary = geometryCache.offsets[index];
        if (boundary > previousLocal + 1 && lastHomeReversePose[index]?.y > 0) {
          // A turn just before a boundary still needs room for the following
          // banner and strip to settle. Join inside the next hero's cover.
          const handoff = Math.min(stageHeight, HOME_REVERSE_POSE_HANDOFF_DISTANCE);
          const end = Math.min(span, Math.max(boundary, previousLocal + handoff));
          const cover = heroStageMotion({ slides, local: end, stageHeight, geometry: geometryCache });
          crossUnwind = {
            start: previousLocal, end, index, motion: lastHomeReversePose, cover,
            entry: mobileHomeReverseEntry,
            boxHeight: finalPreview ? lastDeckFrame?.height : null,
          };
        }
      }
      const wasCrossUnwinding = Boolean(crossUnwind);
      const returningCrossEntry = crossUnwind && local < crossUnwind.start ? crossUnwind.entry : null;
      if (crossUnwind) {
        direction.mode = returningCrossEntry ? 'up' : 'down';
        if (local >= crossUnwind.end) completedCrossUnwind = true;
        if (returningCrossEntry || local >= crossUnwind.end) crossUnwind = null;
      }

      // Retrace an unfinished cover handoff before resuming the reverse deck.
      const returningToBrandReverse = isBrandCategoryDeck && mobileHomeReverseExit && delta < 0;
      if (returningToBrandReverse) {
        direction.mode = rawLocal > mobileHomeReverseExit.startRawLocal ? 'down' : 'up';
      }
      if (direction.mode !== 'up') direction.mode = 'down';
      if (nextMode === direction.mode) direction.mode = nextMode;

      // Mobile Home already meets the forward release pose at the strip
      // entrance, so crossing it needs no fixed-height exit bridge.
      if (homeReverseDeck && !wasCrossUnwinding && previousMode === 'up' && direction.mode === 'down' && delta > 0
        && (isBrandCategoryDeck ? lastHomeReversePose : mobileHomeReverseEntry)
        && !(mobileHomeDeck && !isBrandCategoryDeck && mobileHomeReverseEntry?.initialStrip)) {
        mobileHomeReverseExit = {
          startRawLocal: isBrandCategoryDeck ? rawLocal : mobileHomeReverseEntry.initialStrip?.start ?? mobileHomeReverseEntry.startLocal,
          startLocal: isBrandCategoryDeck ? local : mobileHomeReverseEntry.initialStrip?.start ?? mobileHomeReverseEntry.startLocal,
          boxHeight: isBrandCategoryDeck ? Number.parseFloat(stageEl.style.height) : null,
          reverseEntry: mobileHomeReverseEntry,
          motion: lastHomeReversePose || homeReverseMotion(
            slides,
            previousLocal,
            stageHeight,
            pinHeight,
            geometryCache,
            mobileHomeReverseEntry,
          ).motion,
        };
      }
      const returningBrandEntry = returningToBrandReverse ? mobileHomeReverseExit.reverseEntry : null;
      if (!homeReverseDeck || direction.mode === 'up') {
        mobileHomeReverseExit = null;
      }

      if (homeReverseDeck && direction.mode === 'up' && previousMode !== 'up') {
        mobileHomeReverseEntry = returningCrossEntry ?? returningBrandEntry ?? homeReverseEntry(
          slides,
          rawPreviousLocal,
          rawLocal,
          stageHeight,
          pinHeight,
          geometryCache,
        );
        if (!returningCrossEntry && !returningToBrandReverse && mobileHomeReverseEntry && mobileHomeReverseEntry.poseHandoffProgress < 1) {
          mobileHomeReverseEntry.poseHandoffMotion = heroStageMotion({
            slides,
            local: mobileHomeReverseEntry.poseStartLocal,
            stageHeight,
            mode: 'down',
            geometry: geometryCache,
          });
        }
      } else if (!homeReverseDeck || direction.mode !== 'up') {
        mobileHomeReverseEntry = null;
      }
      if (homeReverseDeck && direction.mode === 'up' && mobileHomeReverseEntry && delta < 0) {
        const advanced = Math.min(1, Math.max(0,
          (mobileHomeReverseEntry.poseStartLocal - local) / HOME_REVERSE_POSE_HANDOFF_DISTANCE,
        ));
        mobileHomeReverseEntry.poseHandoffProgress = advanced;
      }

      const mobileUp = !desktop.matches && direction.mode === 'up';
      if (mobileUp && !root.hasAttribute('data-mobile-hero-up')) root.setAttribute('data-mobile-hero-up', '');
      else if (!mobileUp && root.hasAttribute('data-mobile-hero-up')) root.removeAttribute('data-mobile-hero-up');

      // Home's reverse pose uses measured hero and strip offsets. Earlier
      // banner peeks stay anchored while the previous banner opens beneath the
      // outgoing one. Forward Home and other stages retain their existing pose.
      const homeReverse = homeReverseDeck && direction.mode === 'up'
        ? homeReverseMotion(slides, local, stageHeight, pinHeight, geometryCache, mobileHomeReverseEntry, isBrandCategoryDeck)
        : null;
      if (homeReverse) {
        if (root.getAttribute('data-home-reverse-phase') !== homeReverse.phase) root.setAttribute('data-home-reverse-phase', homeReverse.phase);
        if (root.getAttribute('data-mobile-reverse-phase') !== homeReverse.phase) root.setAttribute('data-mobile-reverse-phase', homeReverse.phase);
      } else {
        root.removeAttribute('data-home-reverse-phase');
        root.removeAttribute('data-mobile-reverse-phase');
      }
      const motionMode = homeReverseDeck ? 'down' : direction.mode;
      let motion = homeReverse?.motion || heroStageMotion({
        slides,
        local,
        stageHeight,
        mode: motionMode,
        geometry: geometryCache,
        upDeckDepth: desktop.matches ? undefined : MOBILE_UP_DECK_DEPTH,
      });
      let reverseBridgeHeight;
      const resumingAfterCrossUnwind = completedCrossUnwind && previousMode !== 'up' && homeReverse;
      if (resumingAfterCrossUnwind) completedCrossUnwind = false;
      const bridgeReverse = homeReverse && !mobileHomeReverseEntry?.initialStrip
        && (isBrandCategoryDeck || resumingAfterCrossUnwind);
      if (bridgeReverse || (homeReverse && deckReverseBridge)) {
        const retracingBridge = finalPreview && deckReverseBridge && returningToBrandReverse;
        if (previousMode !== 'up' && lastDeckFrame && !returningCrossEntry && !retracingBridge) {
          // The source frame belongs to the previous scroll coordinate. A
          // large wheel delta must consume the same bridge distance as many
          // small deltas, rather than restarting the bridge at its destination.
          deckReverseBridge = { ...lastDeckFrame, start: finalPreview ? rawPreviousLocal : rawLocal };
        }
        if (deckReverseBridge) {
          const progress = Math.min(1, Math.max(0,
            (deckReverseBridge.start - rawLocal) / HOME_REVERSE_POSE_HANDOFF_DISTANCE,
          ));
          if (progress < 1) {
            const { motion: origin, height } = deckReverseBridge;
            const mix = (from, to) => Math.round(from + (to - from) * progress);
            reverseBridgeHeight = mix(height, homeReverse.sceneHeight);
            motion = motion.map((target, index) => {
              const source = origin[index];
              if (!source || progress === 0) return source ? { ...source } : target;
              const slide = slides[index];
              const layerHeight = slide.kind === 'strip' ? slide.height : stageHeight;
              const sourceBottom = source.y + layerHeight - (source.clipBottom || 0);
              // Earlier notebook cards are revealed in their final slots, even
              // while the active card is still joining the reverse pose.
              if (geometryCache.notebookCover && homeReverse.phase === 'stack-entrance'
                && slide.kind === 'hero' && slide.heroIndex < homeReverse.currentHero
                && sourceBottom <= 0) {
                return target;
              }
              const collapsesAtTop = sourceBottom <= 0;
              const hiddenStrip = slide.kind === 'strip' && source.hidden;
              return {
                ...target,
                y: mix(collapsesAtTop ? 0 : source.y, target.y),
                clipTop: mix(source.clipTop || 0, target.clipTop || 0),
                clipBottom: mix(collapsesAtTop || hiddenStrip ? layerHeight : (source.clipBottom || 0), target.clipBottom || 0),
                z: collapsesAtTop || hiddenStrip ? target.z : source.z,
                hidden: source.hidden && target.hidden,
              };
            });
          } else {
            deckReverseBridge = null;
          }
        }
      } else if (!finalPreview || (!crossUnwind && !mobileHomeReverseExit)) {
        // A temporary downward handoff can return to the same reverse
        // interval. Keep its source pose until that handoff commits.
        deckReverseBridge = null;
      }
      if (!mobileHomeDeck && mobileShowcase && mobileUp && previousMode !== 'up') {
        const downPose = heroStageMotion({ slides, local, stageHeight, mode: 'down', geometry: geometryCache, motionPurpose: 'handoff-reference' });
        mobileUpPoseHandoff = mobileUpHandoff(slides, downPose, motion, local, stageHeight, geometryCache);
      } else if (mobileHomeDeck || !mobileShowcase || !mobileUp) {
        mobileUpPoseHandoff = null;
      }
      if (!mobileHomeDeck && mobileShowcase && mobileUp) {
        motion = applyMobileUpHandoff(motion, slides, mobileUpPoseHandoff, local);
      }
      let crossUnwindHeight;
      if (crossUnwind) {
        const { start, end, index, motion: origin, cover, boxHeight } = crossUnwind;
        const progress = (local - start) / (end - start);
        motion = crossBannerUnwind(slides, stageHeight, pinHeight, origin, cover, index, progress, finalPreview);
        if (Number.isFinite(boxHeight)) {
          crossUnwindHeight = Math.round(boxHeight + (pinHeight - boxHeight) * progress);
        }
      }
      let homeReverseExitActive = false;
      let homeReverseExitForwardPose = null;
      let brandExitBoxHeight = null;
      if (mobileHomeReverseExit && direction.mode === 'down') {
        const handoffProgress = Math.min(1, Math.max(0,
          (rawLocal - mobileHomeReverseExit.startRawLocal) / HOME_REVERSE_POSE_HANDOFF_DISTANCE,
        ));
        if (handoffProgress < 1) {
          if (Number.isFinite(mobileHomeReverseExit.boxHeight)) {
            brandExitBoxHeight = Math.round(mobileHomeReverseExit.boxHeight
              + (pinHeight - mobileHomeReverseExit.boxHeight) * handoffProgress);
          }
          homeReverseExitActive = true;
          const forwardLocal = Math.min(span, Math.max(mobileHomeReverseExit.startLocal, local));
          homeReverseExitForwardPose = heroStageMotion({
            slides,
            local: forwardLocal,
            stageHeight,
            mode: 'down',
            geometry: geometryCache,
          });
          motion = motion.map((pose, index) => {
            let reversePose = mobileHomeReverseExit.motion[index];
            let forwardPose = homeReverseExitForwardPose[index];
            if (!reversePose) return pose;
            const slide = slides[index];
            const naturalHeight = (slide.kind === 'strip' ? slide.height : stageHeight) || stageHeight;
            // Collapse departing layers at the stage edge. Interpolating toward
            // their distant forward positions pulls them out before the cover arrives.
            if (isBrandCategoryDeck) {
              const height = forwardPose.height || naturalHeight;
              if (forwardPose.y + height - (forwardPose.clipBottom || 0) <= 0) {
                forwardPose = { ...forwardPose, y: 0, clipTop: 0, clipBottom: height };
              }
              // An incoming strip starts at the reverse banner's bottom edge
              // with zero painted height, then opens along that same seam.
              if (slide.kind === 'strip' && reversePose.hidden && !forwardPose.hidden
                && forwardPose.y >= 0 && forwardPose.y < pinHeight && handoffProgress > 0) {
                const banner = mobileHomeReverseExit.motion[index - 1];
                reversePose = {
                  ...reversePose,
                  y: banner.y + (banner.height || stageHeight) - (banner.clipBottom || 0),
                  clipTop: 0,
                  clipBottom: naturalHeight,
                  hidden: false,
                  z: forwardPose.z,
                };
              }
            }
            return {
              ...pose,
              ...(isBrandCategoryDeck && reversePose.height ? { height: Math.round(reversePose.height
                + ((forwardPose.height || stageHeight) - reversePose.height) * handoffProgress) } : {}),
              y: Math.round(reversePose.y + (forwardPose.y - reversePose.y) * handoffProgress),
              clipTop: Math.round((reversePose.clipTop || 0)
                + ((forwardPose.clipTop || 0) - (reversePose.clipTop || 0)) * handoffProgress),
              clipBottom: Math.round((reversePose.clipBottom || 0)
                + ((forwardPose.clipBottom || 0) - (reversePose.clipBottom || 0)) * handoffProgress),
              z: handoffProgress < 1 ? reversePose.z : forwardPose.z,
              hidden: handoffProgress < 1 ? reversePose.hidden : forwardPose.hidden,
            };
          });
          // Give the forward cover its overlap gradually. Otherwise a z-index
          // swap at the end exposes the whole overlapping band in one frame.
          if (isBrandCategoryDeck && handoffProgress > 0) {
            const edges = motion.map((pose, index) => {
              const slide = slides[index];
              const height = pose.height || (slide.kind === 'strip' ? slide.height : stageHeight) || stageHeight;
              return {
                top: pose.y + (pose.clipTop || 0),
                bottom: pose.y + height - (pose.clipBottom || 0),
                concealed: slide.kind === 'strip' && pose.hidden,
              };
            });
            motion.forEach((pose, index) => {
              const { top, bottom, concealed } = edges[index];
              if (concealed || bottom <= top) return;
              const forwardZ = homeReverseExitForwardPose[index].z;
              let overlap = 0;
              for (let next = index + 1; next < motion.length; next += 1) {
                const cover = edges[next];
                if (!cover.concealed && cover.bottom >= bottom && cover.top < bottom
                  && motion[next].z < pose.z && homeReverseExitForwardPose[next].z > forwardZ) {
                  overlap = Math.max(overlap, bottom - Math.max(top, cover.top));
                }
              }
              pose.clipBottom = (pose.clipBottom || 0) + Math.round(overlap * handoffProgress);
            });
          }
        } else {
          mobileHomeReverseExit = null;
          lastHomeReversePose = null;
        }
      }
      if (homeReverseDeck) {
        const unwinding = Boolean(crossUnwind || (!isBrandCategoryDeck && homeReverseExitActive));
        if (unwinding && !root.hasAttribute('data-notebook-unwinding')) {
          root.setAttribute('data-notebook-unwinding', '');
        } else if (!unwinding && root.hasAttribute('data-notebook-unwinding')) {
          root.removeAttribute('data-notebook-unwinding');
        }
      }
      if (reverseBridgeHeight != null || ((isBrandCategoryDeck || finalPreview) && homeReverseExitActive)) {
        joinCategoryHandoff(slides, motion, stageHeight, reverseBridgeHeight ?? brandExitBoxHeight ?? pinHeight);
      }
      if (reverseBridgeHeight != null && mobileShowcase) {
        const terminal = slides.at(-1);
        const terminalPose = motion.at(-1);
        const terminalHeight = terminal.kind === 'strip' ? terminal.height : stageHeight;
        const terminalBottom = terminalPose.y + terminalHeight - (terminalPose.clipBottom || 0);
        if (!terminalPose.hidden && terminalPose.y >= 0 && terminalPose.y < reverseBridgeHeight) {
          reverseBridgeHeight = Math.min(reverseBridgeHeight, terminalBottom);
        }
      }
      const release = stageReleaseBox(slides, stageHeight, pinHeight, y - (shellTop - headerOffset), direction.mode, geometryCache, motion);
      // The UP deck can expose a different number of clipped banner slices
      // from one frame to the next. Its visual pose must not resize the sticky
      // page box: that made the shell and viewport jump at direction changes.
      // Use the unchanged DOWN layout mapping at the same scroll position so
      // document geometry stays path-independent while UP poses keep their
      // existing motion model.
      const downLayout = mobileUp
        ? stageReleaseBox(slides, stageHeight, pinHeight, y - (shellTop - headerOffset), 'down', geometryCache)
        : release;
      if (!isHomeDeck && mobileShowcase && delta < 0 && !mobileUpLayoutAnchor) {
        const previousLocal = local - delta;
        const previous = lastLayoutRelease || release;
        mobileUpLayoutAnchor = { local: previousLocal, shellHeight: previous.shellHeight, boxHeight: previous.boxHeight };
      }
      if (!mobileShowcase || (!mobileUp && delta > 0)) mobileUpLayoutAnchor = null;
      // Mobile Home's terminal release keeps the real strip at the bottom of
      // the pin. Continue that same document edge while the strip-first pose
      // fills the pin, then resume the fixed shell for the rest of the deck.
      const shortTerminalScene = mobileHomeDeck && !isBrandCategoryDeck
        && mobileHomeReverseEntry?.initialStrip
        && homeReverse?.entryHero === mobileHomeReverseEntry.heroIndex
        && homeReverse.sceneHeight < pinHeight;
      const layoutRelease = homeReverse || homeReverseExitActive || crossUnwind
        ? {
          ...downLayout,
          boxHeight: pinHeight,
          shellHeight: shortTerminalScene ? local + homeReverse.sceneHeight : span + pinHeight,
        }
        : mobileShowcase && mobileUpLayoutAnchor
          ? restoreMobileUpLayout(downLayout, mobileUpLayoutAnchor, local, pinHeight)
          : downLayout;

      const boxHeight = reverseBridgeHeight ?? homeReverse?.sceneHeight ?? brandExitBoxHeight ?? crossUnwindHeight ?? layoutRelease.boxHeight;
      if (shellEl && stageEl) {
        const releaseAllowance = releasePreview && mobileHomeDeck
          ? notebookReleaseAllowance(rawLocal, span, layoutRelease.shellHeight, boxHeight, notebookPocket)
          : 0;
        const nextSpan = `${layoutRelease.shellHeight + releaseAllowance}px`;
        const spanProperty = mobileUp ? '--mobile-up-stage-span' : '--hero-stage-span';
        if (shellEl.style.getPropertyValue(spanProperty) !== nextSpan) {
          shellEl.style.setProperty(spanProperty, nextSpan);
        }
        const nextBox = `${boxHeight}px`;
        if (stageEl.style.height !== nextBox) stageEl.style.height = nextBox;
      }
      lastLayoutRelease = layoutRelease;
      direction.pos = pos;
      direction.y = y;
      lastReverseHero = homeReverse?.currentHero ?? null;
      lastHomeReversePose = homeReverse
        ? motion.map((pose) => ({ ...pose }))
        : homeReverseExitActive
          ? motion.map((pose) => ({ ...pose }))
          : null;

      if (release.atEnd && !homeReverse && !homeReverseExitActive) {
        slides.forEach((slide, index) => {
          if (index === slides.length - 1) return;
          const away = slide.kind === 'strip' && slide.height > 0 ? Math.round(slide.height) : stageHeight;
          motion[index] = { y: -away, clipTop: 0, clipBottom: 0, hidden: slide.kind === 'strip', z: 1 };
        });
      }
      if (homeReverseDeck) {
        lastDeckFrame = {
          motion,
          height: boxHeight,
        };
      }

      const pin = y >= shellTop - headerOffset && y <= shellTop - headerOffset + span;
      if (categoryNav) {
        // Let the breadcrumb emerge from behind the header over its own
        // height as the deck releases, rather than covering a banner at once.
        const distance = Math.max(0, -rawLocal, rawLocal - span);
        const inset = Math.max(0, Math.round(categoryNavHeight - distance));
        const value = inset ? `${inset}px` : '';
        if (categoryNav.style.getPropertyValue('--category-nav-reveal') !== value) {
          if (value) categoryNav.style.setProperty('--category-nav-reveal', value);
          else categoryNav.style.removeProperty('--category-nav-reveal');
        }
      }
      if (document.body.classList.contains('hero-stage-pin') !== pin) {
        document.body.classList.toggle('hero-stage-pin', pin);
      }

      let activeHero = homeReverse?.activeHero ?? activeHeroIndex(slides, motion, stageHeight);
      if (homeReverseExitForwardPose) activeHero = activeHeroIndex(slides, homeReverseExitForwardPose, stageHeight);

      const tabLifts = dynamicTabPreview
        ? notebookTabLifts(slides, motion, pinHeight, notebookRise, notebookPocket)
        : null;
      // Apply styles using cached element references from slides array
      slides.forEach((slide, index) => {
        const pose = motion[index] || { y: stageHeight, clipTop: 0, clipBottom: 0, hidden: false, z: 1 };
        const el = slide.el;
        if (el) {
          const previous = slide.appliedStyle || (slide.appliedStyle = {});
          const slideHeight = Number(pose.height) > 0
            ? Number(pose.height)
            : slide.kind === 'strip' && Number(slide.height) > 0
              ? Number(slide.height)
              : stageHeight;
          // The stage admits decorative paint above its upper edge. Keep
          // artwork and product strips clipped to their original stage bounds.
          const notebookDeck = isHomeDeck;
          const clipTop = notebookDeck ? Math.max(pose.clipTop || 0, -pose.y) : (pose.clipTop || 0);
          const showTab = notebookDeck && slide.kind === 'hero' && pose.y >= 0
            && !clipTop && !pose.hidden && (pose.clipBottom || 0) < slideHeight;
          const lift = showTab ? tabLifts?.[index] || 0 : 0;
          if (tabLifts && slide.kind === 'hero' && previous.tabLift !== lift) {
            el.style.setProperty('--notebook-lift', `${lift}px`);
            el.style.setProperty('--notebook-connector', `${lift ? lift + 1 : 0}px`);
            previous.tabLift = lift;
          }
          const raisedTop = fixedTabPreview
            ? 'calc(-1 * var(--notebook-pocket))'
            : lift ? `calc(-1 * (var(--notebook-rise) + ${lift}px))` : 'calc(-1 * var(--notebook-rise))';
          const clip = (!slide.artwork && showTab) || clipTop || pose.clipBottom
            ? `inset(${!slide.artwork && showTab ? raisedTop : `${clipTop}px`} 0 ${pose.clipBottom || 0}px 0)`
            : '';
          const deferStyleWrite = canDeferOffscreenPoseWrite({
            pose,
            height: slideHeight,
            pinHeight,
            previous,
            concealed: slide.kind === 'strip' && Boolean(pose.hidden),
          });
          if (!deferStyleWrite) {
            const transform = `translate3d(0, ${pose.y}px, 0)`;
            const zIndex = String(pose.z || 1);
            // CSSOM serializes zero units and inset shorthand differently from
            // our input strings. Cache writes so unchanged poses skip DOM work.
            if (previous.transform !== transform) { el.style.transform = transform; previous.transform = transform; }
            if (previous.clip !== clip) {
              (slide.artwork || el).style.clipPath = clip;
              previous.clip = clip;
            }
            if (slide.tabEdge) {
              // The stage and header clip the tab as it exits. Clip the artwork
              // separately so a negative banner offset cannot hide the tab at once.
              const artVisible = !pose.hidden && clipTop + (pose.clipBottom || 0) < slideHeight;
              const visibility = artVisible ? '' : 'hidden';
              if (previous.tabVisibility !== visibility) {
                slide.tabEdge.style.visibility = visibility;
                previous.tabVisibility = visibility;
              }
              if (finalPreview && homeNotebook) {
                // Continue only the existing connector to the stage-clipped
                // artwork edge while its tab still reaches below the header.
                const seamClip = artVisible && clipTop === -pose.y && clipTop < notebookFixedLift
                  ? clipTop
                  : 0;
                if (previous.seamClip !== seamClip) {
                  if (seamClip) slide.tabEdge.style.setProperty('--notebook-seam-clip', `${seamClip}px`);
                  else slide.tabEdge.style.removeProperty('--notebook-seam-clip');
                  previous.seamClip = seamClip;
                }
              }
            }
            if (previous.zIndex !== zIndex) { el.style.zIndex = zIndex; previous.zIndex = zIndex; }
            previous.y = pose.y;
            previous.clipTop = pose.clipTop || 0;
            previous.clipBottom = pose.clipBottom || 0;
          }
          if (slide.kind === 'hero') {
            const height = `${pose.height || stageHeight}px`;
            if (el.style.height !== height) el.style.height = height;
          }
        }
        if (slide.kind === 'strip') {
          el?.classList.toggle('is-concealed', Boolean(pose.hidden));
        }
        if (slide.kind === 'hero') {
          const active = slide.heroIndex === activeHero;
          if (active && !slide.section?.hasAttribute('data-active')) slide.section?.setAttribute('data-active', '');
          else if (!active && slide.section?.hasAttribute('data-active')) slide.section?.removeAttribute('data-active');
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
    categoryHeader?.addEventListener('load', onLayout, true);
    categoryHeader?.addEventListener('loadedmetadata', onLayout, true);
    window.addEventListener('resize', onLayout);
    desktop.addEventListener('change', onLayout);
    reduced.addEventListener('change', onLayout);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      stage?.removeEventListener('load', onLayout, true);
      categoryHeader?.removeEventListener('load', onLayout, true);
      categoryHeader?.removeEventListener('loadedmetadata', onLayout, true);
      window.removeEventListener('resize', onLayout);
      observer.disconnect();
      stageObserver.disconnect();
      viewportProbe?.remove();
      root.removeAttribute('data-hero-motion');
      root.removeAttribute('data-mobile-hero-up');
      root.removeAttribute('data-notebook-unwinding');
      shellEl?.style.removeProperty('--mobile-up-stage-span');
      document.body.classList.remove('hero-stage-pin');
      desktop.removeEventListener('change', onLayout);
      reduced.removeEventListener('change', onLayout);
      // Clean up will-change
      slides.forEach((slide) => {
        if (slide.el) slide.el.style.willChange = '';
        slide.tabEdge?.style.removeProperty('--notebook-seam-clip');
        if (slide.kind === 'hero') slide.el.style.height = '';
      });
    };
  }, [rootId, mobile]);

  useLayoutEffect(() => {
    syncHeroes.current();
  });
}
