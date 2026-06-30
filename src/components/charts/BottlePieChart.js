import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#2477ff', '#60b5f8', '#1d62d5', '#93d1fc'];

export default function BottlePieChart({ data }) {
  if (!data?.length) {
    return <p className="text-center text-muted py-5">No sales data yet</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
          {data.map((entry, i) => <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
