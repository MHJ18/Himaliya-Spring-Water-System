import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ChartNoAxesCombined,
  ClipboardPenLine,
  Droplets,
  LayoutDashboard,
  Truck,
  UsersRound,
} from 'lucide-react';

const enterEase = [0.22, 1, 0.36, 1];
const viewportOnce = { once: true, amount: 0.3 };

// Six surfaces orbit the core. Each gets an index; the CSS derives its start
// angle (index * 60deg) and animation phase from --i, so the nodes revolve
// evenly spaced and one at a time dips toward the centre.
const surfaces = [
  { label: 'Dashboard', icon: LayoutDashboard, accent: '#8ab9ff' },
  { label: 'Daily sales', icon: ClipboardPenLine, accent: '#ffc09d' },
  { label: 'Analytics', icon: ChartNoAxesCombined, accent: '#7ae8c3' },
  { label: 'Rider tracking', icon: Truck, accent: '#79e2ff' },
  { label: 'Gallon flow', icon: Droplets, accent: '#69e7f7' },
  { label: 'Customers', icon: UsersRound, accent: '#b6a9ff' },
];

function ConnectedCore() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="core-orbit" aria-labelledby="core-orbit-title">
      <motion.div
        className="legacy-section-heading legacy-section-heading--center"
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.5, ease: enterEase }}
      >
        <span>One connected system</span>
        <h2 id="core-orbit-title">One core. Every part of the round connected.</h2>
        <p>Sales, customers, gallons and riders all orbit a single Himaliya operations core—one record, updated everywhere at once.</p>
      </motion.div>

      <motion.div
        className="core-orbit__stage"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={viewportOnce}
        transition={{ duration: 0.6, ease: enterEase }}
      >
        <div className="core-orbit__field" aria-hidden="true">
          <span className="core-orbit__ring core-orbit__ring--1" />
          <span className="core-orbit__ring core-orbit__ring--2" />
          <span className="core-orbit__ring core-orbit__ring--3" />
          <span className="core-orbit__sweep" />
        </div>

        <div className="core-orbit__center">
          <span className="core-orbit__center-glow" aria-hidden="true" />
          <strong>Himaliya</strong>
          <small>Operations core</small>
        </div>

        {surfaces.map(({ label, icon: Icon, accent }, index) => (
          <div key={label} className="core-orbit__orbiter" style={{ '--i': index }}>
            <div className="core-orbit__reach">
              <span className="core-orbit__node" style={{ '--node-accent': accent }}>
                <i aria-hidden="true"><Icon size={15} /></i>
                <b>{label}</b>
              </span>
            </div>
          </div>
        ))}
      </motion.div>
    </section>
  );
}

export default ConnectedCore;
