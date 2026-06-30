import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { fadeUp, staggerContainer, easeOut } from '../../utils/motion';
import { useCountUp } from '../../hooks/useCountUp';
import './Landing.css';

function scrollToSection(id) {
  const section = document.getElementById(id);
  if (section) section.scrollIntoView({ block: 'start' });
}

const viewportOnce = { once: true, amount: 0.25 };

const deliverySteps = [
  {
    step: '01',
    title: 'Add the customer once',
    detail: 'Phone, address, bottle deposit - every home and office gets a proper account in under a minute.',
    tag: '2 min setup',
  },
  {
    step: '02',
    title: 'Log each delivery on the route',
    detail: 'Bottles out, empties in, cash collected. Your driver records it before moving to the next stop.',
    tag: 'Same-day entry',
  },
  {
    step: '03',
    title: 'Know who owes what - instantly',
    detail: 'Balances, purchase history, and monthly revenue update automatically. No more end-of-month surprises.',
    tag: 'Live ledger',
  },
];

const bentoFeatures = [
  {
    title: 'Daily Sales Entry',
    detail: 'Record deliveries and payments in seconds - built for drivers, not accountants.',
    icon: 'DS',
    metrics: ['Fast entry', 'Cash + credit'],
  },
  {
    title: 'Customer Ledger',
    detail: 'Search by name or phone. See deposits and outstanding balances at a glance.',
    icon: 'CL',
    metrics: ['Deposits', 'Balances'],
  },
  {
    title: '19L Gallon Tracking',
    detail: 'See full gallons sent, empties collected, and containers still with customers.',
    icon: '19L',
    metrics: ['Full out', 'Empty in', 'Due back'],
  },
  {
    title: 'Monthly Analytics',
    detail: 'Revenue trends, bottle movement, and active customers - export when you need reports.',
    icon: 'MA',
    metrics: ['Revenue', 'Bottle flow'],
  },
];

const headlineWords = ['Pure', 'water.', 'On-time', 'delivery.', 'Total', 'control.'];

const heroParticles = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  left: `${8 + ((index * 17) % 84)}%`,
  delay: `${(index % 6) * 0.55}s`,
  size: 4 + (index % 5),
}));

const heroFloatCards = [
  { label: 'Route status', value: 'Live', detail: '24 Sialkot routes', style: { top: '8%', right: '-2%' } },
  { label: '19L gallons', value: 'Pure', detail: 'Doorstep delivery', style: { bottom: '18%', left: '-4%' } },
  { label: 'Ledger sync', value: 'Instant', detail: 'Balances updated', style: { top: '42%', right: '-6%' } },
];

function HeroMockup() {
  const reduceMotion = useReducedMotion();
  const sceneRef = useRef(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [8, -8]), { stiffness: 120, damping: 18 });
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-10, 10]), { stiffness: 120, damping: 18 });
  const glowX = useSpring(useTransform(pointerX, [-0.5, 0.5], [-24, 24]), { stiffness: 90, damping: 20 });
  const glowY = useSpring(useTransform(pointerY, [-0.5, 0.5], [-18, 18]), { stiffness: 90, damping: 20 });

  const handlePointerMove = (event) => {
    if (reduceMotion || !sceneRef.current) return;
    const rect = sceneRef.current.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  const resetPointer = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <div className="hero-mockup" aria-hidden="true">
      <div className="hero-mockup-glow" />
      <div className="hero-mockup-orbit hero-mockup-orbit--a" />
      <div className="hero-mockup-orbit hero-mockup-orbit--b" />

      <motion.div
        ref={sceneRef}
        className="hero-scene-stage"
        onPointerMove={handlePointerMove}
        onPointerLeave={resetPointer}
        style={reduceMotion ? {} : { rotateX, rotateY, transformPerspective: 1200 }}
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.12, ease: easeOut }}
      >
        <motion.div className="hero-scene-aurora hero-scene-aurora--a" style={reduceMotion ? {} : { x: glowX, y: glowY }} />
        <motion.div className="hero-scene-aurora hero-scene-aurora--b" style={reduceMotion ? {} : { x: glowY, y: glowX }} />

        <div className="water-pour-scene water-pour-scene--premium">
          <div className="hero-scene-grid" />
          <div className="hero-scene-rays" />

          <div className="hero-particle-field">
            {heroParticles.map((particle) => (
              <span
                key={particle.id}
                className="hero-particle"
                style={{
                  left: particle.left,
                  width: particle.size,
                  height: particle.size,
                  animationDelay: particle.delay,
                }}
              />
            ))}
          </div>

          <div className="pour-bottle pour-bottle--premium">
            <div className="pour-bottle__halo" />
            <div className="pour-bottle__cap" />
            <div className="pour-bottle__neck" />
            <div className="pour-bottle__body">
              <div className="pour-bottle__shine" />
              <div className="pour-bottle__water" />
              <div className="pour-bottle__label">
                <strong>HIMALIYA</strong>
                <span>Spring Water</span>
                <small>19L</small>
              </div>
            </div>
          </div>

          <div className="pour-stream pour-stream--premium"><i /><i /><i /><i /></div>

          <div className="pour-glass pour-glass--premium">
            <div className="pour-glass__shine" />
            <div className="pour-glass__water"><span /></div>
          </div>

          <div className="pour-ripples pour-ripples--premium"><span /><span /><span /><span /></div>
          <div className="hero-wave-band"><span /><span /><span /></div>

          <div className="pour-copy pour-copy--premium">
            <span>Pure delivery motion</span>
            <strong>From source to glass, beautifully.</strong>
          </div>
        </div>

        {!reduceMotion && heroFloatCards.map((card) => (
          <motion.div
            key={card.label}
            className="hero-float-card"
            style={card.style}
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4 + heroFloatCards.indexOf(card), repeat: Infinity, ease: 'easeInOut' }}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function StatBar() {
  const customers = useCountUp(500, { delay: 100 });
  const routes = useCountUp(24, { delay: 200 });
  const bottles = useCountUp(19, { delay: 300 });

  return (
    <motion.section
      className="trust-bar"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewportOnce}
      transition={{ duration: 0.5 }}
    >
      <div className="trust-bar-inner" ref={customers.ref}>
        <strong>{customers.value}+</strong>
        <span>homes & offices served</span>
      </div>
      <div className="trust-bar-inner" ref={routes.ref}>
        <strong>{routes.value}</strong>
        <span>Sialkot Cantt routes daily</span>
      </div>
      <div className="trust-bar-inner" ref={bottles.ref}>
        <strong>{bottles.value}L</strong>
        <span>gallon delivery</span>
      </div>
      <div className="trust-bar-inner trust-bar-inner--accent">
        <strong>Same day</strong>
        <span>sales & balance updates</span>
      </div>
    </motion.section>
  );
}

function Landing() {
  const reduceMotion = useReducedMotion();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <main className="himalaya-landing">
      <div className="landing-bg" aria-hidden="true">
        <div className="landing-bg-blob landing-bg-blob--1" />
        <div className="landing-bg-blob landing-bg-blob--2" />
        <div className="landing-bg-blob landing-bg-blob--3" />
        <div className="landing-bg-grid" />
      </div>

      {mobileNavOpen && (
        <button type="button" className="landing-mobile-backdrop" aria-label="Close menu" onClick={closeMobileNav} />
      )}

      <motion.header
        className="landing-nav"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <Link className="landing-brand" to="/" onClick={closeMobileNav}>
          <span className="landing-brand-mark">HS</span>
          <span className="landing-brand-text">Himaliya Spring Water</span>
        </Link>

        <button
          type="button"
          className={`landing-menu-toggle${mobileNavOpen ? ' landing-menu-toggle--open' : ''}`}
          aria-expanded={mobileNavOpen}
          aria-controls="landing-mobile-nav"
          aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span className="landing-menu-toggle__ring" />
          <span className="landing-menu-toggle__bars">
            <span />
            <span />
          </span>
        </button>

        <nav className="landing-nav-actions landing-nav-actions--desktop" aria-label="Landing navigation">
          <button type="button" className="landing-text-link" onClick={() => scrollToSection('delivery')}>
            How it works
          </button>
          <button type="button" className="landing-text-link landing-text-link--desktop" onClick={() => scrollToSection('features')}>
            Features
          </button>
          <Link className="landing-nav-button" to="/customer/login">Order Water</Link>
          <Link className="landing-nav-button landing-nav-button--ghost" to="/login">Admin Sign In</Link>
        </nav>
      </motion.header>

      <nav
        id="landing-mobile-nav"
        className={`landing-mobile-sheet${mobileNavOpen ? ' landing-mobile-sheet--open' : ''}`}
        aria-label="Mobile navigation"
      >
        <div className="landing-mobile-sheet__header">
          <span>Menu</span>
          <button type="button" onClick={closeMobileNav} aria-label="Close menu">&times;</button>
        </div>
        <button type="button" className="landing-mobile-link" onClick={() => { scrollToSection('delivery'); closeMobileNav(); }}>
          <span>01</span>
          <div>
            <strong>How it works</strong>
            <small>Three-step delivery flow</small>
          </div>
        </button>
        <button type="button" className="landing-mobile-link" onClick={() => { scrollToSection('features'); closeMobileNav(); }}>
          <span>02</span>
          <div>
            <strong>Features</strong>
            <small>Built for water teams</small>
          </div>
        </button>
        <Link className="landing-nav-button landing-nav-button--mobile" to="/customer/login" onClick={closeMobileNav}>
          Customer Sign In
        </Link>
        <Link className="landing-nav-button landing-nav-button--mobile landing-nav-button--ghost" to="/login" onClick={closeMobileNav}>
          Admin Sign In
        </Link>
      </nav>

      <section className="landing-hero">
        <div className="hero-copy">
          <motion.span
            className="hero-kicker"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <span className="hero-kicker-pulse" />
            Sialkot Cantt bottled water &middot; Customer orders & admin system
          </motion.span>

          <h1 className="hero-headline">
            {headlineWords.map((word, i) => (
              <React.Fragment key={word}>
                <motion.span
                  className="hero-headline-word"
                  initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ delay: 0.08 + i * 0.07, duration: 0.55, ease: easeOut }}
                >
                  {word}
                </motion.span>
                {i < headlineWords.length - 1 ? ' ' : null}
              </React.Fragment>
            ))}
          </h1>

          <motion.p
            className="hero-subtext"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.5 }}
          >
            Stop chasing paper registers and WhatsApp lists. Himaliya Spring Water gives your team
            one place to track customers, bottle deposits, daily sales, and monthly performance.
          </motion.p>

          <motion.ul
            className="hero-highlights"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {['19L gallon routes', 'Deposit tracking', 'Daily sales entry', 'Live balances'].map((item) => (
              <motion.li key={item} variants={fadeUp}>{item}</motion.li>
            ))}
          </motion.ul>

          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.45 }}
          >
            <Link className="hero-primary" to="/login">
              Start managing routes
              <span className="hero-primary-arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <button type="button" className="hero-secondary" onClick={() => scrollToSection('delivery')}>
              See how it works
            </button>
          </motion.div>
        </div>

        <div className="hero-visual-wrap">
          <HeroMockup />
        </div>
      </section>

      <StatBar />

      <section id="delivery" className="scroll-story">
        <motion.div
          className="section-heading section-heading--center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
        >
          <span>How it works</span>
          <h2>From doorstep to dashboard in three steps.</h2>
          <p className="section-lead">
            Built for how water delivery teams actually work - fast entries, clear accounts, no clutter.
          </p>
        </motion.div>

        <ol className="story-timeline">
          {deliverySteps.map((panel, index) => (
            <motion.li
              key={panel.step}
              initial={{ opacity: 0, x: index % 2 === 0 ? -24 : 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={viewportOnce}
              transition={{ delay: index * 0.1, duration: 0.5, ease: easeOut }}
            >
              <div className="story-timeline-rail">
                <span className="story-timeline-dot" />
                {index < deliverySteps.length - 1 && <span className="story-timeline-line" />}
              </div>
              <motion.article
                className="story-panel"
                whileHover={reduceMotion ? {} : { y: -6, transition: { duration: 0.2 } }}
              >
                <div className="story-panel-top">
                  <span className="story-step">{panel.step}</span>
                  <span className="story-tag">{panel.tag}</span>
                </div>
                <h2>{panel.title}</h2>
                <p>{panel.detail}</p>
              </motion.article>
            </motion.li>
          ))}
        </ol>
      </section>

      <section id="features" className="operations-section">
        <motion.div
          className="section-heading"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
        >
          <span>Built for your business</span>
          <h2>Everything a water delivery team needs.</h2>
          <p className="section-lead">
            Not a generic CRM - a focused workspace for Himaliya Spring Water operations in Sialkot Cantt.
          </p>
        </motion.div>

        <div className="bento-grid">
          {bentoFeatures.map((card, index) => (
            <motion.article
              key={card.title}
              className="bento-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewportOnce}
              transition={{ delay: index * 0.08, duration: 0.45, ease: easeOut }}
              whileHover={reduceMotion ? {} : { y: -8, transition: { duration: 0.22 } }}
            >
              <div className="bento-card-glow" />
              <div className="operation-icon" aria-hidden="true">{card.icon}</div>
              <h3>{card.title}</h3>
              <p>{card.detail}</p>
              <div className="bento-card-metrics">{card.metrics.map((metric) => <span key={metric}>{metric}</span>)}</div>
            </motion.article>
          ))}
        </div>
      </section>

      <motion.section
        className="landing-cta"
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={viewportOnce}
        transition={{ duration: 0.5 }}
      >
        <div className="landing-cta-border" aria-hidden="true" />
        <div>
          <span>Ready when you are</span>
          <h2>Order water or manage today&apos;s route with confidence.</h2>
          <p>Customers can place 19L gallon orders, while admins track delivery requests, sales, and balances.</p>
        </div>
        <motion.div whileHover={reduceMotion ? {} : { scale: 1.03 }} whileTap={{ scale: 0.98 }}>
          <Link className="hero-primary hero-primary--large" to="/customer/login">
            Place a water order
          </Link>
        </motion.div>
      </motion.section>

      <footer className="landing-footer">
        <span>&copy; {new Date().getFullYear()} Himaliya Spring Water &middot; Sialkot Cantt</span>
        <Link to="/login">Admin sign in</Link>
      </footer>
    </main>
  );
}

export default Landing;
