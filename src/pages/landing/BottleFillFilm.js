import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import bottleRefillVideo from './assets/bottle-refill.mp4';
import bottleRefillPoster from './assets/bottle-refill-poster.webp';

function BottleFillFilm({ playing = true, replayKey = 0 }) {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef(null);
  // Under prefers-reduced-motion, `playing` still turns true on mount (there's
  // no scroll-triggered autoplay to suppress), so it can't tell "the page
  // decided to play this" from "the visitor asked to". `replayKey` can: it
  // only advances past its initial 0 when the visible Replay button fires,
  // which is exactly the explicit, user-initiated case reduced motion still
  // allows.
  const shouldPlay = playing && (!reduceMotion || replayKey > 0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (shouldPlay) {
      // Autoplay policies allow a muted, programmatic play() — the promise
      // can reject if the browser hasn't finished loading yet, which is
      // fine, playback picks up as soon as it's ready.
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [shouldPlay]);

  return (
    <div
      key={`refill-${replayKey}`}
      className={`bottle-film bottle-film--refill${shouldPlay ? ' is-playing' : ''}`}
      data-film-mode="refill"
    >
      <span className="bottle-film__timecode" aria-hidden="true">00:00:04</span>
      <span className="bottle-film__status" aria-hidden="true"><i /> Filling sequence</span>
      <video
        ref={videoRef}
        className="bottle-film__video"
        src={bottleRefillVideo}
        poster={bottleRefillPoster}
        aria-label="Real footage of a nineteen litre water jug being filled with water"
        muted
        loop
        playsInline
        preload="none"
      />
      <div className="bottle-film__timeline" aria-hidden="true">
        <i />
        <span>Fill</span>
        <span>Settle</span>
        <span>Ready</span>
      </div>
    </div>
  );
}

export default BottleFillFilm;
