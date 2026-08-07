import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useReducedMotion } from 'motion/react';
import useIsMobile from '../../hooks/useIsMobile';
import { alpha, useTheme } from '@mui/material/styles';

export default function CustomerGrowthChart({ data }) {
  const mobile = useIsMobile();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  if (!data?.length) {
    return <p style={{ padding: '2.5rem 1rem', margin: 0, color: 'var(--hs-page-muted)', textAlign: 'center' }}>Add customers to see growth</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={mobile ? 220 : 280}>
      <AreaChart data={data} margin={mobile ? { top: 8, right: 8, bottom: 0, left: -22 } : undefined}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="customers"
          stroke={theme.palette.primary.main}
          fill={alpha(theme.palette.primary.main, 0.34)}
          fillOpacity={1}
          isAnimationActive={!reduceMotion}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
