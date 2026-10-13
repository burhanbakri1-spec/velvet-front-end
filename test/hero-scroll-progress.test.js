import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HERO_SLICE,
  heroSlideTravel,
  heroStageMotion,
  stepHeroDirection,
} from '../src/components/heroScrollProgress.js';

const header = 88;
const viewportHeight = 900;
const heroHeight = 668;

function column(count, gaps = [], height = heroHeight) {
  const heroes = [];
  let top = 2400;
  for (let index = 0; index < count; index += 1) {
    heroes.push({ top, height });
    top += height + (gaps[index] ?? 0);
  }
  return heroes;
}

function frame(heroes, scrollY, mode) {
  const motion = heroStageMotion({ heroes, scrollY, header, viewportHeight, mode });
  const boxTop = (index) => heroes[index].top - scrollY + motion[index].shift;
  const visibleTop = (index) => boxTop(index) + motion[index].clip;
  const visibleHeight = (index) => heroes[index].height - motion[index].clip - (motion[index].foot || 0);
  return { motion, boxTop, visibleTop, visibleHeight };
}

test('downward BABY to KIDS lingers, then the next hero slides up from the fold', () => {
  const heroes = column(4);
  const flushY = heroes[0].top - header;
  const slack = viewportHeight - header - heroHeight;
  const flush = frame(heroes, flushY, 'down');
  assert.equal(flush.motion[0].shift, 0);
  assert.ok(Math.abs(flush.boxTop(0) - header) <= 1);
  assert.ok(Math.abs(flush.boxTop(1) - viewportHeight) <= 1);
  assert.ok(flush.motion[1].shift > flush.motion[0].shift);
  assert.ok(flush.motion.every((item) => item.clip === 0 && item.stripHidden === false));

  let previousCurrent = Infinity;
  let previousNext = Infinity;
  for (const distance of [40, 120, 220, 360, 520]) {
    const current = frame(heroes, flushY + distance, 'down');
    const gap = current.boxTop(1) - (current.boxTop(0) + heroHeight);
    assert.ok(gap >= -1, `distance=${distance}: heroes overlap`);
    assert.ok(current.boxTop(0) < previousCurrent, 'the outgoing hero reversed');
    assert.ok(current.boxTop(1) < previousNext, 'the incoming hero reversed');
    assert.ok(current.motion.every((item) => item.clip === 0 && item.stripHidden === false));
    previousCurrent = current.boxTop(0);
    previousNext = current.boxTop(1);
  }

  const mid = frame(heroes, flushY + 180, 'down');
  assert.ok(mid.boxTop(1) - (mid.boxTop(0) + heroHeight) < slack - 20);
  const naturalMid = header - 180;
  assert.ok(mid.boxTop(0) > naturalMid + 20, 'the outgoing hero must linger instead of tracking the scrollbar');

  const arrived = frame(heroes, heroes[1].top - header, 'down');
  assert.equal(arrived.motion[1].shift, 0);
  assert.equal(Math.round(arrived.boxTop(1)), header);
  assert.ok(Math.abs(arrived.boxTop(2) - viewportHeight) <= 1);
  const before = frame(heroes, heroes[1].top - header - 1, 'down');
  assert.ok(Math.abs(before.boxTop(2) - arrived.boxTop(2)) <= 2);
});

test('a product strip stays between heroes while the column sweeps', () => {
  const heroes = column(3, [280, 0]);
  const flushY = heroes[0].top - header;
  const span = heroes[1].top - heroes[0].top;
  let sawSlide = false;

  for (const distance of [0, 160, 360, 640, 900]) {
    const current = frame(heroes, flushY + distance, 'down');
    const visualGap = current.boxTop(1) - (current.boxTop(0) + heroHeight);
    assert.ok(visualGap >= 279, `distance=${distance}: strip space collapsed to ${visualGap}px`);
    assert.ok(current.motion.every((item) => item.clip === 0 && item.stripHidden === false));
    const progress = distance / span;
    if (progress > 0.2 && progress < 0.8) {
      const natural = header - distance;
      sawSlide = current.boxTop(0) !== Math.round(natural);
    }
  }
  assert.equal(sawSlide, true);
  assert.ok(heroSlideTravel(0.5) < 0.5);
  assert.ok(Math.abs(heroSlideTravel(0)) < 0.001);
  assert.ok(Math.abs(heroSlideTravel(1) - 1) < 0.001);
});

test('upward scroll from PLAY stacks thin card edges and sits PLAY on them', () => {
  const heroes = column(4);
  const play = 2;
  const opened = frame(heroes, heroes[play].top - header - 180, 'up');
  assert.ok(opened.visibleHeight(0) > 20 && opened.visibleHeight(0) <= HERO_SLICE);
  assert.ok(opened.visibleHeight(1) > 20 && opened.visibleHeight(1) <= HERO_SLICE);
  assert.ok(Math.abs(opened.visibleTop(0) - header) <= 1);
  assert.ok(opened.visibleTop(1) >= opened.visibleTop(0));
  assert.ok(opened.visibleTop(1) < opened.visibleTop(0) + HERO_SLICE);
  assert.equal(opened.motion[play].clip, 0);
  assert.ok(Math.abs(opened.boxTop(play) - (opened.visibleTop(1) + opened.visibleHeight(1))) <= 1);
  assert.ok(opened.boxTop(play) > header + HERO_SLICE);
  assert.equal(opened.motion[0].stripHidden, true);
  assert.equal(opened.motion[1].stripHidden, true);
  assert.equal(opened.motion[play].stripHidden, false);
  assert.ok(opened.motion[3].shift === opened.motion[play].shift);
});

test('the nearest slice grows into the full hero while older slices stay thin', () => {
  const heroes = column(4);
  const kidsFlush = heroes[1].top - header;
  const early = frame(heroes, heroes[2].top - header - 180, 'up');
  const later = frame(heroes, heroes[2].top - header - 560, 'up');
  assert.ok(later.visibleHeight(1) > early.visibleHeight(1) + 80);
  assert.ok(later.visibleHeight(0) <= HERO_SLICE);
  assert.ok(later.boxTop(2) > early.boxTop(2));

  const arrived = frame(heroes, kidsFlush, 'up');
  assert.ok(arrived.motion.every((item) => item.shift === 0 && item.clip === 0 && item.stripHidden === false));

  const above = frame(heroes, kidsFlush - 48, 'up');
  assert.ok(above.visibleHeight(0) > 20 && above.visibleHeight(0) <= HERO_SLICE);
  assert.equal(above.motion[1].clip, 0);
  assert.ok(above.boxTop(1) > header + 20);
  assert.equal(above.motion[2].clip, 0);
});

test('the same scroll position is the same frame, and down restores every strip', () => {
  const heroes = column(4);
  const scrollY = heroes[2].top - header - 180;
  const slow = heroStageMotion({ heroes, scrollY, header, viewportHeight, mode: 'up' });
  const fast = heroStageMotion({ heroes, scrollY, header, viewportHeight, mode: 'up' });
  assert.deepEqual(slow, fast);
  const down = heroStageMotion({ heroes, scrollY, header, viewportHeight, mode: 'down' });
  assert.ok(down.every((item) => item.clip === 0 && item.stripHidden === false && !item.z));
  assert.notDeepEqual(down.map((item) => item.shift), slow.map((item) => item.shift));
});

test('a downward delta leaves the upward model and an upward delta enters it', () => {
  assert.equal(stepHeroDirection('down', -12), 'up');
  assert.equal(stepHeroDirection('up', 4), 'down');
  assert.equal(stepHeroDirection('up', 0), 'up');
  assert.equal(stepHeroDirection('down', 0), 'down');
  assert.equal(HERO_SLICE, 72);
});
