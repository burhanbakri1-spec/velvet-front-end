import { useEffect, useState } from 'react';

let soundUnlocked = false;

function introIsBlocking() {
  return document.documentElement.classList.contains('intro-active');
}

export function useStorefrontVideo(videoRef, { hold = false, sourceKey = '' } = {}) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const media = videoRef.current;
    if (!media) return undefined;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    media.addEventListener('play', onPlay);
    media.addEventListener('pause', onPause);
    media.addEventListener('ended', onPause);
    return () => {
      media.pause();
      media.removeEventListener('play', onPlay);
      media.removeEventListener('pause', onPause);
      media.removeEventListener('ended', onPause);
    };
  }, [videoRef, sourceKey]);

  useEffect(() => {
    const media = videoRef.current;
    if (!media || hold) return undefined;
    let cancelled = false;
    let attempts = 0;

    const start = async () => {
      if (cancelled || !media.paused || attempts >= 3) return;
      attempts += 1;
      media.playsInline = true;
      if (soundUnlocked || attempts === 1) {
        media.muted = false;
        try {
          await media.play();
          if (!media.muted) soundUnlocked = true;
          return;
        } catch {
          /* Unmuted autoplay was blocked. Fall through to muted playback. */
        }
      }
      if (cancelled || !media.paused) return;
      media.muted = true;
      try {
        await media.play();
      } catch {
        setPlaying(false);
      }
    };

    const onReady = () => {
      if (media.paused) start();
    };

    let introObserver;
    const begin = () => {
      if (cancelled) return;
      start();
      media.addEventListener('canplay', onReady);
    };

    if (introIsBlocking()) {
      introObserver = new MutationObserver(() => {
        if (!introIsBlocking()) {
          introObserver.disconnect();
          begin();
        }
      });
      introObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    } else {
      begin();
    }

    const onGesture = () => {
      soundUnlocked = true;
      const current = videoRef.current;
      if (!current || current.paused || !current.muted) return;
      current.muted = false;
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);

    return () => {
      cancelled = true;
      introObserver?.disconnect();
      media.removeEventListener('canplay', onReady);
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [videoRef, hold, sourceKey]);

  const togglePlayback = async () => {
    const media = videoRef.current;
    if (!media) return;
    if (media.paused) {
      if (soundUnlocked) media.muted = false;
      try {
        await media.play();
        if (!media.muted) soundUnlocked = true;
      } catch {
        setPlaying(false);
      }
    } else {
      media.pause();
    }
  };

  return { playing, togglePlayback };
}
