import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useReducedMotion } from 'motion/react';
import useIsMobile from '../../hooks/useIsMobile';
import { useTheme } from '@mui/material/styles';

export default function DailySalesChart({ data }) {
  const mobile = useIsMobile();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  return (
    <ResponsiveContainer width="100%" height={mobile ? 220 : 280}>
      <LineChart data={data} margin={mobile ? { top: 8, right: 8, bottom: 0, left: -22 } : undefined}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v) => [`PKR ${v}`, 'Sales']} />
        <Line type="monotone" dataKey="sales" stroke={theme.palette.primary.main} strokeWidth={2} dot={mobile ? false : { r: 3 }} isAnimationActive={!reduceMotion} />
      </LineChart>
    </ResponsiveContainer>
  );
}
