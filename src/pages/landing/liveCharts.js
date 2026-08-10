import React from 'react';

export function Sparkline({ data, stroke = '#59e6cf' }) {
  const w = 96;
  const h = 30;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const stepX = w / (data.length - 1);
  const d = data
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)} ${(h - ((v - min) / span) * (h - 6) - 3).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="ops-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function MiniRadial({ value }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  return (
    <svg className="ops-mini-radial" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(173,232,236,.16)" strokeWidth="5" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="#59e6cf"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 20 20)"
        style={{ transition: 'stroke-dashoffset 700ms ease' }}
      />
    </svg>
  );
}
