import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Droplets, Gauge, MousePointer2 } from 'lucide-react';
import FluidSimulation from '../../components/fluid/FluidSimulation';
import './FluidLab.css';

const modes = [
  { id: 'hero', label: 'Balanced water' },
  { id: 'refill', label: '19L refill' },
  { id: 'retail', label: 'Small bottles' },
];

export default function FluidLab() {
  const labRef = React.useRef(null);
  const [mode, setMode] = React.useState('hero');

  return (
    <main className="fluid-lab" ref={labRef}>
      <FluidSimulation interactionRef={labRef} mode={mode} />
      <header className="fluid-lab__header">
        <Link className="fluid-lab__back" to="/">
          <ArrowLeft size={18} aria-hidden="true" />
          Back to landing page
        </Link>
        <span className="fluid-lab__status">Isolated WebGL prototype</span>
      </header>

      <section className="fluid-lab__content" aria-labelledby="fluid-lab-title">
        <span className="fluid-lab__eyebrow">Himaliya fluid laboratory</span>
        <h1 id="fluid-lab-title">Water you can move.</h1>
        <p>
          Move your pointer across the field or drag on touch. The canvas injects velocity and dye
          into a pressure-projected fluid simulation, then pauses when this page is hidden.
        </p>

        <div className="fluid-lab__controls" aria-label="Fluid behavior">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={mode === item.id ? 'is-active' : ''}
              aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <ul className="fluid-lab__notes" aria-label="Simulation characteristics">
          <li><MousePointer2 size={18} aria-hidden="true" /> Pointer and touch splats</li>
          <li><Droplets size={18} aria-hidden="true" /> Velocity, pressure and dye fields</li>
          <li><Gauge size={18} aria-hidden="true" /> Device-tiered resolution and frame rate</li>
        </ul>
      </section>

      <p className="fluid-lab__fallback-note">
        Reduced-motion and unsupported devices receive the static water artwork automatically.
      </p>
    </main>
  );
}
