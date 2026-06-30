import { useEffect, useState, useRef } from 'react';

export function useCountUp(target, { duration = 1400, delay = 0, enabled = true } = {}) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const el = ref.current;
    if (!el) return undefined;

    const run = () => {
      if (started.current) return;
      started.current = true;
      const startAt = performance.now() + delay;

      const tick = (now) => {
        if (now < startAt) {
          requestAnimationFrame(tick);
          return;
        }
        const progress = Math.min((now - startAt) / duration, 1);
        const eased = 1 - (1 - progress) ** 3;
        setValue(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) run();
      },
      { threshold: 0.2 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration, delay, enabled]);

  return { value, ref };
}

