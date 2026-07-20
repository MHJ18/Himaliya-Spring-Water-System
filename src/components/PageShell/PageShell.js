import React from 'react';
import PropTypes from 'prop-types';
import { motion, useReducedMotion } from 'framer-motion';
import { Box, Typography } from '@mui/material';
import { fadeUp } from '../../utils/motion';

export default function PageShell({
  title, subtitle, actions, children,
}) {
  const reduceMotion = useReducedMotion();
  const itemVariants = reduceMotion ? { hidden: {}, visible: {} } : fadeUp;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.045 } },
      }}
    >
      <Box
        component={motion.header}
        variants={itemVariants}
        custom={0}
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'flex-end' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1.5,
          mb: { xs: 2, md: 3 },
        }}
      >
        <Box>
          <Typography component="h1" variant="h1" color="text.primary">{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            {actions}
          </Box>
        )}
      </Box>
      <motion.div variants={itemVariants} custom={1} style={{ minWidth: 0 }}>
        {children}
      </motion.div>
    </motion.div>
  );
}

PageShell.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  actions: PropTypes.node,
  children: PropTypes.node.isRequired,
};

PageShell.defaultProps = {
  subtitle: null,
  actions: null,
};
