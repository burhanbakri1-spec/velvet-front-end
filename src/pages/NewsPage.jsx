import { useMemo, useState } from 'react';
import PageTitleHero from '../components/PageTitleHero';
import { newsCategories, newsItems } from '../data/company';
import { useI18n } from '../i18n/I18nContext';

export default function NewsPage() {
  const { copy, locale } = useI18n();
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('latest');
  const formatDate = (value) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`));

  const visibleItems = useMemo(() => {
    const categoryModel = newsCategories.find((item) => item.id === category);
    const filtered = category === 'all' ? newsItems : newsItems.filter((item) => item.category === categoryModel?.en);
    return [...filtered].sort((a, b) => {
      if (sort === 'oldest') return a.date.localeCompare(b.date);
      if (sort === 'az') return (locale === 'ar' ? a.titleAr : a.title).localeCompare(locale === 'ar' ? b.titleAr : b.title, locale);
      return b.date.localeCompare(a.date);
    });
  }, [category, locale, sort]);

  return (
    <div className="news-page">
      <PageTitleHero title={copy.news.title} />
      <section className="news-controls" aria-label={copy.news.filters}>
        <div className="news-filters">
          {newsCategories.map((item) => <button className={category === item.id ? 'is-active' : ''} type="button" onClick={() => setCategory(item.id)} key={item.id}>{item[locale]}</button>)}
        </div>
        <label className="news-sort">
          <span>{copy.news.sort}</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label={copy.news.sort}>
            <option value="latest">{copy.news.latest}</option>
            <option value="oldest">{copy.news.oldest}</option>
            <option value="az">{copy.news.az}</option>
          </select>
        </label>
      </section>
      <section className="news-grid" aria-live="polite">
        {visibleItems.map((item, index) => (
          <article className={`news-card ${index === 0 ? 'news-card--lead' : ''}`} key={item.id}>
            <img src={item.image} alt="" />
            <div className="news-card__shade" />
            <div className="news-card__content">
              <div className="news-card__meta"><span>{formatDate(item.date)}</span><span>{locale === 'ar' ? item.categoryAr : item.category}</span></div>
              <h2>{locale === 'ar' ? item.titleAr : item.title}</h2>
              <span className="news-card__link">{copy.news.read} <i>{locale === 'ar' ? '←' : '→'}</i></span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
