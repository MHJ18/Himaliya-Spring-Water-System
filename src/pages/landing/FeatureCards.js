import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ChartNoAxesCombined,
  ClipboardPenLine,
  RefreshCw,
  UsersRound,
} from 'lucide-react';
import { useLiveOperations } from './useLiveOperations';

const enterEase = [0.22, 1, 0.36, 1];
const viewportOnce = { once: true, amount: 0.2 };

// Accents borrowed from the admin dashboard's own theme presets (sunset,
// indigo, ocean, emerald) so the marketing page and the product it's selling
// share one accent language instead of inventing a new palette.
const features = [
  {
    title: 'Daily sales entry',
    detail: 'Record deliveries and payments in seconds—built for drivers, not accountants.',
    icon: ClipboardPenLine,
    accent: '#ffc09d',
  },
  {
    title: 'Customer ledger',
    detail: 'Search by name or phone. See deposits and outstanding balances at a glance.',
    icon: UsersRound,
    accent: '#b6a9ff',
  },
  {
    title: '19L gallon tracking',
    detail: 'See full gallons sent, empties collected and containers still with customers.',
    icon: RefreshCw,
    accent: '#8ab9ff',
  },
  {
    title: 'Monthly analytics',
    detail: 'Revenue trends, bottle movement and active customers—export reports when needed.',
    icon: ChartNoAxesCombined,
    accent: '#7ae8c3',
  },
];

// Lives in its own component (like LiveStatsStrip and OperationsShowcase) so
// the 2.6s live tick re-renders only these cards, not the whole landing page
// with its WebGL hero.
function FeatureCards() {
  const reduceMotion = useReducedMotion();
  const { live, boardRef } = useLiveOperations(reduceMotion);

  // Pulled from the same simulated live feed the KPI strip uses, so these
  // figures tick in step with the cards at the top of the page.
  const stats = [
    { value: `Rs ${(live.revenue / 1000).toFixed(1)}k`, label: 'revenue recorded today' },
    { value: `${live.deliveries}`, label: 'sales logged today' },
    { value: `${live.bottles}`, label: 'bottles out in the field' },
    { value: `${Math.round(live.onTime)}%`, label: 'on-time delivery rate' },
  ];

  return (
    <section id="features" className="feature-section" aria-labelledby="features-title">
      <motion.div
        className="legacy-section-heading"
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.5, ease: enterEase }}
      >
        <span>Built for your business</span>
        <h2 id="features-title">Everything a water delivery team needs.</h2>
        <p>Not a generic CRM—a focused workspace for Himaliya Spring Water operations in Sialkot Cantt.</p>
      </motion.div>

      <div className="feature-grid" ref={boardRef}>
        {features.map(({
          icon: Icon, title, detail, accent,
        }, index) => {
          const stat = stats[index];
          return (
            <motion.article
              key={title}
              className="feature-card"
              style={{ '--feature-accent': accent }}
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewportOnce}
              transition={{ delay: index * 0.06, duration: 0.46, ease: enterEase }}
              whileHover={reduceMotion ? {} : { y: -7, transition: { duration: 0.2 } }}
            >
              <span className="feature-card__icon" aria-hidden="true"><Icon size={22} /></span>
              <h3>{title}</h3>
              <p>{detail}</p>
              <div className="feature-card__stat">
                <span className="feature-card__dot" aria-hidden="true" />
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

export default FeatureCards;
