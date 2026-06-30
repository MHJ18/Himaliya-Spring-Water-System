import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function CustomerGrowthChart({ data }) {
  if (!data?.length) {
    return <p className="text-center text-muted py-5">Add customers to see growth</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Area type="monotone" dataKey="customers" stroke="#2477ff" fill="#93d1fc" fillOpacity={0.4} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
