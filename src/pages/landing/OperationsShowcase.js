import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Activity, CheckCheck, Droplets, TrendingUp, Truck } from 'lucide-react';
import { useLiveOperations } from './useLiveOperations';
import operationsIllustration from './assets/operations-illustration.webp';
import doorstepIllustration from './assets/doorstep-illustration.webp';

const enterEase = [0.22, 1, 0.36, 1];
const viewportOnce = { once: true, amount: 0.15 };

const areaLabels = ['Cantt', 'Model', 'Kashmir', 'Defence', 'Others'];

/* ---------- small chart primitives ---------- */

function DonutChart({ donut }) {
  const size = 104;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const segments = [
    { label: 'Delivered', value: donut.delivered, color: '#29c9e8' },
    { label: 'Returned', value: donut.returned, color: '#79f2c5' },
    { label: 'In field', value: donut.inField, color: '#3b8cff' },
  ];
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let acc = 0;
  const arcs = segments.map((seg) => {
    const length = (seg.value / total) * circumference;
    const arc = { ...seg, length, gap: circumference - length, offset: -acc };
    acc += length;
    return arc;
  });

  return (
    <div className="ops-donut">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Bottle flow: ${donut.delivered} delivered, ${donut.returned} returned, ${donut.inField} in field`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(173,232,236,.14)" strokeWidth={stroke} />
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {arcs.map((seg) => (
            <circle
              key={seg.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={`${seg.length} ${seg.gap}`}
              strokeDashoffset={seg.offset}
              style={{ transition: 'stroke-dasharray 700ms ease, stroke-dashoffset 700ms ease' }}
            />
          ))}
        </g>
        <text className="ops-donut__total" x={cx} y={cy - 1} textAnchor="middle">{total}</text>
        <text className="ops-donut__unit" x={cx} y={cy + 13} textAnchor="middle">moves</text>
      </svg>
      <ul className="ops-donut__legend">
        {segments.map((seg) => (
          <li key={seg.label}>
            <i style={{ background: seg.color }} />
            <span>{seg.label}</span>
            <strong>{seg.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrendArea({ data }) {
  const width = 300;
  const height = 104;
  const padX = 4;
  const padY = 12;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const stepX = (width - padX * 2) / (data.length - 1);
  const pts = data.map((v, i) => [padX + i * stepX, padY + (1 - (v - min) / span) * (height - padY * 2)]);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${height} L${pts[0][0].toFixed(1)} ${height} Z`;
  return (
    <svg className="ops-trend__svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Live orders trend over the last twelve intervals">
      <defs>
        <linearGradient id="ops-trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#29c9e8" stopOpacity=".32" />
          <stop offset="1" stopColor="#29c9e8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g stroke="rgba(173,232,236,.09)">
        <line x1="0" y1="34" x2={width} y2="34" />
        <line x1="0" y1="68" x2={width} y2="68" />
      </g>
      <path className="ops-trend__area" d={area} fill="url(#ops-trend-fill)" />
      <path className="ops-trend__line" d={line} fill="none" stroke="#59e6cf" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle className="ops-trend__dot" cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill="#c8fff1" />
    </svg>
  );
}

/* ---------- section ---------- */

function OperationsShowcase() {
  const reduceMotion = useReducedMotion();
  const { live, boardRef } = useLiveOperations(reduceMotion);
  const maxBar = Math.max(...live.bars);

  // "Updated Ns ago" ticker: resets to 0 whenever the live data ticks, then
  // counts up each second, so the ribbon reads as a genuine live feed.
  const [sinceSync, setSinceSync] = useState(0);
  useEffect(() => { setSinceSync(0); }, [live]);
  useEffect(() => {
    if (reduceMotion) return undefined;
    const id = window.setInterval(() => setSinceSync((s) => Math.min(s + 1, 59)), 1000);
    return () => window.clearInterval(id);
  }, [reduceMotion]);
  const syncLabel = sinceSync === 0 ? 'just now' : `${sinceSync}s ago`;

  return (
    <section className="ops-showcase" aria-labelledby="ops-title">
      <h2 id="ops-title" className="sr-only">Live operations dashboard</h2>
      {/* Decorative vector artifacts: contour waves, a dot field and drifting
          rings that sit behind the board on the dark gradient. */}
      <div className="ops-artifacts" aria-hidden="true">
        <svg className="ops-artifacts__waves" viewBox="0 0 1440 420" preserveAspectRatio="none" focusable="false">
          <path d="M-20 122C180 74 330 168 520 132S862 66 1060 108s282 6 420-34" fill="none" vectorEffect="non-scaling-stroke" />
          <path d="M-20 186C190 138 336 228 528 190s344-62 542-20 286 6 424-34" fill="none" vectorEffect="non-scaling-stroke" />
          <path d="M-20 252C200 204 342 292 536 254s348-58 546-16 288 4 426-36" fill="none" vectorEffect="non-scaling-stroke" />
          <path d="M-20 318C210 270 348 356 544 318s352-54 550-12 290 2 428-38" fill="none" vectorEffect="non-scaling-stroke" />
        </svg>

        <svg className="ops-artifacts__rings" viewBox="0 0 320 320" focusable="false">
          <circle cx="160" cy="160" r="52" fill="none" vectorEffect="non-scaling-stroke" />
          <circle cx="160" cy="160" r="86" fill="none" vectorEffect="non-scaling-stroke" />
          <circle cx="160" cy="160" r="122" fill="none" strokeDasharray="7 11" vectorEffect="non-scaling-stroke" />
          <circle cx="160" cy="160" r="152" fill="none" strokeDasharray="3 15" vectorEffect="non-scaling-stroke" />
        </svg>

        <svg className="ops-artifacts__drop" viewBox="0 0 120 150" focusable="false">
          <path d="M60 6c26 40 44 64 44 88a44 44 0 1 1-88 0c0-24 18-48 44-88Z" fill="none" vectorEffect="non-scaling-stroke" />
          <path d="M60 44c15 24 25 38 25 52a25 25 0 1 1-50 0c0-14 10-28 25-52Z" fill="none" vectorEffect="non-scaling-stroke" />
        </svg>

        <span className="ops-artifacts__dots" />
        <span className="ops-artifacts__orb ops-artifacts__orb--a" />
        <span className="ops-artifacts__orb ops-artifacts__orb--b" />
      </div>

      <motion.div
        className="ops-stage"
        initial={reduceMotion ? false : { opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.6, ease: enterEase }}
      >
      <div className="ops-board" ref={boardRef}>
        <div className="ops-board__stream" aria-hidden="true"><i /></div>
        <div className="ops-board__glow" aria-hidden="true"><i /><i /><i /></div>

        <div className="ops-ribbon">
          <span className="ops-ribbon__live"><i /> Live operations</span>
          <span className="ops-ribbon__sync">
            <span className="ops-ribbon__bar"><i /></span>
            Streaming delivery data
          </span>
          <span className="ops-ribbon__stamp">Updated <b>{syncLabel}</b></span>
        </div>

        <div className="ops-grid">
          <article className="ops-card ops-card--figure">
            <span className="ops-figure__halo" aria-hidden="true" />
            <img
              className="ops-figure__img"
              src={operationsIllustration}
              alt="Isometric illustration of a Himaliya delivery van loaded with 19 litre water gallons beside an operations dashboard"
              loading="lazy"
              width="1100"
              height="1100"
            />
            <span className="ops-figure__badge">
              <Truck size={13} />
              <span><strong>24</strong><small>routes today</small></span>
            </span>
          </article>

          <article className="ops-card ops-card--figure">
            <span className="ops-figure__halo" aria-hidden="true" />
            <img
              className="ops-figure__img"
              src={doorstepIllustration}
              alt="Isometric illustration of a rider handing a 19 litre water gallon to a customer at their doorstep"
              loading="lazy"
              width="1100"
              height="1100"
            />
            <span className="ops-figure__badge">
              <CheckCheck size={13} />
              <span><strong>{live.deliveries}</strong><small>delivered today</small></span>
            </span>
          </article>

          <article className="ops-card ops-card--trend">
            <header className="ops-card__head ops-card__head--between">
              <div className="ops-card__headline">
                <small>Live orders</small>
                <strong>{live.ordersPerMin}/min</strong>
              </div>
              <span className="ops-card__delta"><TrendingUp size={12} /> +12.8%</span>
            </header>
            <div className="ops-trend">
              <TrendArea data={live.trend} />
            </div>
          </article>

          <article className="ops-card ops-card--donut">
            <header className="ops-card__head">
              <span className="ops-card__icon"><Droplets size={14} /></span>
              <div><small>Bottle flow</small><strong>Today</strong></div>
            </header>
            <DonutChart donut={live.donut} />
          </article>

          <article className="ops-card ops-card--bars">
            <header className="ops-card__head">
              <span className="ops-card__icon"><Activity size={14} /></span>
              <div><small>Orders by area</small><strong>This week</strong></div>
            </header>
            <div className="ops-bars">
              {live.bars.map((value, index) => (
                <div className="ops-bars__col" key={areaLabels[index]}>
                  <div className="ops-bars__track">
                    <span
                      className="ops-bars__fill"
                      style={{ height: `${(value / maxBar) * 100}%` }}
                    />
                  </div>
                  <small>{areaLabels[index]}</small>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>

        <div className="ops-floats" aria-hidden="true">
          <span className="ops-float ops-float--feed">
            <span className="ops-eq"><i /><i /><i /><i /></span>
            <span className="ops-float__txt"><strong>Live feed</strong><small>active now</small></span>
          </span>
          <span className="ops-float ops-float--riders">
            <span className="ops-float__dots"><i /><i /><i /></span>
            <span className="ops-float__txt"><strong>{live.ordersPerMin} riders</strong><small>on route</small></span>
          </span>
        </div>
      </motion.div>
    </section>
  );
}

export default OperationsShowcase;
