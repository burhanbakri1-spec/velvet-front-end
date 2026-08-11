import { aboutSections, newsItems } from './company.js';
import { productCategories, products } from './products.js';
import { translations } from '../i18n/translations.js';

const text = (key, group, label, valueEn, valueAr, sortOrder) => ({ key, group, label, valueEn, valueAr, sortOrder, isActive: true });
const media = (sectionKey, sectionLabel, groupKey, imageUrl, sortOrder) => ({ sectionKey, sectionLabel, groupKey, imageUrl, fallbackImageUrl: imageUrl, sortOrder, isActive: true });

function editableCopy() {
  const pairs = [
    ['header.tagline', 'Home / Hero', 'Hero tagline'], ['home.feature', 'Home / Hero', 'Hero accessible label'],
    ['home.introTitle.0', 'Home / Introduction', 'Introduction title line 1'], ['home.introTitle.1', 'Home / Introduction', 'Introduction title line 2'],
    ['home.introP1', 'Home / Introduction', 'Introduction paragraph 1'], ['home.introP2', 'Home / Introduction', 'Introduction paragraph 2'], ['home.meet', 'Home / Introduction', 'Introduction link'],
    ['home.careersEyebrow', 'Home / Careers', 'Careers eyebrow'], ['home.careersTitle.0', 'Home / Careers', 'Careers title line 1'], ['home.careersTitle.1', 'Home / Careers', 'Careers title line 2'], ['home.careersBody', 'Home / Careers', 'Careers body'], ['home.careersCta', 'Home / Careers', 'Careers link'],
    ['products.eyebrow', 'Products / Hero', 'Products eyebrow'], ['products.title.0', 'Products / Hero', 'Products title line 1'], ['products.title.1', 'Products / Hero', 'Products title line 2'], ['products.intro', 'Products / Hero', 'Products introduction'],
    ['about.eyebrow', 'About / Hero', 'About eyebrow'], ['about.title', 'About / Hero', 'About title'], ['about.careersEyebrow', 'About / Careers', 'Careers eyebrow'], ['about.careersTitle.0', 'About / Careers', 'Careers title line 1'], ['about.careersTitle.1', 'About / Careers', 'Careers title line 2'], ['about.careersCta', 'About / Careers', 'Careers link'],
    ['news.title', 'News / Hero', 'News title'],
    ['contact.eyebrow', 'Contact / Hero', 'Contact eyebrow'], ['contact.title', 'Contact / Hero', 'Contact title'], ['contact.talk', 'Contact / Introduction', 'Contact eyebrow'], ['contact.heading', 'Contact / Introduction', 'Contact heading'], ['contact.intro', 'Contact / Introduction', 'Contact introduction'],
  ];
  return pairs.map(([path, group, label], index) => {
    const read = (locale) => path.split('.').reduce((value, part) => value?.[part], translations[locale]);
    return text(`copy.${path}`, group, label, read('en'), read('ar'), index);
  });
}

export function buildPlatformSeed(origin) {
  const baseUrl = new URL(origin).origin;
  const art = (slug, scene) => `${baseUrl}/api/product-art?slug=${encodeURIComponent(slug)}&scene=${scene}`;
  const texts = editableCopy();
  aboutSections.forEach((section, index) => {
    texts.push(text(`about.${index}.eyebrow`, `About / Story ${index + 1}`, 'Story eyebrow', section.eyebrow, section.eyebrowAr, 100 + index * 10));
    texts.push(text(`about.${index}.title`, `About / Story ${index + 1}`, 'Story title', section.title, section.titleAr, 101 + index * 10));
    section.paragraphs.forEach((paragraph, paragraphIndex) => texts.push(text(`about.${index}.paragraph${paragraphIndex + 1}`, `About / Story ${index + 1}`, `Story paragraph ${paragraphIndex + 1}`, paragraph, section.paragraphsAr[paragraphIndex], 102 + index * 10 + paragraphIndex)));
  });

  return {
    schemaVersion: 1,
    companyId: 'kids-velvet',
    siteId: 'kids-velvet-storefront',
    categories: productCategories.filter((category) => category.id !== 'all').map((category, index) => ({
      id: `iplay-category-${category.id}`,
      slug: category.slug,
      name: { en: category.nameEn, ar: category.nameAr },
      description: { en: category.descriptionEn || '', ar: category.descriptionAr || '' },
      imageUrl: new URL(category.heroImage || '/media/poster-about.jpg', baseUrl).toString(),
      sortOrder: index,
      isActive: true,
    })),
    products: products.map((product, index) => ({
      id: product.id,
      slug: product.slug,
      sku: `IPLAY-${String(index + 1).padStart(3, '0')}`,
      name: { en: product.name, ar: product.nameAr || product.name },
      shortDescription: product.shortDescription,
      shortDescriptionAr: product.shortDescriptionAr,
      fullDescription: product.description,
      fullDescriptionAr: product.descriptionAr,
      price: product.price,
      originalPrice: product.originalPrice ?? null,
      categoryId: `iplay-category-${product.categoryId}`,
      image: art(product.slug, 'primary'),
      hoverImage: art(product.slug, 'hover'),
      galleryImages: [art(product.slug, 'primary'), art(product.slug, 'hover'), art(product.slug, 'detail')],
      options: product.options.map((option) => ({
        name: { en: option.name, ar: option.nameAr || option.name },
        values: option.values.map((value) => ({
          label: { en: value.label, ar: value.labelAr || value.label },
          color: value.color || '',
          priceDelta: Number(value.priceDelta || 0),
        })),
      })),
      label: product.badge || '',
      labelAr: product.badgeAr || product.badge || '',
      availability: product.availability,
      availabilityAr: product.availabilityAr,
      featured: index < 4,
      sortOrder: index,
      isActive: true,
      visible: true,
    })),
    texts,
    media: [
      media('home.hero.poster', 'Homepage hero poster', 'Home / Hero', `${baseUrl}/media/poster-about.jpg`, 0),
      media('about.hero.poster', 'About hero poster', 'About / Hero', `${baseUrl}/media/poster-about.jpg`, 0),
      media('contact.hero.poster', 'Contact hero image', 'Contact / Hero', `${baseUrl}/media/poster-contact.jpg`, 0),
      ...aboutSections.map((section, index) => media(`about.${index}.image`, `About story ${index + 1} image`, `About / Story ${index + 1}`, new URL(section.image, baseUrl).toString(), index)),
      ...newsItems.map((item, index) => media(`news.${index}.image`, `News card ${index + 1} image`, 'News', new URL(item.image, baseUrl).toString(), index)),
    ],
  };
}
