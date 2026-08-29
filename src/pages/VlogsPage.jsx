import PageTitleHero from '../components/PageTitleHero';
import PageVideoHero from '../components/PageVideoHero';
import { getVlogBody, getVlogCategory, getVlogTitle, vlogPosts, vlogVideos } from '../data/vlogs';
import { getPlatformMedia } from '../data/platformContent';
import { useI18n } from '../i18n/I18nContext';

export default function VlogsPage() {
  const { copy, locale } = useI18n();
  const heroVideo = getPlatformMedia('vlogs.hero.video');
  const heroPoster = getPlatformMedia('vlogs.hero.poster');
  const hasVideos = vlogVideos.length > 0;
  const hasPosts = vlogPosts.length > 0;
  const isEmpty = !hasVideos && !hasPosts;

  return (
    <div className="vlogs-page">
      {heroVideo || heroPoster ? (
        <PageVideoHero
          title={copy.vlogs.title}
          eyebrow={copy.vlogs.eyebrow}
          video={heroVideo}
          poster={heroPoster}
          theme="dark"
          overlay={0.38}
        />
      ) : (
        <PageTitleHero title={copy.vlogs.title} />
      )}
      <section className="vlogs-intro">
        <span className="store-eyebrow">{copy.vlogs.eyebrow}</span>
        <p>{copy.vlogs.intro}</p>
      </section>

      {isEmpty ? (
        <section className="vlogs-empty" aria-live="polite">
          <h2>{copy.vlogs.emptyTitle}</h2>
          <p>{copy.vlogs.emptyBody}</p>
        </section>
      ) : (
        <>
          {hasVideos && (
            <section className="vlogs-section" aria-label={copy.vlogs.videos}>
              <div className="vlogs-section__head">
                <span className="store-eyebrow">{copy.vlogs.videos}</span>
                <h2>{copy.vlogs.videos}</h2>
              </div>
              <div className="vlogs-video-grid">
                {vlogVideos.map((item) => (
                  <article className="vlog-video-card" key={item.id || item.slug || item.video}>
                    <div className="vlog-video-card__media">
                      {item.video ? (
                        <video
                          className="vlog-video-card__player"
                          src={item.video}
                          poster={item.poster || undefined}
                          controls
                          playsInline
                          preload="metadata"
                          aria-label={getVlogTitle(item, locale)}
                        />
                      ) : item.poster ? (
                        <img className="vlog-video-card__poster" src={item.poster} alt="" />
                      ) : null}
                    </div>
                    <div className="vlog-video-card__body">
                      {getVlogCategory(item, locale) && <span>{getVlogCategory(item, locale)}</span>}
                      <h3>{getVlogTitle(item, locale)}</h3>
                      {getVlogBody(item, locale) && <p>{getVlogBody(item, locale)}</p>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {hasPosts && (
            <section className="vlogs-section" aria-label={copy.vlogs.posts}>
              <div className="vlogs-section__head">
                <span className="store-eyebrow">{copy.vlogs.posts}</span>
                <h2>{copy.vlogs.posts}</h2>
              </div>
              <div className="vlogs-post-grid">
                {vlogPosts.map((item) => (
                  <article className="vlog-post-card" key={item.id || item.slug || getVlogTitle(item, locale)}>
                    {item.image && (
                      <div className="vlog-post-card__media">
                        <img className="vlog-post-card__image" src={item.image} alt="" />
                      </div>
                    )}
                    <div className="vlog-post-card__body">
                      {getVlogCategory(item, locale) && <span>{getVlogCategory(item, locale)}</span>}
                      <h3>{getVlogTitle(item, locale)}</h3>
                      {getVlogBody(item, locale) && <p>{getVlogBody(item, locale)}</p>}
                      {item.link ? (
                        <a className="vlog-post-card__link" href={item.link} target="_blank" rel="noopener noreferrer">
                          {copy.vlogs.read} <i aria-hidden="true">{locale === 'ar' ? '←' : '→'}</i>
                        </a>
                      ) : (
                        <span className="vlog-post-card__link vlog-post-card__link--static">
                          {copy.vlogs.read} <i aria-hidden="true">{locale === 'ar' ? '←' : '→'}</i>
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
