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
  ChartNoAxesCombined,
  Check,
  ClipboardPenLine,
  Droplets,
  LogIn,
  Menu,
  Play,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserRoundPlus,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import BottleFillFilm from './BottleFillFilm';
import './Landing.css';

const FluidSimulation = React.lazy(() => import('../../components/fluid/FluidSimulation'));
const enterEase = [0.22, 1, 0.36, 1];
const viewportOnce = { once: true, amount: 0.25 };

const deliverySteps = [
  {
    step: '01',
    title: 'Add the customer once',
    detail: 'Phone, address and bottle deposit—every home and office gets a proper account in under a minute.',
    tag: '2 min setup',
    icon: UserRoundPlus,
  },
  {
    step: '02',
    title: 'Log each delivery on the route',
    detail: 'Bottles out, empties in and cash collected. Your driver records it before moving to the next stop.',
    tag: 'Same-day entry',
    icon: Truck,
  },
  {
    step: '03',
    title: 'Know who owes what—instantly',
    detail: 'Balances, purchase history and monthly revenue update automatically. No end-of-month surprises.',
    tag: 'Live ledger',
    icon: WalletCards,
  },
];

const bentoFeatures = [
  {
    title: 'Daily sales entry',
    detail: 'Record deliveries and payments in seconds—built for drivers, not accountants.',
    icon: ClipboardPenLine,
    metrics: ['Fast entry', 'Cash + credit'],
    size: 'wide',
  },
  {
    title: 'Customer ledger',
    detail: 'Search by name or phone. See deposits and outstanding balances at a glance.',
    icon: UsersRound,
    metrics: ['Deposits', 'Balances'],
    size: 'standard',
  },
  {
    title: '19L gallon tracking',
    detail: 'See full gallons sent, empties collected and containers still with customers.',
    icon: RefreshCw,
    metrics: ['Full out', 'Empty in', 'Due back'],
    size: 'standard',
  },
  {
    title: 'Monthly analytics',
    detail: 'Revenue trends, bottle movement and active customers—export reports when needed.',
    icon: ChartNoAxesCombined,
    metrics: ['Revenue', 'Bottle flow'],
    size: 'wide',
  },
];

const stats = [
  ['500+', 'homes & offices served'],
  ['24', 'Sialkot Cantt routes daily'],
  ['19L', 'refill delivery'],
  ['Same day', 'sales & balance updates'],
];

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
          <a className="landing-nav-anchor" href="#refill-film">19L refill</a>
          <a className="landing-nav-anchor" href="#delivery">How it works</a>
          <a className="landing-nav-anchor" href="#features">Features</a>
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
          <a href="#refill-film" onClick={closeMobileNav}>
            <Droplets size={18} aria-hidden="true" />
            <span><strong>19L refill film</strong><small>Watch the bottle fill</small></span>
          </a>
          <a href="#delivery" onClick={closeMobileNav}>
            <Truck size={18} aria-hidden="true" />
            <span><strong>How it works</strong><small>Three delivery steps</small></span>
          </a>
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
              interactionRef={heroRef}
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
            Water that moves
            <span>with your day.</span>
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
          <small>Move your pointer through it</small>
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

        <motion.section
          className="landing-stats"
          aria-label="Service statistics"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: enterEase }}
        >
          {stats.map(([value, label], index) => (
            <div key={label} className={index === stats.length - 1 ? 'is-accent' : ''}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </motion.section>

        <section id="delivery" className="scroll-story" aria-labelledby="delivery-title">
          <motion.div
            className="legacy-section-heading legacy-section-heading--center"
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.5, ease: enterEase }}
          >
            <span>How it works</span>
            <h2 id="delivery-title">From doorstep to dashboard in three steps.</h2>
            <p>Built for how water delivery teams actually work—fast entries, clear accounts, no clutter.</p>
          </motion.div>

          <ol className="story-timeline">
            {deliverySteps.map(({ step, title, detail, tag, icon: Icon }, index) => (
              <motion.li
                key={step}
                initial={reduceMotion ? false : { opacity: 0, x: index % 2 === 0 ? -24 : 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={viewportOnce}
                transition={{ delay: index * 0.08, duration: 0.48, ease: enterEase }}
              >
                <div className="story-timeline-rail" aria-hidden="true">
                  <span className="story-timeline-dot">{step}</span>
                  {index < deliverySteps.length - 1 && <span className="story-timeline-line" />}
                </div>
                <motion.article
                  className="story-panel"
                  whileHover={reduceMotion ? {} : { y: -5, transition: { duration: 0.2 } }}
                >
                  <div className="story-panel__icon"><Icon size={22} aria-hidden="true" /></div>
                  <div className="story-panel__copy">
                    <span className="story-tag">{tag}</span>
                    <h3>{title}</h3>
                    <p>{detail}</p>
                  </div>
                  <span className="story-panel__arrow" aria-hidden="true"><ArrowRight size={18} /></span>
                </motion.article>
              </motion.li>
            ))}
          </ol>
        </section>

        <section id="features" className="operations-section" aria-labelledby="features-title">
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

          <div className="bento-grid">
            {bentoFeatures.map(({ icon: Icon, title, detail, metrics, size }, index) => (
              <motion.article
                key={title}
                className={`bento-card bento-card--${size}`}
                initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={viewportOnce}
                transition={{ delay: index * 0.06, duration: 0.46, ease: enterEase }}
                whileHover={reduceMotion ? {} : { y: -7, transition: { duration: 0.2 } }}
              >
                <div className="bento-card__topline">
                  <span className="operation-icon" aria-hidden="true"><Icon size={22} /></span>
                  <small>0{index + 1}</small>
                </div>
                <h3>{title}</h3>
                <p>{detail}</p>
                <div className="bento-card__visual" aria-hidden="true">
                  <i /><i /><i /><i />
                </div>
                <div className="bento-card__metrics">
                  {metrics.map((metric) => <span key={metric}>{metric}</span>)}
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <motion.section
          className="landing-cta"
          aria-labelledby="landing-cta-title"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: enterEase }}
        >
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
