import assert from 'node:assert/strict';
import test from 'node:test';
import { collectProductImages } from '../src/data/products.js';
import { getPathHeroMedia, applyDynamicCatalog, velvetBrands } from '../src/data/velvetCatalog.js';
import { applyPlatformContent } from '../src/data/platformContent.js';

test('collectProductImages deduplicates and includes all real media without a fixed max', () => {
  const product = {
    image: 'https://cdn.example/a.jpg',
    hoverImage: 'https://cdn.example/b.jpg',
    gallery: [
      'https://cdn.example/a.jpg',
      'https://cdn.example/c.jpg',
      'https://cdn.example/d.jpg',
      'https://cdn.example/e.jpg',
      'https://cdn.example/f.jpg',
      'https://cdn.example/g.jpg',
    ],
  };
  assert.deepEqual(collectProductImages(product), [
    'https://cdn.example/a.jpg',
    'https://cdn.example/c.jpg',
    'https://cdn.example/d.jpg',
    'https://cdn.example/e.jpg',
    'https://cdn.example/f.jpg',
    'https://cdn.example/g.jpg',
    'https://cdn.example/b.jpg',
  ]);
});

test('path hero prefers subcategory media then category media', () => {
  applyPlatformContent({
    site: { id: 'kids-velvet-storefront', companyId: 'kids-velvet' },
    brands: [{ id: 'b1', slug: 'velvet-baby', name: { en: 'VELVET BABY', ar: 'VELVET BABY' }, sortOrder: 1 }],
    categories: [
      { id: 'c1', slug: 'musical-baby-toys', name: { en: 'Musical Baby Toys', ar: 'ألعاب موسيقية' }, brandId: 'b1', image: '/uploads/cat.jpg', sortOrder: 1 },
      { id: 's1', slug: 'musical-toys', name: { en: 'Musical Toys', ar: 'موسيقية' }, parentId: 'c1', brandId: 'b1', image: '/uploads/sub.jpg', sortOrder: 1 },
    ],
    products: [{
      id: 'p1', slug: 'toy-a', name: { en: 'Toy A', ar: 'لعبة' }, brandId: 'b1', mainCategoryId: 'c1', subcategoryId: 's1',
      image: '/uploads/p.jpg', price: 10, sortOrder: 1,
    }],
    texts: [],
    media: [],
  }, 'https://api.test');

  const product = {
    velvetPath: { brandId: 'baby', categoryId: 'musical-baby-toys', subcategoryId: 'musical-toys' },
  };
  const hero = getPathHeroMedia(product);
  assert.equal(hero.source, 'subcategory');
  assert.equal(hero.image, 'https://api.test/uploads/sub.jpg');
  assert.equal(hero.name.en, 'Musical Toys');

  // Restore static catalog for later tests.
  applyDynamicCatalog(null, null);
  assert.ok(velvetBrands.length > 0);
});
