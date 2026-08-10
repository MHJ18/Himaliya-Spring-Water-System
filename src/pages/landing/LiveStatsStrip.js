import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Clock3, Droplets, Package, Truck } from 'lucide-react';
import { useLiveOperations } from './useLiveOperations';
import { MiniRadial, Sparkline } from './liveCharts';

const enterEase = [0.22, 1, 0.36, 1];
const viewportOnce = { once: true, amount: 0.25 };

function LiveStatsStrip() {
  const reduceMotion = useReducedMotion();
  const { live, boardRef } = useLiveOperations(reduceMotion);
  const revenueText = `Rs ${(live.revenue / 1000).toFixed(1)}k`;

  const kpis = [
    { key: 'deliveries', label: 'Deliveries today', value: live.deliveries, icon: Truck, chart: <Sparkline data={live.spark} /> },
    { key: 'bottles', label: 'Bottles in field', value: live.bottles, icon: Droplets, chart: <Sparkline data={live.trend.slice(-8)} stroke="#69e7f7" /> },
    { key: 'revenue', label: 'Revenue today', value: revenueText, icon: Package, delta: '+9.4%' },
    { key: 'onTime', label: 'On-time rate', value: `${Math.round(live.onTime)}%`, icon: Clock3, radial: <MiniRadial value={live.onTime} /> },
  ];

  return (
    <motion.section
      className="landing-stats"
      ref={boardRef}
      aria-label="Live service statistics"
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewportOnce}
      transition={{ duration: 0.5, ease: enterEase }}
    >
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <article className="ops-kpi" key={kpi.key}>
            <div className="ops-kpi__top">
              <span className="ops-kpi__icon"><Icon size={15} /></span>
              <small>{kpi.label}</small>
            </div>
            <div className="ops-kpi__body">
              <strong>{kpi.value}</strong>
              {kpi.radial}
              {kpi.delta && <span className="ops-kpi__delta"><ArrowUpRight size={12} /> {kpi.delta}</span>}
            </div>
            {kpi.chart}
          </article>
        );
      })}
    </motion.section>
  );
}

export default LiveStatsStrip;
