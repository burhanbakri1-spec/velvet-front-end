import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HERO_COVER_DRIFT,
  HERO_HOLD,
  HERO_SLICE,
  HERO_SLICE_OVERLAP,
  heroStageMotion,
  latchStageMode,
  stageGeometry,
  stageReleaseBox,
  stageSlidePos,
  stepHeroDirection,
} from '../src/components/heroScrollProgress.js';

const stageHeight = 812;

function slides(pattern) {
  return pattern.map((kind) => ({ kind }));
}

function frame(pattern, local, mode) {
  const list = slides(pattern);
  const motion = heroStageMotion({ slides: list, local, stageHeight, mode });
  const visibleTop = (index) => motion[index].y + motion[index].clipTop;
  const visibleHeight = (index) => stageHeight - motion[index].clipTop - motion[index].clipBottom;
  return { motion, visibleTop, visibleHeight };
}

function coverAt(unit) {
  const progress = unit;
  return {
    progress,
    currentY: -(Math.round(progress * stageHeight * HERO_COVER_DRIFT) || 0),
    nextY: Math.round((1 - progress) * stageHeight) || 0,
  };
}

test('down covers continuously through the same full-bleed stage endpoints', () => {
  const pattern = ['hero', 'hero', 'hero', 'hero'];
  assert.equal(HERO_HOLD, 0);

  const start = frame(pattern, 0, 'down');
  assert.equal(start.motion[0].y, 0);
  assert.equal(start.motion[1].y, stageHeight);
  assert.ok(start.motion.every((item) => item.clipTop === 0 && item.clipBottom === 0 && item.hidden === false));

  const early = frame(pattern, stageHeight * 0.1, 'down');
  assert.ok(early.motion[0].y < 0);
  assert.ok(early.motion[1].y < stageHeight);

  const halfway = frame(pattern, stageHeight * 0.5, 'down');
  const halfwayCover = coverAt(0.5);
  assert.equal(halfway.motion[0].y, halfwayCover.currentY);
  assert.equal(halfway.motion[1].y, halfwayCover.nextY);
  assert.ok(halfway.motion[0].y + stageHeight > halfway.motion[1].y);
  assert.ok(early.motion[1].z > early.motion[0].z);

  const mid = frame(pattern, stageHeight * 0.7, 'down');
  const midCover = coverAt(0.7);
  assert.ok(Math.abs(midCover.progress - 0.7) < 1e-9);
  assert.equal(mid.motion[0].y, midCover.currentY);
  assert.equal(mid.motion[1].y, midCover.nextY);
  assert.ok(mid.motion[0].y > -stageHeight * 0.25);
  assert.ok(mid.motion[1].y > stageHeight * 0.2 && mid.motion[1].y < stageHeight * 0.4);
  assert.ok(mid.motion[0].y + stageHeight > mid.motion[1].y);

  const arrived = frame(pattern, stageHeight, 'down');
  const before = frame(pattern, stageHeight - 1, 'down');
  assert.equal(arrived.motion[1].y, 0);
  assert.equal(arrived.motion[2].y, stageHeight);
  assert.equal(arrived.motion[0].y, -stageHeight);
  assert.ok(Math.abs(before.motion[1].y - arrived.motion[1].y) <= 2);
});

test('a product strip moves continuously on its own height and a missing strip is skipped', () => {
  const pattern = ['hero', 'strip', 'hero'];
  const movingStrip = frame(pattern, stageHeight + stageHeight * 0.2, 'down');
  assert.ok(movingStrip.motion[1].y < 0);
  assert.ok(movingStrip.motion[2].y < stageHeight);
  assert.equal(movingStrip.motion[1].hidden, false);

  const sliding = frame(pattern, stageHeight * 0.7, 'down');
  const cover = coverAt(0.7);
  assert.equal(sliding.motion[0].y, cover.currentY);
  assert.equal(sliding.motion[1].y, cover.nextY);
  assert.equal(sliding.motion[1].hidden, false);
  assert.ok(sliding.motion[1].z > sliding.motion[0].z);

  const heroesOnly = frame(['hero', 'hero'], stageHeight * 0.7, 'down');
  assert.equal(heroesOnly.motion.length, 2);
  assert.equal(heroesOnly.motion[1].y, cover.nextY);
  assert.ok(heroesOnly.motion[0].y + stageHeight > heroesOnly.motion[1].y);
});

test('up stacks previous heroes as top logo slices under the current hero', () => {
  const pattern = ['hero', 'hero', 'hero', 'hero'];
  const opened = frame(pattern, 3 * stageHeight - 48, 'up');
  assert.ok(opened.visibleHeight(0) >= 40 && opened.visibleHeight(0) <= 70);
  assert.ok(opened.visibleHeight(1) >= 40 && opened.visibleHeight(1) <= 70);
  assert.ok(opened.visibleHeight(2) > 40 && opened.visibleHeight(2) <= 70);
  assert.equal(opened.motion[0].clipTop, 30);
  assert.ok(opened.motion[0].clipBottom > stageHeight - HERO_SLICE - 40);
  assert.equal(opened.visibleTop(0), 0);
  assert.ok(opened.visibleTop(1) > opened.visibleTop(0));
  assert.ok(opened.visibleTop(1) <= opened.visibleTop(0) + HERO_SLICE);
  assert.equal(opened.motion[3].clipTop, 0);
  assert.equal(opened.motion[3].clipBottom, 0);
  assert.ok(opened.motion[3].y > 20);
});

test('the nearest slice grows while older slices stay thin', () => {
  const pattern = ['hero', 'hero', 'hero', 'hero'];
  const early = frame(pattern, 3 * stageHeight - 80, 'up');
  const later = frame(pattern, 3 * stageHeight - stageHeight * 0.72, 'up');
  assert.ok(later.visibleHeight(2) > early.visibleHeight(2) + 80);
  assert.ok(later.visibleHeight(0) <= HERO_SLICE);
  assert.ok(later.visibleHeight(1) <= HERO_SLICE);
  assert.ok(later.motion[3].y > early.motion[3].y);

  const settled = frame(pattern, 2 * stageHeight, 'up');
  const down = frame(pattern, 2 * stageHeight, 'down');
  assert.equal(settled.motion[2].y, 0);
  assert.equal(settled.motion[2].clipTop, 0);
  assert.equal(settled.visibleHeight(2), stageHeight);
  assert.equal(down.motion[2].y, 0);
  assert.ok(settled.visibleHeight(0) < 2);
  assert.ok(settled.visibleHeight(1) < 2);
  assert.ok(settled.visibleTop(3) >= stageHeight - 2);

  const above = frame(pattern, 2 * stageHeight - 2, 'up');
  const below = frame(pattern, 2 * stageHeight + 2, 'up');
  assert.ok(Math.abs(above.visibleTop(2)) <= 8);
  assert.ok(Math.abs(below.visibleTop(2)) <= 8);
  assert.ok(Math.abs(above.motion[2].y - settled.motion[2].y) <= 12);
  assert.ok(Math.abs(below.visibleTop(2) - settled.motion[2].y) <= 12);
  assert.ok(HERO_SLICE_OVERLAP >= 4 && HERO_SLICE_OVERLAP <= 8);
});

test('the same scroll position is the same frame', () => {
  const list = slides(['hero', 'strip', 'hero', 'hero']);
  const first = heroStageMotion({ slides: list, local: stageHeight * 2.4, stageHeight, mode: 'up' });
  const second = heroStageMotion({ slides: list, local: stageHeight * 2.4, stageHeight, mode: 'up' });
  assert.deepEqual(first, second);
  const down = heroStageMotion({ slides: list, local: stageHeight * 0.7, stageHeight, mode: 'down' });
  const cover = coverAt(0.7);
  assert.equal(down[0].y, cover.currentY);
  assert.equal(down[1].y, cover.nextY);
  assert.ok(down[0].y + stageHeight > down[1].y);
  assert.ok(down.every((item) => item.hidden === false && item.clipTop === 0));
  const moving = heroStageMotion({ slides: list, local: stageHeight * 0.2, stageHeight, mode: 'down' });
  const origin = heroStageMotion({ slides: list, local: 0, stageHeight, mode: 'down' });
  assert.notDeepEqual(moving, origin);
});

test('a short product strip keeps the next hero on its own height', () => {
  const stripHeight = 280;
  const list = [
    { kind: 'hero' },
    { kind: 'strip', height: stripHeight },
    { kind: 'hero' },
  ];
  const geometry = stageGeometry(list, stageHeight);
  assert.deepEqual(geometry.lengths, [stageHeight, stripHeight, stageHeight]);
  assert.equal(geometry.span, stageHeight + stripHeight);

  const moving = heroStageMotion({
    slides: list,
    local: stageHeight + stripHeight * 0.2,
    stageHeight,
    mode: 'down',
  });
  assert.equal(moving[1].y, -Math.round(stripHeight * 0.2));
  assert.equal(moving[2].y - moving[1].y, stripHeight);
  assert.ok(moving[2].y < stripHeight);

  const unit = 0.7;
  const t = unit;
  const shift = Math.round(-t * stripHeight);
  const sliding = heroStageMotion({
    slides: list,
    local: stageHeight + stripHeight * unit,
    stageHeight,
    mode: 'down',
  });
  assert.equal(sliding[1].y, shift);
  assert.equal(sliding[2].y - sliding[1].y, stripHeight);

  const into = heroStageMotion({
    slides: list,
    local: stageHeight * 0.7,
    stageHeight,
    mode: 'down',
  });
  const cover = coverAt(0.7);
  assert.equal(into[0].y, cover.currentY);
  assert.equal(into[1].y, cover.nextY);
  assert.equal(into[2].y - into[1].y, stripHeight);
  assert.ok(into[0].y + stageHeight > into[1].y);

  const plain = slides(['hero', 'strip', 'hero', 'hero']);
  const short = [
    { kind: 'hero' },
    { kind: 'strip', height: stripHeight },
    { kind: 'hero' },
    { kind: 'hero' },
  ];
  const original = heroStageMotion({ slides: plain, local: stageHeight * 2.5, stageHeight, mode: 'up' });
  const local = stageHeight + stripHeight + stageHeight * 0.5;
  assert.equal(stageSlidePos(short, local, stageHeight), 2.5);
  const mapped = heroStageMotion({ slides: short, local, stageHeight, mode: 'up' });
  assert.deepEqual(mapped, original);
});

test('the full hero range has no meaningful pose plateau in either direction', () => {
  for (const [compact, stripHeight] of [[386, 235], [812, 306]]) {
    const list = Array.from({ length: 24 }, (_, index) => index % 2
      ? { kind: 'strip', height: stripHeight }
      : { kind: 'hero' });
    const geometry = stageGeometry(list, compact);
    for (const mode of ['down', 'up']) {
      let previous = JSON.stringify(heroStageMotion({ slides: list, local: 0, stageHeight: compact, mode, geometry }));
      let unchangedPixels = 0;
      let longestPlateau = 0;
      for (let local = 1; local <= geometry.span; local += 1) {
        const pose = JSON.stringify(heroStageMotion({ slides: list, local, stageHeight: compact, mode, geometry }));
        unchangedPixels = pose === previous ? unchangedPixels + 1 : 0;
        longestPlateau = Math.max(longestPlateau, unchangedPixels);
        previous = pose;
      }
      assert.ok(longestPlateau <= 3, `${mode} at ${compact}px stage height stalled for ${longestPlateau}px`);
    }
    const middle = geometry.offsets[8] + Math.round(compact * 0.5);
    const before = heroStageMotion({ slides: list, local: middle - 1, stageHeight: compact, mode: 'down', geometry });
    const at = heroStageMotion({ slides: list, local: middle, stageHeight: compact, mode: 'down', geometry });
    const after = heroStageMotion({ slides: list, local: middle + 1, stageHeight: compact, mode: 'down', geometry });
    assert.ok(before[9].y > at[9].y && at[9].y > after[9].y, 'a small reversal follows the same local pose immediately');
  }
});

test('direction changes only when a hero boundary is crossed', () => {
  const list = slides(['hero', 'strip', 'hero']);
  assert.equal(latchStageMode('down', -20, 0.4, 0.2, list), 'down');
  assert.equal(latchStageMode('down', -20, 0.05, -0.02, list), 'up');
  assert.equal(latchStageMode('up', 30, 1.2, 1.6, list), 'up');
  assert.equal(latchStageMode('up', 30, 1.9, 2.1, list), 'down');
  assert.equal(stepHeroDirection('down', -12), 'up');
  assert.equal(stepHeroDirection('up', 4), 'down');
  assert.equal(stepHeroDirection('up', 0), 'up');
  assert.equal(stepHeroDirection('down', 0), 'down');
  assert.ok(HERO_SLICE >= 55 && HERO_SLICE <= 70);
});

test('terminal stage releases on the last slide without clipping the pose', () => {
  const compact = 386;
  const pin = 772;
  const list = [{ kind: 'hero' }, { kind: 'strip', height: 235 }, { kind: 'hero' }];
  const span = stageGeometry(list, compact).span;
  const early = stageReleaseBox(list, compact, pin, compact * 0.2);
  assert.equal(early.atEnd, false);
  assert.equal(early.boxHeight, pin);
  assert.equal(early.shellHeight, span + pin);
  const heroes = [{ kind: 'hero' }, { kind: 'hero' }, { kind: 'hero' }];
  const heroSpan = stageGeometry(heroes, compact).span;
  const opening = stageReleaseBox(heroes, compact, pin, heroSpan - compact);
  assert.equal(opening.boxHeight, pin);
  const approachLocal = heroSpan - compact * 0.3;
  const approach = stageReleaseBox(heroes, compact, pin, approachLocal);
  assert.equal(approach.atEnd, false);
  assert.ok(approach.boxHeight < pin);
  assert.ok(approach.boxHeight > compact);
  assert.equal(approach.shellHeight, approachLocal + approach.boxHeight);
  const beforeEnd = stageReleaseBox(heroes, compact, pin, heroSpan - 1);
  assert.ok(Math.abs(beforeEnd.boxHeight - compact) < 8);
  const end = stageReleaseBox(list, compact, pin, span);
  assert.equal(end.atEnd, true);
  assert.equal(end.lastLength, compact);
  assert.equal(end.boxHeight, compact);
  assert.equal(end.shellHeight, span + compact);
  const stripLast = [{ kind: 'hero' }, { kind: 'strip', height: 235 }];
  const stripSpan = stageGeometry(stripLast, compact).span;
  const stripEnd = stageReleaseBox(stripLast, compact, pin, stripSpan + 40);
  assert.equal(stripEnd.boxHeight, 235);
  assert.equal(stripEnd.shellHeight, stripSpan + 235);
  const desktopSpan = stageGeometry(list, 812).span;
  const desktop = stageReleaseBox(list, 812, 812, desktopSpan + 80);
  assert.equal(desktop.atEnd, true);
  assert.equal(desktop.boxHeight, 812);
  assert.equal(desktop.shellHeight, desktopSpan + 812);
  const desktopHeroes = [{ kind: 'hero' }, { kind: 'hero' }, { kind: 'hero' }];
  const desktopHeroSpan = stageGeometry(desktopHeroes, 812).span;
  const desktopEarly = stageReleaseBox(desktopHeroes, 812, 812, 100);
  assert.equal(desktopEarly.atEnd, false);
  assert.equal(desktopEarly.boxHeight, 812);
  assert.equal(desktopEarly.shellHeight, desktopHeroSpan + 812);
  const desktopLocal = desktopHeroSpan - 812 * 0.3;
  const desktopApproach = stageReleaseBox(desktopHeroes, 812, 812, desktopLocal);
  assert.equal(desktopApproach.atEnd, false);
  assert.equal(desktopApproach.boxHeight, 812);
  assert.equal(desktopApproach.shellHeight, desktopLocal + 812);
  const desktopUp = stageReleaseBox(desktopHeroes, 812, 812, desktopHeroSpan - 40, 'up');
  assert.equal(desktopUp.atEnd, false);
  assert.equal(desktopUp.boxHeight, 812);
  assert.equal(desktopUp.shellHeight, desktopHeroSpan - 40 + 812);
});
