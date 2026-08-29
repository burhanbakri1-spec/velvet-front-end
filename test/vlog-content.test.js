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
        mediaType: 'video',
        title: { en: 'First Vlog', ar: 'المدونة الأولى' },
        description: { en: 'Behind the scenes.', ar: 'خلف الكواليس.' },
        videoUrl: '/uploads/vlog-1.mp4',
        posterUrl: '/uploads/vlog-1.jpg',
        imageUrl: '/uploads/unused.jpg',
      },
      {
        id: 'p1',
        slug: 'story-one',
        mediaType: 'image',
        title: { en: 'Story One', ar: 'قصة' },
        imageUrl: '/uploads/story-1.jpg',
        link: 'https://example.com/story',
      },
    ],
    vlogHero: {
      videoUrl: '/uploads/vlogs-hero.mp4',
      posterUrl: '/uploads/vlogs-hero.jpg',
    },
  }, API);

  assert.equal(vlogVideos.length, 1);
  assert.equal(vlogVideos[0].slug, 'first-vlog');
  assert.equal(vlogVideos[0].video, 'https://api.test/uploads/vlog-1.mp4');
  assert.equal(vlogVideos[0].poster, 'https://api.test/uploads/vlog-1.jpg');
  assert.equal(vlogPosts.length, 1);
  assert.equal(vlogPosts[0].slug, 'story-one');
  assert.equal(vlogPosts[0].image, 'https://api.test/uploads/story-1.jpg');
  assert.equal(vlogPosts[0].video, '');
  assert.equal(vlogPosts[0].link, 'https://example.com/story');
  assert.equal(getPlatformMedia('vlogs.hero.video'), 'https://api.test/uploads/vlogs-hero.mp4');
  assert.equal(getPlatformMedia('vlogs.hero.poster'), 'https://api.test/uploads/vlogs-hero.jpg');
});

test('video vlog poster falls back to imageUrl when posterUrl is missing', () => {
  applyPlatformContent({
    ...basePayload,
    vlogs: [{
      id: 'v2',
      mediaType: 'video',
      videoUrl: '/uploads/v2.mp4',
      imageUrl: '/uploads/v2-fallback.jpg',
      title: { en: 'Fallback poster', ar: 'Fallback poster' },
    }],
  }, API);

  assert.equal(vlogVideos[0].poster, 'https://api.test/uploads/v2-fallback.jpg');
});

test('inactive vlogs are excluded from collections', () => {
  applyPlatformContent({
    ...basePayload,
    vlogs: [
      { id: 'hidden', mediaType: 'video', videoUrl: '/uploads/hidden.mp4', isActive: false, title: { en: 'Hidden', ar: 'Hidden' } },
      { id: 'visible', mediaType: 'video', videoUrl: '/uploads/visible.mp4', isActive: true, title: { en: 'Visible', ar: 'Visible' } },
    ],
  }, API);

  assert.equal(vlogVideos.length, 1);
  assert.equal(vlogVideos[0].slug, 'visible');
});

test('VlogsPage renders video controls and image posts without video elements', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../src/pages/VlogsPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /controls/);
  assert.match(source, /playsInline/);
  assert.match(source, /poster=\{item\.poster/);
  assert.match(source, /vlog-post-card__image/);
  assert.doesNotMatch(source, /vlogPosts\.map[\s\S]*?<video/);
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
