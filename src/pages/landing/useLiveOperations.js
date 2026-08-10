import { useEffect, useRef, useState } from 'react';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function seedState() {
  return {
    deliveries: 128,
    bottles: 342,
    revenue: 48600,
    onTime: 94,
    ordersPerMin: 6,
    spark: [4, 5, 4, 6, 5, 7, 6, 8, 7, 6, 8, 7],
    trend: [22, 26, 24, 30, 28, 34, 31, 38, 36, 42, 40, 46],
    donut: { delivered: 82, returned: 47, inField: 21 },
    bars: [34, 27, 19, 14, 9],
  };
}

function nextState(prev) {
  const step = (arr, min, max) => {
    const last = arr[arr.length - 1];
    const value = clamp(Math.round(last + (Math.random() * 8 - 3.5)), min, max);
    return [...arr.slice(1), value];
  };
  const jitter = (v, d, min, max) => clamp(Math.round(v + (Math.random() * d * 2 - d)), min, max);

  return {
    deliveries: prev.deliveries + (Math.random() > 0.55 ? 1 : 0),
    bottles: jitter(prev.bottles, 3, 300, 400),
    revenue: prev.revenue + Math.round(Math.random() * 900),
    onTime: clamp(+(prev.onTime + (Math.random() * 1.2 - 0.6)).toFixed(1), 90, 98),
    ordersPerMin: jitter(prev.ordersPerMin, 2, 2, 14),
    spark: step(prev.spark, 2, 14),
    trend: step(prev.trend, 16, 60),
    donut: {
      delivered: jitter(prev.donut.delivered, 2, 70, 95),
      returned: jitter(prev.donut.returned, 2, 38, 58),
      inField: jitter(prev.donut.inField, 1, 14, 28),
    },
    bars: prev.bars.map((b, i) => jitter(b, i === 0 ? 3 : 2, 4, 40)),
  };
}

/**
 * Simulated live operations data. Ticks every 2.6s while its board is on
 * screen (pauses off-screen to avoid pointless background work), and holds
 * at the seed values under prefers-reduced-motion instead of animating.
 */
export function useLiveOperations(reduceMotion) {
  const [live, setLive] = useState(seedState);
  const boardRef = useRef(null);
  // default on: the observer only pauses updates while the board is off-screen
  const inView = useRef(true);

  useEffect(() => {
    if (reduceMotion) return undefined;
    let cleanupObserver;
    if (!boardRef.current || !('IntersectionObserver' in window)) {
      inView.current = true;
    } else {
      const observer = new window.IntersectionObserver(([entry]) => {
        inView.current = entry.isIntersecting;
      }, { threshold: 0.1 });
      observer.observe(boardRef.current);
      cleanupObserver = () => observer.disconnect();
    }
    const id = window.setInterval(() => {
      if (inView.current) setLive((prev) => nextState(prev));
    }, 2600);
    return () => {
      window.clearInterval(id);
      if (cleanupObserver) cleanupObserver();
    };
  }, [reduceMotion]);

  return { live, boardRef };
}
