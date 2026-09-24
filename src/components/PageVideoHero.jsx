import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';

export default function PageVideoHero({
  title,
  eyebrow,
  video,
  poster,
  theme = 'dark',
  overlay = 0.38,
  autoPlay = false,
  muted = false,
  loop = false,
  showPlayControl = true,
}) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const { copy } = useI18n();
  const ambient = Boolean(autoPlay);

  useEffect(() => {
    const media = videoRef.current;
    if (!media) return undefined;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    media.addEventListener('play', onPlay);
    media.addEventListener('pause', onPause);
    media.addEventListener('ended', onPause);
    return () => {
      media.removeEventListener('play', onPlay);
      media.removeEventListener('pause', onPause);
      media.removeEventListener('ended', onPause);
    };
  }, [video]);

  useEffect(() => {
    const media = videoRef.current;
    if (!media || !ambient) return undefined;
    media.muted = true;
    const attempt = media.play();
    if (attempt?.catch) attempt.catch(() => setPlaying(false));
    return undefined;
  }, [ambient, video]);

  const togglePlayback = async () => {
    if (ambient) return;
    const media = videoRef.current;
    if (!media) return;
    if (media.paused) {
      try {
        await media.play();
      } catch {
        setPlaying(false);
      }
    } else media.pause();
  };

  return (
    <section className={`page-video-hero page-video-hero--${theme} ${playing ? 'is-playing' : ''}`} style={{ '--media-overlay': overlay }}>
      {video ? (
        <video
          ref={videoRef}
          poster={poster || undefined}
          preload="metadata"
          playsInline
          muted={muted || ambient}
          autoPlay={ambient}
          loop={loop || ambient}
          onClick={ambient ? undefined : togglePlayback}
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
      {video && showPlayControl && !ambient ? (
        <button className="page-video-hero__play" type="button" onClick={togglePlayback} aria-label={playing ? copy.home.pause : copy.home.play}>
          {playing ? <span className="pause-icon" /> : <span className="play-icon" />}
        </button>
      ) : null}
      <span className="page-video-hero__scroll" aria-hidden="true"><i /></span>
    </section>
  );
}
