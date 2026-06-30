import React from 'react';
import { motion } from 'framer-motion';
import { fadeUp } from '../../utils/motion';
import s from '../../pages/dashboard/Dashboard.module.scss';

export default function PageShell({ title, subtitle, children }) {
  return (
    <motion.div
      className={s.root}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.06 } },
      }}
    >
      <motion.h1 className="page-title" variants={fadeUp} custom={0}>
        {title}
        {subtitle && (
          <>
            {' '}
            <small><small>{subtitle}</small></small>
          </>
        )}
      </motion.h1>
      <motion.div variants={fadeUp} custom={1}>
        {children}
      </motion.div>
    </motion.div>
  );
}
