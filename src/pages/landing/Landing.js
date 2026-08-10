import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
} from 'motion/react';
import {
  ArrowRight,
  Check,
  Droplets,
  LogIn,
  Menu,
  Play,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import BottleFillFilm from './BottleFillFilm';
import FeatureCards from './FeatureCards';
import ConnectedCore from './ConnectedCore';
import OperationsShowcase from './OperationsShowcase';
import LiveStatsStrip from './LiveStatsStrip';
import './Landing.css';

const fluidSimulationModule = import('../../components/fluid/FluidSimulation');
const FluidSimulation = React.lazy(() => fluidSimulationModule);
const enterEase = [0.22, 1, 0.36, 1];
const viewportOnce = { once: true, amount: 0.25 };

function Landing() {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smoothScrollProgress = useSpring(scrollYProgress, {
    stiffness: 105,
    damping: 26,
    mass: 0.24,
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [filmPlaying, setFilmPlaying] = useState(false);
  const [filmKey, setFilmKey] = useState(0);
  const heroRef = useRef(null);
  const filmRef = useRef(null);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [mobileNavOpen]);

  useEffect(() => {
    if (reduceMotion || !filmRef.current || !('IntersectionObserver' in window)) {
      setFilmPlaying(true);
      return undefined;
    }

    let hasStarted = false;
    const observer = new window.IntersectionObserver(([entry]) => {
      setFilmPlaying(entry.isIntersecting);
      if (entry.isIntersecting && !hasStarted) {
        hasStarted = true;
        setFilmKey((key) => key + 1);
      }
    }, { threshold: 0.24 });
    observer.observe(filmRef.current);
    return () => observer.disconnect();
  }, [reduceMotion]);

  const replayFilm = () => {
    setFilmPlaying(true);
    setFilmKey((key) => key + 1);
  };

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <main className={`himalaya-landing${reduceMotion ? ' reduce-motion' : ''}`}>
      <a className="landing-skip-link" href="#landing-content">Skip to content</a>
      <motion.div
        className="landing-water-progress"
        style={{ scaleX: smoothScrollProgress }}
        aria-hidden="true"
      />

      <header className="landing-nav">
        <Link className="landing-brand" to="/" aria-label="Himaliya Spring Water home">
          <span className="landing-brand-mark" aria-hidden="true"><Droplets size={20} /></span>
          <span className="landing-brand-text"><strong>Himaliya</strong><small>Spring Water</small></span>
        </Link>

        <nav className="landing-nav-actions" aria-label="Primary navigation">
          <Link className="landing-nav-link" to="/login">Admin</Link>
          <Link className="landing-nav-link landing-nav-link--primary" to="/customer/login">
            Order water <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </nav>

        <button
          type="button"
          className="landing-menu-toggle"
          aria-expanded={mobileNavOpen}
          aria-controls="landing-mobile-menu"
          aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileNavOpen((isOpen) => !isOpen)}
        >
          {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <nav
          id="landing-mobile-menu"
          className={`landing-mobile-menu${mobileNavOpen ? ' is-open' : ''}`}
          aria-label="Mobile navigation"
        >
          <Link to="/customer/login" onClick={closeMobileNav}>
            <LogIn size={18} aria-hidden="true" />
            <span><strong>Order water</strong><small>Customer sign in</small></span>
          </Link>
          <Link to="/login" onClick={closeMobileNav}>
            <ShieldCheck size={18} aria-hidden="true" />
            <span><strong>Admin sign in</strong><small>Operations dashboard</small></span>
          </Link>
        </nav>
      </header>

      <section id="landing-content" ref={heroRef} className="landing-hero" aria-labelledby="landing-hero-title">
        <div className="landing-hero__field" aria-hidden="true">
          <React.Suspense fallback={null}>
            <FluidSimulation
              active
              autonomous
              eager
              mode="hero"
              reduceMotion={reduceMotion}
            />
          </React.Suspense>
        </div>
        <div className="landing-hero__grid" aria-hidden="true" />

        <motion.div
          className="landing-hero__copy"
          initial={reduceMotion ? false : { opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.72, ease: enterEase }}
        >
          <span className="landing-eyebrow">Himaliya Spring Water · Sialkot Cantt</span>
          <h1 id="landing-hero-title">
            Water that <span className="landing-water-word" aria-label="moves">
              <span className="landing-water-word__outline" aria-hidden="true">moves</span>
              <span className="landing-water-word__fill" aria-hidden="true">moves</span>
              <span className="landing-water-word__ripple" aria-hidden="true">moves</span>
            </span>
            <span className="landing-hero__title-line">with your day.</span>
          </h1>
          <p>19L refill delivery for homes and offices—with every order, bottle and balance kept clear.</p>
          <div className="landing-hero__actions">
            <Link className="landing-primary-action" to="/customer/login">
              Order 19L water <span><ArrowRight size={18} aria-hidden="true" /></span>
            </Link>
            <a className="landing-secondary-action" href="#refill-film">
              <Play size={15} fill="currentColor" aria-hidden="true" />
              Watch the fill
            </a>
          </div>
        </motion.div>

        <motion.div
          className="landing-hero__index"
          aria-hidden="true"
          initial={reduceMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.58, delay: 0.22, ease: enterEase }}
        >
          <span>Live water field</span>
          <i />
          <small>Spring ripples, running on their own</small>
        </motion.div>
        <a className="landing-scroll-cue" href="#refill-film"><span>See the 19L refill</span><i aria-hidden="true" /></a>
      </section>

      <section id="refill-film" ref={filmRef} className="refill-film-section" aria-labelledby="refill-film-title">
        <div className="refill-film-section__heading">
          <span className="landing-eyebrow">The 19L refill</span>
          <h2 id="refill-film-title">One bottle.<br />One complete fill.</h2>
          <p>The only product film on the page: a cinematic 19L sequence from empty jug to ready delivery.</p>
        </div>

        <div className="refill-film-layout">
          <div className="product-film-frame">
            <div className="product-film-frame__topline">
              <span>HSW / 19L / FILL SEQUENCE</span>
              <button type="button" onClick={replayFilm} aria-label="Replay 19L bottle filling animation">
                <RefreshCw size={15} aria-hidden="true" /> Replay film
              </button>
            </div>
            <BottleFillFilm playing={filmPlaying} replayKey={filmKey} />
          </div>

          <motion.div
            className="refill-film-copy"
            initial={reduceMotion ? false : { opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.52, ease: enterEase }}
          >
            <span className="refill-film-copy__volume">19L</span>
            <span className="landing-eyebrow">Home + office refill</span>
            <h3>Refill-sized water without rebuilding the order.</h3>
            <p>Choose the quantity, delivery address and preferred date. Your account keeps each request, invoice and practical bottle note in one place.</p>
            <ul>
              {['Active catalog pricing', 'Bottle-return notes', 'Traceable order history'].map((point) => (
                <li key={point}><Check size={16} aria-hidden="true" />{point}</li>
              ))}
            </ul>
            <Link className="landing-primary-action landing-primary-action--dark" to="/customer/login">
              Start a 19L order <span><ArrowRight size={18} aria-hidden="true" /></span>
            </Link>
          </motion.div>
        </div>
      </section>

      <div className="pre-webgl-shell">
        <div className="pre-webgl-shell__atmosphere" aria-hidden="true">
          <i /><i /><i />
        </div>

        <div className="pre-webgl-shell__illustration" aria-hidden="true">
          <svg viewBox="0 0 1440 720" fill="none" focusable="false">
            <circle className="pre-webgl-shell__sun" cx="1174" cy="112" r="68" />

            <path
              className="pre-webgl-shell__ridge pre-webgl-shell__ridge--back"
              d="M-48 354 132 226l112 80 138-168 154 170 150-92 144 112 180-168 156 148 126-92 196 144"
              vectorEffect="non-scaling-stroke"
            />
            <path
              className="pre-webgl-shell__ridge"
              d="M-52 422 168 284l120 82 162-148 172 164 154-108 140 118 194-162 174 138 142-82 172 112"
              vectorEffect="non-scaling-stroke"
            />

            <path
              className="pre-webgl-shell__snow"
              d="m338 192 44-54 42 51-21-12-20 21-18-21-17 13-10 2Zm724 14 48-46 43 41-20-8-18 18-17-18-19 10-17 3Z"
              vectorEffect="non-scaling-stroke"
            />
            <path
              className="pre-webgl-shell__spring"
              d="M450 218c-28 76 74 93 18 157-38 43-17 87 54 106 84 23 99 79 30 129"
              vectorEffect="non-scaling-stroke"
            />

            <g className="pre-webgl-shell__water-lines">
              <path d="M-34 462c170-42 292 43 458 8 159-34 294-25 452 15 174 44 322-45 598-5" vectorEffect="non-scaling-stroke" />
              <path d="M-42 505c164-39 302 41 466 9 166-33 304-20 466 18 162 38 323-45 594-8" vectorEffect="non-scaling-stroke" />
              <path d="M-28 550c186-36 312 39 478 6 159-31 300-12 458 21 166 35 319-40 560-10" vectorEffect="non-scaling-stroke" />
              <path d="M-48 598c183-33 315 34 490 4 166-29 311-4 464 24 173 31 318-35 570-5" vectorEffect="non-scaling-stroke" />
              <path d="M-24 650c184-29 326 28 494 0 165-27 300 1 456 27 173 29 324-28 554-3" vectorEffect="non-scaling-stroke" />
            </g>
          </svg>
        </div>

        <LiveStatsStrip />

        <FeatureCards />

        <ConnectedCore />

        <OperationsShowcase />

        <motion.section
          className="landing-cta"
          aria-labelledby="landing-cta-title"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: enterEase }}
        >
          <div className="landing-cta__bubbles" aria-hidden="true">
            <i /><i /><i /><i /><i /><i />
          </div>
          <div>
            <span>Ready when you are</span>
            <h2 id="landing-cta-title">Order water or manage today&apos;s route with confidence.</h2>
            <p>Customers place 19L refill orders while the team tracks requests, sales, bottles and balances.</p>
          </div>
          <div className="landing-cta__actions">
            <Link className="landing-primary-action" to="/customer/login">
              Place a water order <span><ArrowRight size={18} aria-hidden="true" /></span>
            </Link>
            <Link className="landing-secondary-action landing-secondary-action--dark" to="/login">
              Admin sign in
            </Link>
          </div>
        </motion.section>

        <footer className="landing-footer">
          <span>&copy; {new Date().getFullYear()} Himaliya Spring Water · Sialkot Cantt</span>
          <div><Link to="/customer/login">Order 19L water</Link><Link to="/login">Admin sign in</Link></div>
        </footer>
      </div>
    </main>
  );
}

export default Landing;
