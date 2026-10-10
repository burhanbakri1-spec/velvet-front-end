import { useRef } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useStorefrontVideo } from './useStorefrontVideo';

export default function PageVideoHero({
  title,
  eyebrow,
  video,
  poster,
  theme = 'dark',
  overlay = 0.38,
  loop = false,
  showPlayControl = true,
}) {
  const videoRef = useRef(null);
  const { copy } = useI18n();
  const { playing, togglePlayback } = useStorefrontVideo(videoRef, { sourceKey: video || '' });

  return (
    <section className={`page-video-hero page-video-hero--${theme} ${playing ? 'is-playing' : ''}`} style={{ '--media-overlay': overlay }} onClick={video ? togglePlayback : undefined}>
      {video ? (
        <video
          ref={videoRef}
          poster={poster || undefined}
          preload="metadata"
          playsInline
          loop={loop}
          aria-label={title}
        >
          <source src={video} type="video/mp4" />
        </video>
      ) : <img className="page-video-hero__image" src={poster} alt="" />}
      <div className="page-video-hero__shade" />
      <div className="page-video-hero__title">
        {eyebrow ? <span className="store-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
      </div>
      {video && showPlayControl ? (
        <button className="page-video-hero__play" type="button" onClick={(event) => { event.stopPropagation(); togglePlayback(); }} aria-label={playing ? copy.home.pause : copy.home.play}>
          {playing ? <span className="pause-icon" /> : <span className="play-icon" />}
        </button>
      ) : null}
      <span className="page-video-hero__scroll" aria-hidden="true"><i /></span>
    </section>
  );
}
