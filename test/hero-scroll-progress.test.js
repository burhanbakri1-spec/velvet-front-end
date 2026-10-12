import assert from 'node:assert/strict';
import test from 'node:test';
import { heroStageMotion, stepHeroScrollDirection } from '../src/components/heroScrollProgress.js';

const header = 88;
const viewportHeight = 900;
const heroHeight = 668;
const gap = 280;

function column(count) {
  const heroes = [];
  let top = 1400;
  for (let index = 0; index < count; index += 1) {
    heroes.push({ top, height: heroHeight });
    top += heroHeight + gap;
  }
  return heroes;
}

test('a hero flush with the header leaves every banner in document flow', () => {
  const heroes = column(4);
  const scrollY = heroes[2].top - header;
  const motion = heroStageMotion({ heroes, scrollY, header, viewportHeight });
  assert.ok(motion.every((item) => item.shift === 0 && item.clip === 0 && item.stripHidden === false));
});

function pairColumn(count, pairGap = gap) {
  const heroes = [];
  let top = 1400;
  for (let index = 0; index < count; index += 1) {
    heroes.push({ top, height: heroHeight });
    top += heroHeight + pairGap;
  }
  return heroes;
}

function visualBottom(hero, scrollY, shift) {
  return hero.top - scrollY + shift + hero.height;
}

test('PLAY to KIDS, BUILD to PLAY, and KIDS to BABY move 1:1 from the first upward pixels', () => {
  const heroes = pairColumn(4, 0);
  [2, 3, 1].forEach((current) => {
    [50, 150].forEach((distance) => {
      const scrollY = heroes[current].top - header - distance;
      const motion = heroStageMotion({ heroes, scrollY, header, viewportHeight });
      assert.equal(motion[current - 1].clip, 0);
      assert.equal(motion[current - 1].shift, 0);
      assert.equal(motion[current].shift, 0);
      assert.equal(motion[current].clip, 0);
      assert.equal(Math.round(visualBottom(heroes[current - 1], scrollY, 0)), header + distance);
      assert.ok(motion.every((item) => item.clip === 0));
    });
  });
});

test('stopping halfway is the same frame as arriving there quickly', () => {
  const heroes = pairColumn(4, 0);
  const scrollY = heroes[2].top - header - 320;
  const slow = heroStageMotion({ heroes, scrollY, header, viewportHeight });
  const fast = heroStageMotion({ heroes, scrollY, header, viewportHeight });
  assert.deepEqual(slow, fast);
  assert.equal(Math.round(visualBottom(heroes[1], scrollY, slow[1].shift)), header + 320);
});

test('a hero the header still cuts through is not clipped or pinned', () => {
  const heroes = pairColumn(4, 0);
  const scrollY = heroes[2].top - header + 220;
  const motion = heroStageMotion({ heroes, scrollY, header, viewportHeight });
  assert.ok(motion.every((item) => item.shift === 0 && item.clip === 0 && item.stripHidden === false));
});

test('a strip between heroes stays concealed during the handoff and returns at the natural frame', () => {
  const heroes = column(4);
  const at = (band) => heroStageMotion({
    heroes,
    scrollY: heroes[2].top - header - band,
    header,
    viewportHeight,
  });
  const early = at(50);
  const full = at(heroHeight);
  const arrived = at(heroHeight + gap);
  const next = at(heroHeight + gap + 50);
  assert.equal(early[1].clip, 0);
  assert.equal(early[1].shift, gap);
  assert.equal(early[1].stripHidden, true);
  assert.equal(early[2].shift, 0);
  assert.equal(Math.round(visualBottom(heroes[1], heroes[2].top - header - 50, early[1].shift)), header + 50);
  assert.equal(full[1].shift, gap);
  assert.equal(full[1].stripHidden, true);
  assert.equal(full[0].shift, 0);
  assert.equal(arrived[1].shift, 0);
  assert.equal(arrived[1].stripHidden, false);
  assert.equal(next[0].shift, gap);
  assert.equal(next[0].stripHidden, true);
  assert.equal(next[1].shift, 0);
  assert.equal(next[1].clip, 0);
});

test('downward scroll stays in normal flow until a clear upward threshold', () => {
  const start = { mode: 'down', accum: 0 };
  const nudge = stepHeroScrollDirection(start, -8);
  assert.equal(nudge.mode, 'down');
  const up = stepHeroScrollDirection(nudge, -30);
  assert.equal(up.mode, 'up');
  const dip = stepHeroScrollDirection(up, 10);
  assert.equal(dip.mode, 'up');
  const down = stepHeroScrollDirection(dip, 40);
  assert.equal(down.mode, 'down');
});

test('returning to down clears the reverse mode so product strips are not kept concealed', () => {
  const up = stepHeroScrollDirection({ mode: 'down', accum: 0 }, -36);
  assert.equal(up.mode, 'up');
  const down = stepHeroScrollDirection(up, 80);
  assert.equal(down.mode, 'down');
  assert.equal(down.accum, 36);
});

test('the same scroll offset always returns the same motion, including a large jump', () => {
  const heroes = column(4);
  const scrollY = heroes[2].top - header - 900;
  const first = heroStageMotion({ heroes, scrollY, header, viewportHeight });
  const second = heroStageMotion({ heroes, scrollY, header, viewportHeight });
  assert.deepEqual(first, second);
  const restored = heroStageMotion({ heroes, scrollY: heroes[2].top - header, header, viewportHeight });
  assert.ok(restored.every((item) => item.shift === 0 && item.clip === 0));
});
