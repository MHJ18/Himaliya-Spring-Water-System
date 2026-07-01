import React from 'react';
import PropTypes from 'prop-types';
import Lottie from 'lottie-react';
import { CheckCircle2, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import './DeliveryCelebration.css';

export default function DeliveryCelebration({ animationPath, title, message, onClose }) {
  const [animationData, setAnimationData] = React.useState(null);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    let active = true;
    fetch(animationPath)
      .then((response) => {
        if (!response.ok) throw new Error('Animation could not be loaded.');
        return response.json();
      })
      .then((data) => { if (active) setAnimationData(data); })
      .catch(() => {});
    return () => { active = false; };
  }, [animationPath]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(onClose, reduceMotion ? 2000 : 3000);
    return () => window.clearTimeout(timeoutId);
  }, [onClose, reduceMotion]);

  return (
    <motion.div
      className="delivery-celebration"
      role="status"
      aria-live="polite"
      initial={reduceMotion
        ? { opacity: 0, x: '-50%', y: '-50%' }
        : { opacity: 0, scale: 0.96, x: '-50%', y: '-50%' }}
      animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
    >
      <button type="button" className="delivery-celebration__close" onClick={onClose} aria-label="Close delivery confirmation"><X size={18} /></button>
      <div className="delivery-celebration__visual" aria-hidden="true">
        {!reduceMotion && animationData ? <Lottie animationData={animationData} loop={false} autoplay /> : <CheckCircle2 size={74} />}
      </div>
      <h2>{title}</h2>
      <p>{message}</p>
    </motion.div>
  );
}

DeliveryCelebration.propTypes = {
  animationPath: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};
