import { aboutSections } from './company.js';
import { translations } from '../i18n/translations.js';

export const SITE_MANIFEST_IDENTITY = Object.freeze({
  schemaVersion: '1.0',
  companyId: 'kids-velvet',
  siteId: 'kids-velvet-storefront',
  siteName: 'i-play',
  baseUrl: 'https://i-play.vercel.app',
  routePrefix: '/',
  defaultLocale: 'ar',
  supportedLocales: ['ar', 'en'],
});

const localized = (en, ar) => ({ en, ar });
const localizedText = (en, ar) => localized({ text: en }, { text: ar });

const textElement = (id, type, en, ar, editable = true) => ({
  id,
  type,
  editable,
  content: localizedText(en, ar),
  editableProperties: editable ? ['content'] : [],
});

const imageElement = (id, src, enAlt, arAlt, editable = true) => ({
  id,
  type: 'image',
  editable,
  content: localized(
    { src, alt: enAlt },
    { src, alt: arAlt },
  ),
  editableProperties: editable ? ['content.src', 'content.alt'] : [],
});

const sourceElement = (id, type, source) => ({
  id,
  type,
  editable: false,
  content: localized({ label: source.label }, { label: source.labelAr }),
  source: {
    kind: 'static-module',
    module: source.module,
    export: source.export,
  },
  editableProperties: [],
});

const page = ({ id, route, title, titleAr, sections, navigationVisible = true, editable = true, pageType = 'standard', isSystem = false }) => ({
  id,
  route,
  pageType,
  title: localized(title, titleAr),
  navigationVisible,
  parentId: null,
  order: 0,
  editable,
  isSystem,
  isDynamic: false,
  sections,
});

const section = (id, sectionType, order, editable, elements) => ({
  id,
  sectionType,
  order,
  editable,
  layout: {},
  responsive: {},
  elements,
});

const aboutStoryElements = aboutSections.flatMap((story, index) => [
  textElement(`about-story-${index + 1}-eyebrow`, 'text', story.eyebrow, story.eyebrowAr),
  textElement(`about-story-${index + 1}-title`, 'heading', story.title, story.titleAr),
  textElement(`about-story-${index + 1}-body`, 'richText', story.paragraphs.join('\n\n'), story.paragraphsAr.join('\n\n')),
  imageElement(`about-story-${index + 1}-image`, story.image, story.title, story.titleAr),
]);

export function buildSiteManifest({ generatedAt = new Date().toISOString() } = {}) {
  const en = translations.en;
  const ar = translations.ar;

  return {
    ...SITE_MANIFEST_IDENTITY,
    generatedAt,
    pages: [
      page({
        id: 'home',
        route: '/',
        title: en.meta.home,
        titleAr: ar.meta.home,
        sections: [
          section('home-hero', 'hero', 0, true, [
            textElement('home-hero-tagline', 'heading', en.header.tagline, ar.header.tagline),
            imageElement('home-hero-poster', '/media/poster-about.jpg', en.home.feature, ar.home.feature),
          ]),
          section('home-introduction', 'content', 1, true, [
            textElement('home-introduction-title', 'heading', en.home.introTitle.join(' '), ar.home.introTitle.join(' ')),
            textElement('home-introduction-primary', 'text', en.home.introP1, ar.home.introP1),
            textElement('home-introduction-secondary', 'text', en.home.introP2, ar.home.introP2),
            textElement('home-introduction-link', 'button', en.home.meet, ar.home.meet),
          ]),
          section('home-category-showcases', 'catalog', 2, false, [
            sourceElement('home-category-collection', 'categoryCollection', {
              label: en.home.worlds,
              labelAr: ar.home.worlds,
              module: 'src/data/products.js',
              export: 'homeCategories',
            }),
          ]),
          section('home-careers', 'callToAction', 3, true, [
            textElement('home-careers-eyebrow', 'text', en.home.careersEyebrow, ar.home.careersEyebrow),
            textElement('home-careers-title', 'heading', en.home.careersTitle.join(' '), ar.home.careersTitle.join(' ')),
            textElement('home-careers-body', 'text', en.home.careersBody, ar.home.careersBody),
            textElement('home-careers-link', 'button', en.home.careersCta, ar.home.careersCta),
          ]),
        ],
      }),
      page({
        id: 'products',
        route: '/products',
        title: en.meta.products,
        titleAr: ar.meta.products,
        sections: [
          section('products-hero', 'hero', 0, true, [
            textElement('products-hero-eyebrow', 'text', en.products.eyebrow, ar.products.eyebrow),
            textElement('products-hero-title', 'heading', en.products.title.join(' '), ar.products.title.join(' ')),
            textElement('products-hero-introduction', 'text', en.products.intro, ar.products.intro),
          ]),
          section('products-catalog', 'catalog', 1, false, [
            sourceElement('products-category-collection', 'categoryCollection', {
              label: en.products.categories,
              labelAr: ar.products.categories,
              module: 'src/data/products.js',
              export: 'productCategories',
            }),
            sourceElement('products-product-collection', 'productCollection', {
              label: en.products.products,
              labelAr: ar.products.products,
              module: 'src/data/products.js',
              export: 'products',
            }),
          ]),
        ],
      }),
      page({
        id: 'about',
        route: '/about',
        title: en.meta.about,
        titleAr: ar.meta.about,
        sections: [
          section('about-hero', 'hero', 0, true, [
            textElement('about-hero-eyebrow', 'text', en.about.eyebrow, ar.about.eyebrow),
            textElement('about-hero-title', 'heading', en.about.title, ar.about.title),
            imageElement('about-hero-poster', '/media/poster-about.jpg', en.about.video, ar.about.video),
          ]),
          section('about-stories', 'content', 1, true, aboutStoryElements),
          section('about-careers', 'callToAction', 2, true, [
            textElement('about-careers-eyebrow', 'text', en.about.careersEyebrow, ar.about.careersEyebrow),
            textElement('about-careers-title', 'heading', en.about.careersTitle.join(' '), ar.about.careersTitle.join(' ')),
            textElement('about-careers-link', 'button', en.about.careersCta, ar.about.careersCta),
          ]),
        ],
      }),
      page({
        id: 'news',
        route: '/news',
        title: en.meta.news,
        titleAr: ar.meta.news,
        sections: [
          section('news-hero', 'hero', 0, true, [
            textElement('news-hero-title', 'heading', en.news.title, ar.news.title),
          ]),
          section('news-listing', 'content', 1, false, [
            sourceElement('news-items', 'list', {
              label: en.news.title,
              labelAr: ar.news.title,
              module: 'src/data/company.js',
              export: 'newsItems',
            }),
          ]),
        ],
      }),
      page({
        id: 'contact',
        route: '/contact',
        title: en.meta.contact,
        titleAr: ar.meta.contact,
        sections: [
          section('contact-hero', 'hero', 0, true, [
            textElement('contact-hero-eyebrow', 'text', en.contact.eyebrow, ar.contact.eyebrow),
            textElement('contact-hero-title', 'heading', en.contact.title, ar.contact.title),
            imageElement('contact-hero-poster', '/media/poster-contact.jpg', en.contact.title, ar.contact.title),
          ]),
          section('contact-introduction', 'content', 1, true, [
            textElement('contact-introduction-eyebrow', 'text', en.contact.talk, ar.contact.talk),
            textElement('contact-introduction-title', 'heading', en.contact.heading, ar.contact.heading),
            textElement('contact-introduction-body', 'text', en.contact.intro, ar.contact.intro),
          ]),
          section('contact-form', 'form', 2, false, [
            sourceElement('contact-form-runtime', 'container', {
              label: 'Contact form behavior',
              labelAr: 'Contact form behavior',
              module: 'src/pages/ContactPage.jsx',
              export: 'default',
            }),
          ]),
        ],
      }),
      page({
        id: 'cart',
        route: '/cart',
        title: en.meta.cart,
        titleAr: ar.meta.cart,
        navigationVisible: false,
        editable: false,
        pageType: 'system',
        isSystem: true,
        sections: [
          section('cart-runtime', 'commerce', 0, false, [
            sourceElement('cart-state', 'container', {
              label: en.cart.title,
              labelAr: ar.cart.title,
              module: 'src/context/CartContext.jsx',
              export: 'CartProvider',
            }),
          ]),
        ],
      }),
    ],
  };
}

export default buildSiteManifest;
