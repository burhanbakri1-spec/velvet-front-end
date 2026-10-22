import { useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { newsItems } from '../data/company';
import { Link } from '../routing/Router';
import PageTitleHero from '../components/PageTitleHero';

export default function NewsArticlePage({ slug }) {
  const { copy, locale } = useI18n();

  const article = useMemo(() => newsItems.find((item) => item.id === slug), [slug]);

  if (!article) {
    return (
      <section className="store-not-found">
        <span className="store-eyebrow">{copy.detail.missingEyebrow}</span>
        <h1>{copy.detail.missing}</h1>
        <Link className="store-primary-button" to="/news">{copy.news.title}</Link>
      </section>
    );
  }

  const title = locale === 'ar' ? article.titleAr : article.title;
  const category = locale === 'ar' ? article.categoryAr : article.category;
  const formatDate = (value) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`));

  // NOTE: newsItems only contain title, category, date, image — no body/content field exists in project data.
  // Full article content is a content blocker; rendering available metadata only.

  return (
    <article className="news-article-page">
      <PageTitleHero title={title} />
      <div className="news-article-container">
        <header className="news-article-header">
          <div className="news-article-meta">
            <span>{formatDate(article.date)}</span>
            <span>{category}</span>
          </div>
          <h1>{title}</h1>
        </header>
        <div className="news-article-media">
          <img src={article.image} alt="" />
        </div>
        <div className="news-article-content">
          <p>{copy.news.read} <i>{locale === 'ar' ? '←' : '→'}</i></p>
          <p className="news-article-unavailable">
            {locale === 'ar'
              ? 'محتوى المقال الكامل غير متاح حالياً. يرجى مراجعة صفحة الأخبار الرئيسية.'
              : 'Full article content is not available yet. Please visit the main News page.'}
          </p>
        </div>
        <footer className="news-article-footer">
          <Link to="/news" className="store-secondary-button">
            {locale === 'ar' ? '←' : '→'} {copy.news.title}
          </Link>
        </footer>
      </div>
    </article>
  );
}