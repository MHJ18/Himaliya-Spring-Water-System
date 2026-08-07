import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useReducedMotion } from 'motion/react';
import useIsMobile from '../../hooks/useIsMobile';
import { useTheme } from '@mui/material/styles';

export default function MonthlyRevenueChart({ data }) {
  const mobile = useIsMobile();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  return (
    <ResponsiveContainer width="100%" height={mobile ? 220 : 280}>
      <BarChart data={data} margin={mobile ? { top: 8, right: 4, bottom: 0, left: -22 } : undefined}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v) => [`PKR ${v}`, 'Revenue']} />
        <Bar dataKey="revenue" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} isAnimationActive={!reduceMotion} />
      </BarChart>
    </ResponsiveContainer>
  );
}
