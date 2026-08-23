import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { getPlatformMedia } from '../data/platformContent';

export function PlayButton({ label = 'Play film', onClick, playing = false }) {
  return (
    <button className="play-button" type="button" aria-label={label} aria-pressed={playing} onClick={onClick}>
      <span className={playing ? 'pause-icon' : 'play-icon'} />
    </button>
  );
}

export default function Hero({ introActive }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const { copy } = useI18n();

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
  }, []);

  const togglePlayback = async () => {
    const media = videoRef.current;
    if (!media) return;
    if (media.paused) {
      try { await media.play(); } catch { setPlaying(false); }
    } else media.pause();
  };

  return (
    <section id="top" className={`hero ${introActive ? 'hero--intro' : ''} ${playing ? 'is-playing' : 'is-paused'}`} aria-label={copy.home.feature}>
      <video ref={videoRef} className="hero-media" poster={getPlatformMedia('home.hero.poster', '/media/poster-about.jpg')} preload="metadata" playsInline onClick={togglePlayback} aria-label={copy.home.feature}>
        <source src={getPlatformMedia('home.hero.video', '/media/play-feature.mp4')} type="video/mp4" />
      </video>
      <div className="hero-shade" />
      <h1 className="sr-only">{copy.header.tagline}</h1>
      <PlayButton label={playing ? copy.home.pause : copy.home.play} playing={playing} onClick={togglePlayback} />
      <div className="scroll-cue" aria-hidden="true"><i /></div>
    </section>
  );
}
