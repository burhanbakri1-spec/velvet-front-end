import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPlatformContent, getPlatformMedia } from '../src/data/platformContent.js';
import { applyVlogContent, vlogPosts, vlogVideos } from '../src/data/vlogs.js';

const API = 'https://api.test';

const basePayload = {
  site: { id: 'kids-velvet-storefront', companyId: 'kids-velvet' },
  categories: [],
  products: [],
  texts: [],
  media: [],
};

test('platform vlogs array reaches VlogsPage collections', () => {
  applyPlatformContent({
    ...basePayload,
    vlogs: [
      {
        id: 'v1',
        slug: 'first-vlog',
        title: { en: 'First Vlog', ar: 'المدونة الأولى' },
        description: { en: 'Behind the scenes.', ar: 'خلف الكواليس.' },
        video: '/uploads/vlog-1.mp4',
        image: '/uploads/vlog-1.jpg',
        type: 'video',
      },
      {
        id: 'p1',
        slug: 'story-one',
        title: { en: 'Story One', ar: 'قصة' },
        image: '/uploads/story-1.jpg',
        type: 'post',
      },
    ],
    vlogHero: {
      video: '/uploads/vlogs-hero.mp4',
      poster: '/uploads/vlogs-hero.jpg',
    },
  }, API);

  assert.equal(vlogVideos.length, 1);
  assert.equal(vlogVideos[0].slug, 'first-vlog');
  assert.equal(vlogVideos[0].video, 'https://api.test/uploads/vlog-1.mp4');
  assert.equal(vlogPosts.length, 1);
  assert.equal(vlogPosts[0].slug, 'story-one');
  assert.equal(getPlatformMedia('vlogs.hero.video'), 'https://api.test/uploads/vlogs-hero.mp4');
  assert.equal(getPlatformMedia('vlogs.hero.poster'), 'https://api.test/uploads/vlogs-hero.jpg');
});

test('remote vlogs override static fallback content', () => {
  applyVlogContent({
    videos: [{ id: 'static', slug: 'static', title: 'Static', titleAr: 'Static', video: '/static.mp4', poster: '' }],
    posts: [],
  });
  assert.equal(vlogVideos[0].slug, 'static');

  applyPlatformContent({
    ...basePayload,
    vlogs: [{ id: 'remote', slug: 'remote', title: { en: 'Remote', ar: 'Remote' }, video: '/remote.mp4', type: 'video' }],
  }, API);

  assert.equal(vlogVideos.length, 1);
  assert.equal(vlogVideos[0].slug, 'remote');
});

test('valid empty remote vlogs clears collections without crashing', () => {
  applyVlogContent({
    videos: [{ id: 'old', slug: 'old', title: 'Old', titleAr: 'Old', video: '/old.mp4', poster: '' }],
    posts: [{ id: 'old-post', slug: 'old-post', title: 'Old post', titleAr: 'Old post', image: '/old.jpg' }],
  });

  applyPlatformContent({ ...basePayload, vlogs: [] }, API);

  assert.deepEqual(vlogVideos, []);
  assert.deepEqual(vlogPosts, []);
});

test('legacy vlog media keys still populate when vlogs array is absent', () => {
  applyPlatformContent({
    ...basePayload,
    media: [
      {
        sectionKey: 'vlog.video.legacy-one',
        video: '/uploads/legacy.mp4',
        image: '/uploads/legacy.jpg',
        title: { en: 'Legacy', ar: 'قديم' },
      },
    ],
  }, API);

  assert.equal(vlogVideos.length, 1);
  assert.equal(vlogVideos[0].slug, 'legacy-one');
  assert.equal(vlogVideos[0].video, 'https://api.test/uploads/legacy.mp4');
});
