import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HERO_SLICE,
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
  const visibleHeight = (index) => heroes[index].height - motion[index].clip;
  return { motion, boxTop, visibleTop, visibleHeight };
}

test('downward BABY to KIDS is a continuous slide with no overlap or white hole', () => {
  const heroes = column(4);
  const flushY = heroes[0].top - header;
  const samples = [0, 80, 200, 334, 500, 667];
  let previousNextTop = Infinity;
  let sawMotion = false;

  for (const distance of samples) {
    const current = frame(heroes, flushY + distance, 'down');
    const gap = current.boxTop(1) - (current.boxTop(0) + heroHeight);
    assert.ok(gap >= -1, `distance=${distance}: heroes overlap by ${-gap}px`);
    assert.ok(gap <= 1, `distance=${distance}: adjacent heroes opened a ${gap}px hole`);
    assert.ok(current.boxTop(1) < previousNextTop, `distance=${distance}: next hero did not move up`);
    assert.ok(current.motion.every((item) => item.clip === 0 && item.stripHidden === false));
    assert.ok(current.motion.every((item) => item.shift === current.motion[0].shift));
    sawMotion ||= current.motion.some((item) => item.shift !== 0);
    previousNextTop = current.boxTop(1);
  }
  assert.equal(sawMotion, true, 'the slide must add motion beyond document scroll');

  const arrived = frame(heroes, heroes[1].top - header, 'down');
  assert.equal(arrived.motion[1].shift, 0);
  assert.equal(Math.round(arrived.boxTop(1)), header);
  assert.ok(arrived.motion.every((item) => item.stripHidden === false && item.clip === 0));
});

test('downward motion survives a 280px product strip and preserves its space', () => {
  const heroes = column(3, [280, 0]);
  const flushY = heroes[0].top - header;
  let sawMotion = false;

  for (const distance of [0, 160, 360, 640, 900]) {
    const current = frame(heroes, flushY + distance, 'down');
    const visualGap = current.boxTop(1) - (current.boxTop(0) + heroHeight);
    assert.ok(visualGap >= 279, `distance=${distance}: strip space collapsed to ${visualGap}px`);
    assert.ok(current.motion.every((item) => item.clip === 0 && item.stripHidden === false));
    sawMotion ||= current.motion[0].shift !== 0 || current.motion[1].shift !== 0;
  }
  assert.equal(sawMotion, true, 'a pair taller than the viewport must still slide');
});

test('upward scroll from PLAY stacks thin BABY and KIDS slices and pushes PLAY down', () => {
  const heroes = column(4);
  const play = 2;
  const opened = frame(heroes, heroes[play].top - header - 180, 'up');
  assert.equal(opened.visibleHeight(0), HERO_SLICE);
  assert.ok(Math.abs(opened.visibleHeight(1) - 180) <= 1);
  assert.ok(Math.abs(opened.visibleTop(0) - header) <= 1);
  assert.ok(Math.abs(opened.visibleTop(1) - (header + HERO_SLICE)) <= 1);
  assert.ok(Math.abs(opened.boxTop(play) - 364) <= 1);
  assert.equal(opened.motion[play].clip, 0);
  assert.ok(opened.motion[play].shift > 0);
  assert.ok(Math.abs(opened.boxTop(play) - (opened.visibleTop(1) + opened.visibleHeight(1))) <= 1);
  assert.equal(opened.motion[0].z, 4);
  assert.equal(opened.motion[1].z, 5);
  assert.equal(opened.motion[0].stripHidden, true);
  assert.equal(opened.motion[1].stripHidden, true);
  assert.equal(opened.motion[play].stripHidden, false);
});

test('the nearest slice grows into the full hero while the older slice stays thin', () => {
  const heroes = column(4);
  const kidsFlush = heroes[1].top - header;
  const early = frame(heroes, heroes[2].top - header - 180, 'up');
  const later = frame(heroes, heroes[2].top - header - 420, 'up');
  assert.ok(later.visibleHeight(1) > early.visibleHeight(1));
  assert.ok(later.visibleHeight(0) <= HERO_SLICE + 1);
  assert.ok(later.boxTop(2) > early.boxTop(2));

  const arrived = frame(heroes, kidsFlush, 'up');
  assert.ok(arrived.motion.every((item) => item.shift === 0 && item.clip === 0 && item.stripHidden === false));

  const above = frame(heroes, kidsFlush - 48, 'up');
  assert.equal(above.visibleHeight(0), 48);
  assert.equal(above.motion[1].clip, 0);
  assert.ok(above.boxTop(1) > header);
  assert.equal(above.motion[2].clip, 0);
  assert.equal(above.motion[2].shift, 0);
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
});
