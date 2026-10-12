import assert from 'node:assert/strict';
import test from 'node:test';
import { heroStageMotion } from '../src/components/heroScrollProgress.js';

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

test('upward scroll reveals the previous hero from the header by exactly the scroll distance', () => {
  const heroes = column(4);
  const scrollY = heroes[2].top - header - 40;
  const motion = heroStageMotion({ heroes, scrollY, header, viewportHeight });
  const playTop = heroes[1].top - scrollY;
  assert.equal(motion[1].shift, header - playTop);
  assert.equal(motion[1].clip, heroHeight - 40);
  assert.equal(motion[1].stripHidden, true);
  assert.equal(motion[0].shift, 0);
  assert.equal(motion[2].shift, 0);
});

test('a strip between heroes is absorbed before the next previous hero enters, with no jump at arrival', () => {
  const heroes = column(4);
  const at = (band) => heroStageMotion({
    heroes,
    scrollY: heroes[2].top - header - band,
    header,
    viewportHeight,
  });
  const full = at(heroHeight);
  const midway = at(heroHeight + gap / 2);
  const arrived = at(heroHeight + gap);
  const next = at(heroHeight + gap + 40);
  assert.equal(at(40)[1].stripHidden, true);
  assert.equal(full[1].clip, 0);
  assert.equal(full[1].stripHidden, false);
  assert.equal(full[0].shift, 0);
  assert.equal(midway[1].shift, Math.round(header - (heroes[1].top - (heroes[2].top - header - (heroHeight + gap / 2)))));
  assert.equal(midway[0].shift, 0);
  assert.equal(arrived[1].shift, 0);
  assert.equal(arrived[0].shift, 0);
  assert.equal(next[0].clip, heroHeight - 40);
  assert.equal(next[1].shift, 0);
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
