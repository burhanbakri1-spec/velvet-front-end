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
  const progress = unit <= HERO_HOLD ? 0 : (unit - HERO_HOLD) / (1 - HERO_HOLD);
  return {
    progress,
    currentY: -(Math.round(progress * stageHeight * HERO_COVER_DRIFT) || 0),
    nextY: Math.round((1 - progress) * stageHeight) || 0,
  };
}

test('down holds the slide, then slides it in one flush push', () => {
  const pattern = ['hero', 'hero', 'hero', 'hero'];
  assert.ok(HERO_HOLD >= 0.3 && HERO_HOLD <= 0.4);

  const start = frame(pattern, 0, 'down');
  assert.equal(start.motion[0].y, 0);
  assert.equal(start.motion[1].y, stageHeight);
  assert.ok(start.motion.every((item) => item.clipTop === 0 && item.clipBottom === 0 && item.hidden === false));

  const held = frame(pattern, stageHeight * HERO_HOLD, 'down');
  assert.equal(held.motion[0].y, 0);
  assert.equal(held.motion[1].y, stageHeight);

  const early = frame(pattern, stageHeight * 0.5, 'down');
  const earlyCover = coverAt(0.5);
  assert.equal(early.motion[0].y, earlyCover.currentY);
  assert.equal(early.motion[1].y, earlyCover.nextY);
  assert.ok(early.motion[0].y + stageHeight > early.motion[1].y);
  assert.ok(early.motion[1].z > early.motion[0].z);

  const mid = frame(pattern, stageHeight * 0.7, 'down');
  const midCover = coverAt(0.7);
  assert.ok(Math.abs(midCover.progress - 0.5) < 1e-9);
  assert.equal(mid.motion[0].y, midCover.currentY);
  assert.equal(mid.motion[1].y, stageHeight / 2);
  assert.ok(mid.motion[0].y > -stageHeight * 0.25);
  assert.ok(mid.motion[1].y > stageHeight * 0.4 && mid.motion[1].y < stageHeight * 0.6);
  assert.ok(mid.motion[0].y + stageHeight > mid.motion[1].y);

  const arrived = frame(pattern, stageHeight, 'down');
  const before = frame(pattern, stageHeight - 1, 'down');
  assert.equal(arrived.motion[1].y, 0);
  assert.equal(arrived.motion[2].y, stageHeight);
  assert.equal(arrived.motion[0].y, -stageHeight);
  assert.ok(Math.abs(before.motion[1].y - arrived.motion[1].y) <= 2);
});

test('a product strip is its own hold-and-slide and a missing strip is skipped', () => {
  const pattern = ['hero', 'strip', 'hero'];
  const heldStrip = frame(pattern, stageHeight + stageHeight * 0.2, 'down');
  assert.equal(heldStrip.motion[1].y, 0);
  assert.equal(heldStrip.motion[2].y, stageHeight);
  assert.equal(heldStrip.motion[1].hidden, false);

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
  const held = heroStageMotion({ slides: list, local: stageHeight * 0.2, stageHeight, mode: 'down' });
  const origin = heroStageMotion({ slides: list, local: 0, stageHeight, mode: 'down' });
  assert.deepEqual(held, origin);
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

  const hold = heroStageMotion({
    slides: list,
    local: stageHeight + stripHeight * 0.2,
    stageHeight,
    mode: 'down',
  });
  assert.equal(hold[1].y, 0);
  assert.equal(hold[2].y, stripHeight);
  assert.ok(hold[2].y < stageHeight);

  const unit = 0.7;
  const t = (unit - HERO_HOLD) / (1 - HERO_HOLD);
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
