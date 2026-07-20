import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import useIsMobile from '../../hooks/useIsMobile';

const COLORS = ['#2477ff', '#60b5f8', '#1d62d5', '#93d1fc'];

export default function BottlePieChart({ data }) {
  const mobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  if (!data?.length) {
    return <p style={{ padding: '2.5rem 1rem', margin: 0, color: 'var(--hs-page-muted)', textAlign: 'center' }}>No sales data yet</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={mobile ? 230 : 280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={mobile ? 68 : 90} label={!mobile} isAnimationActive={!reduceMotion}>
          {data.map((entry, i) => <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
