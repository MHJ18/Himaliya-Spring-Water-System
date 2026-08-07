import React from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { alpha, useTheme } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import { useReducedMotion } from 'motion/react';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
);

function currency(value) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function useChartOptions(stacked = false) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const muted = theme.palette.text.secondary;
  const grid = alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.1 : 0.07);

  return React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: reduceMotion ? false : {
      duration: 520,
      easing: 'easeOutQuart',
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          color: muted,
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          font: { size: 11, weight: 700 },
        },
      },
      tooltip: {
        backgroundColor: theme.palette.mode === 'dark' ? '#071520' : '#10253a',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 11,
        cornerRadius: 10,
        callbacks: {
          label: (context) => `${context.dataset.label}: ${currency(context.parsed.y)}`,
        },
      },
    },
    scales: {
      x: {
        stacked,
        border: { display: false },
        grid: { display: false },
        ticks: {
          color: muted,
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 7,
          font: { size: 10, weight: 650 },
        },
      },
      y: {
        stacked,
        beginAtZero: true,
        border: { display: false },
        grid: { color: grid, drawTicks: false },
        ticks: {
          color: muted,
          padding: 8,
          callback: (value) => {
            const amount = Number(value) || 0;
            return amount >= 1000 ? `PKR ${Math.round(amount / 1000)}k` : `PKR ${amount}`;
          },
          font: { size: 10, weight: 650 },
        },
      },
    },
  }), [grid, muted, reduceMotion, stacked, theme.palette.mode]);
}

function ChartFrame({ label, summary, children }) {
  return (
    <Box
      role="img"
      aria-label={label}
      sx={{ position: 'relative', width: '100%', height: { xs: 245, md: 300 } }}
    >
      {children}
      <Typography
        component="span"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          p: 0,
          m: -1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {summary}
      </Typography>
    </Box>
  );
}

export function DailySalesTrendChart({ data = [] }) {
  const theme = useTheme();
  const options = useChartOptions(false);
  const primary = theme.palette.primary.main;
  const chartData = React.useMemo(() => ({
    labels: data.map((item) => item.name),
    datasets: [
      {
        label: 'Sales',
        data: data.map((item) => item.sales),
        borderColor: primary,
        backgroundColor: alpha(primary, theme.palette.mode === 'dark' ? 0.2 : 0.12),
        pointBackgroundColor: primary,
        pointBorderColor: theme.palette.background.paper,
        pointHoverRadius: 5,
        pointRadius: data.length > 10 ? 2 : 3,
        borderWidth: 2.5,
        tension: 0.38,
        fill: true,
      },
    ],
  }), [data, primary, theme.palette.background.paper, theme.palette.mode]);
  const total = data.reduce((sum, item) => sum + (Number(item.sales) || 0), 0);

  return (
    <ChartFrame
      label="Daily sales trend for the last fourteen days"
      summary={`Total sales shown: ${currency(total)}.`}
    >
      <Line data={chartData} options={options} />
    </ChartFrame>
  );
}

export function MonthlyCollectionChart({ data = [] }) {
  const theme = useTheme();
  const options = useChartOptions(true);
  const chartData = React.useMemo(() => ({
    labels: data.map((item) => item.name),
    datasets: [
      {
        label: 'Collected',
        data: data.map((item) => item.paid),
        backgroundColor: theme.palette.success.main,
        borderRadius: 7,
        borderSkipped: false,
        maxBarThickness: 34,
      },
      {
        label: 'Outstanding',
        data: data.map((item) => item.due),
        backgroundColor: theme.palette.warning.main,
        borderRadius: 7,
        borderSkipped: false,
        maxBarThickness: 34,
      },
    ],
  }), [data, theme.palette.success.main, theme.palette.warning.main]);
  const collected = data.reduce((sum, item) => sum + (Number(item.paid) || 0), 0);
  const outstanding = data.reduce((sum, item) => sum + (Number(item.due) || 0), 0);

  return (
    <ChartFrame
      label="Monthly collected and outstanding sales comparison"
      summary={`${currency(collected)} collected and ${currency(outstanding)} outstanding across the displayed months.`}
    >
      <Bar data={chartData} options={options} />
    </ChartFrame>
  );
}

export function BottleMixChart({ data = [], business = false }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const businessDark = business && theme.palette.mode === 'dark';
  const visibleData = data.filter((item) => Number(item.value) > 0);
  const hasData = visibleData.length > 0;
  const labels = hasData ? visibleData.map((item) => item.label || item.name) : ['No deliveries'];
  const values = hasData ? visibleData.map((item) => Number(item.value) || 0) : [1];
  const colors = hasData
    ? [
      businessDark ? '#0fc39a' : theme.palette.primary.main,
      businessDark ? '#ff7a45' : theme.palette.secondary.main,
      businessDark ? '#f1f3f5' : theme.palette.success.main,
      businessDark ? '#6f7580' : theme.palette.warning.main,
      businessDark ? '#5ea9ff' : theme.palette.info.main,
    ]
    : [alpha(theme.palette.text.primary, 0.12)];
  const total = visibleData.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const chartData = React.useMemo(() => ({
    labels,
    datasets: [{
      data: values,
      backgroundColor: colors.slice(0, values.length),
      borderColor: theme.palette.background.paper,
      borderWidth: 4,
      hoverOffset: hasData ? 5 : 0,
    }],
  }), [colors, hasData, labels, theme.palette.background.paper, values]);
  const options = React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    animation: reduceMotion ? false : { duration: 480, easing: 'easeOutQuart' },
    plugins: {
      legend: {
        display: hasData,
        position: 'bottom',
        labels: {
          color: theme.palette.text.secondary,
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          padding: 12,
          font: { size: 10, weight: 700 },
        },
      },
      tooltip: {
        enabled: hasData,
        backgroundColor: theme.palette.mode === 'dark' ? '#071520' : '#10253a',
        callbacks: {
          label: (context) => `${context.label}: ${Number(context.raw || 0).toLocaleString()} bottles`,
        },
      },
    },
  }), [hasData, reduceMotion, theme.palette.mode, theme.palette.text.secondary]);

  return (
    <Box
      role="img"
      aria-label="Bottle delivery mix"
      sx={{ position: 'relative', height: 205 }}
    >
      <Doughnut data={chartData} options={options} />
      <Box
        sx={{
          position: 'absolute',
          top: '42%',
          left: '50%',
          display: 'grid',
          textAlign: 'center',
          pointerEvents: 'none',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <Typography variant="h5" fontWeight={900}>{total.toLocaleString()}</Typography>
        <Typography variant="caption" color="text.secondary">bottles</Typography>
      </Box>
      <Typography
        component="span"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          p: 0,
          m: -1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {hasData
          ? `${total} bottles across ${visibleData.length} bottle types.`
          : 'No bottle deliveries have been recorded yet.'}
      </Typography>
    </Box>
  );
}

function useBusinessChartOptions({
  currencyAxis = true,
  legend = false,
  stacked = false,
} = {}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const dark = theme.palette.mode === 'dark';
  const muted = theme.palette.text.secondary;
  const grid = alpha(theme.palette.text.primary, dark ? 0.075 : 0.08);
  return React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: reduceMotion ? false : { duration: 560, easing: 'easeOutQuart' },
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: {
        display: legend,
        position: 'top',
        align: 'end',
        labels: {
          color: muted,
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          boxHeight: 8,
          padding: 14,
          font: { size: 10, weight: 700 },
        },
      },
      tooltip: {
        backgroundColor: dark ? '#191b1f' : '#10253a',
        borderColor: dark ? '#34373d' : 'rgba(255,255,255,.12)',
        borderWidth: 1,
        titleColor: '#ffffff',
        bodyColor: '#d7d9dd',
        padding: 11,
        cornerRadius: 9,
        callbacks: currencyAxis ? {
          label: (context) => `${context.dataset.label}: ${currency(context.parsed.y)}`,
        } : undefined,
      },
    },
    scales: {
      x: {
        stacked,
        border: { display: false },
        grid: { display: false },
        ticks: {
          color: muted,
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 12,
          font: { size: 9, weight: 650 },
        },
      },
      y: {
        stacked,
        beginAtZero: true,
        display: true,
        border: { display: false },
        grid: { color: grid, drawTicks: false },
        ticks: {
          color: muted,
          padding: 7,
          callback: currencyAxis
            ? (value) => (Number(value) >= 1000 ? `${Math.round(Number(value) / 1000)}k` : Number(value))
            : undefined,
          font: { size: 9, weight: 650 },
        },
      },
    },
  }), [currencyAxis, dark, grid, legend, muted, reduceMotion, stacked]);
}

export function BusinessSalesChart({ data = [] }) {
  const theme = useTheme();
  const options = useBusinessChartOptions({ legend: true });
  const dark = theme.palette.mode === 'dark';
  const chartData = React.useMemo(() => ({
    labels: data.map((item) => item.name),
    datasets: [
      {
        type: 'bar',
        label: 'Revenue',
        data: data.map((item) => Number(
          item.sales === undefined || item.sales === null ? item.revenue : item.sales,
        ) || 0),
        backgroundColor: alpha(theme.palette.text.primary, dark ? 0.16 : 0.14),
        hoverBackgroundColor: alpha(theme.palette.primary.main, dark ? 0.35 : 0.55),
        borderRadius: 4,
        borderSkipped: false,
        maxBarThickness: 34,
      },
      {
        type: 'line',
        label: 'Collected',
        data: data.map((item) => Number(item.paid) || 0),
        borderColor: dark ? '#f8fafc' : theme.palette.primary.main,
        backgroundColor: alpha(theme.palette.primary.main, 0.08),
        pointBackgroundColor: theme.palette.success.main,
        pointBorderColor: theme.palette.background.paper,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
        tension: 0.38,
        fill: false,
      },
    ],
  }), [
    dark,
    data,
    theme.palette.background.paper,
    theme.palette.primary.main,
    theme.palette.success.main,
    theme.palette.text.primary,
  ]);
  const total = data.reduce((sum, item) => sum + (Number(
    item.sales === undefined || item.sales === null ? item.revenue : item.sales,
  ) || 0), 0);
  return (
    <ChartFrame label="Revenue and collections trend" summary={`Revenue shown: ${currency(total)}.`}>
      <Bar data={chartData} options={options} />
    </ChartFrame>
  );
}

export function CustomerTrendMiniChart({ data = [] }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const chartData = React.useMemo(() => ({
    labels: data.map((item) => item.name),
    datasets: [{
      label: 'Customers',
      data: data.map((item) => Number(item.customers) || 0),
      borderColor: theme.palette.mode === 'dark' ? '#f4f5f6' : theme.palette.primary.main,
      backgroundColor: alpha(theme.palette.primary.main, 0.05),
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.42,
      fill: true,
    }],
  }), [data, theme.palette.mode, theme.palette.primary.main]);
  const options = React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: reduceMotion ? false : { duration: 500 },
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme.palette.mode === 'dark' ? '#191b1f' : '#10253a',
        titleColor: '#fff',
        bodyColor: '#d7d9dd',
        displayColors: false,
      },
    },
    scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
  }), [reduceMotion, theme.palette.mode]);
  return <Line data={chartData} options={options} />;
}

export function WeeklyPaymentsMiniChart({ data = [] }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const chartData = React.useMemo(() => ({
    labels: data.map((item) => item.name),
    datasets: [{
      label: 'Collected',
      data: data.map((item) => Number(item.paid) || 0),
      backgroundColor: data.map((item, index) => (
        index === data.length - 1
          ? theme.palette.primary.main
          : alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.3 : 0.2)
      )),
      borderRadius: 999,
      borderSkipped: false,
      maxBarThickness: 11,
    }],
  }), [data, theme.palette.mode, theme.palette.primary.main]);
  const options = React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: reduceMotion ? false : { duration: 500 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme.palette.mode === 'dark' ? '#191b1f' : '#10253a',
        titleColor: '#fff',
        bodyColor: '#d7d9dd',
        displayColors: false,
        callbacks: { label: (context) => currency(context.parsed.y) },
      },
    },
    scales: {
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: { color: theme.palette.text.secondary, font: { size: 9, weight: 700 } },
      },
      y: { display: false, beginAtZero: true },
    },
  }), [reduceMotion, theme.palette.mode, theme.palette.text.secondary]);
  return <Bar data={chartData} options={options} />;
}

function useInsightChartOptions({
  business = false,
  currencyAxis = false,
  horizontal = false,
  legend = true,
} = {}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const muted = theme.palette.text.secondary;
  const grid = alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.075 : 0.08);
  const valueTicks = {
    color: muted,
    padding: 7,
    callback: currencyAxis
      ? (value) => (Number(value) >= 1000 ? `PKR ${Math.round(Number(value) / 1000)}k` : Number(value))
      : undefined,
    font: { size: 9, weight: 650 },
  };
  const categoryTicks = {
    color: muted,
    maxRotation: 0,
    autoSkip: true,
    font: { size: 9, weight: 650 },
  };

  return React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    animation: reduceMotion ? false : { duration: 520, easing: 'easeOutQuart' },
    interaction: { intersect: false, mode: horizontal ? 'nearest' : 'index' },
    plugins: {
      legend: {
        display: legend,
        position: 'top',
        align: 'end',
        labels: {
          color: muted,
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          boxHeight: 8,
          padding: 14,
          font: { size: 10, weight: 700 },
        },
      },
      tooltip: {
        backgroundColor: theme.palette.mode === 'dark' ? '#191b1f' : '#10253a',
        borderColor: theme.palette.mode === 'dark' ? '#34373d' : alpha(theme.palette.common.white, 0.1),
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: '#f3f5f7',
        padding: 11,
        cornerRadius: 9,
        callbacks: currencyAxis ? {
          label: (context) => `${context.dataset.label}: ${currency(horizontal ? context.parsed.x : context.parsed.y)}`,
        } : undefined,
      },
    },
    scales: {
      x: horizontal ? {
        beginAtZero: true,
        border: { display: false },
        grid: { color: grid, drawTicks: false },
        ticks: valueTicks,
      } : {
        border: { display: false },
        grid: { display: false },
        ticks: categoryTicks,
      },
      y: horizontal ? {
        border: { display: false },
        grid: { display: false },
        ticks: categoryTicks,
      } : {
        beginAtZero: true,
        border: { display: false },
        grid: { color: grid, drawTicks: false },
        ticks: valueTicks,
      },
    },
  }), [
    categoryTicks,
    currencyAxis,
    grid,
    horizontal,
    legend,
    muted,
    reduceMotion,
    theme.palette.common.white,
    theme.palette.mode,
    valueTicks,
  ]);
}

export function LiveBusinessPulseChart({ data = [], business = false }) {
  const theme = useTheme();
  const options = useInsightChartOptions({ business, legend: true });
  const businessDark = business && theme.palette.mode === 'dark';
  const primary = businessDark ? '#42e8b8' : theme.palette.primary.main;
  const secondary = businessDark ? '#ff8a3d' : theme.palette.secondary.main;
  const chartData = React.useMemo(() => ({
    labels: data.map((item) => item.name),
    datasets: [
      {
        label: 'Demand',
        data: data.map((item) => Number(item.demand) || 0),
        borderColor: primary,
        backgroundColor: alpha(primary, business ? 0.12 : 0.16),
        borderWidth: 2.5,
        pointRadius: 2,
        pointHoverRadius: 5,
        tension: 0.38,
        fill: true,
      },
      {
        label: 'Conversions',
        data: data.map((item) => Number(item.conversions) || 0),
        borderColor: secondary,
        backgroundColor: alpha(secondary, 0.05),
        borderWidth: 2,
        borderDash: [5, 4],
        pointRadius: 2,
        pointHoverRadius: 5,
        tension: 0.38,
        fill: false,
      },
    ],
  }), [business, data, primary, secondary]);
  const demand = data.reduce((sum, item) => sum + (Number(item.demand) || 0), 0);
  const conversions = data.reduce((sum, item) => sum + (Number(item.conversions) || 0), 0);

  return (
    <ChartFrame
      label="Live demand and conversion pulse"
      summary={`${demand} demand events and ${conversions} conversions are shown.`}
    >
      <Line data={chartData} options={options} />
    </ChartFrame>
  );
}

export function RevenueForecastChart({ data = [], business = false }) {
  const theme = useTheme();
  const options = useInsightChartOptions({ business, currencyAxis: true, legend: true });
  const businessDark = business && theme.palette.mode === 'dark';
  const primary = businessDark ? '#f4f5f6' : theme.palette.primary.main;
  const accent = businessDark ? '#42e8b8' : theme.palette.success.main;
  const chartData = React.useMemo(() => ({
    labels: data.map((item) => item.name),
    datasets: [
      {
        type: 'bar',
        label: 'Revenue',
        data: data.map((item) => Number(item.actual) || 0),
          backgroundColor: alpha(primary, businessDark ? 0.18 : 0.58),
          hoverBackgroundColor: alpha(primary, businessDark ? 0.3 : 0.72),
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 36,
      },
      {
        type: 'line',
        label: 'Forecast',
        data: data.map((item) => Number(item.forecast) || 0),
        borderColor: accent,
        backgroundColor: alpha(accent, 0.08),
        pointBackgroundColor: accent,
        pointBorderColor: theme.palette.background.paper,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2.5,
        borderDash: [6, 4],
        tension: 0.35,
        fill: false,
      },
    ],
  }), [accent, businessDark, data, primary, theme.palette.background.paper]);
  const forecast = data.reduce((sum, item) => sum + (Number(item.forecast) || 0), 0);

  return (
    <ChartFrame
      label="Revenue performance and forecast"
      summary={`The displayed forecast totals ${currency(forecast)}.`}
    >
      <Bar data={chartData} options={options} />
    </ChartFrame>
  );
}

export function ConversionFunnelChart({ data = [], business = false }) {
  const theme = useTheme();
  const options = useInsightChartOptions({
    business,
    currencyAxis: false,
    horizontal: true,
    legend: false,
  });
  const colors = business && theme.palette.mode === 'dark'
    ? ['#f3f5f7', '#66b5ff', '#42e8b8', '#ff9b5a', '#a99cff']
    : [
      theme.palette.primary.main,
      theme.palette.info.main,
      theme.palette.success.main,
      theme.palette.warning.main,
      theme.palette.secondary.main,
    ];
  const chartData = React.useMemo(() => ({
    labels: data.map((item) => item.name),
    datasets: [{
      label: 'People',
      data: data.map((item) => Number(item.value) || 0),
      backgroundColor: data.map((item, index) => alpha(colors[index % colors.length], 0.72)),
      hoverBackgroundColor: data.map((item, index) => colors[index % colors.length]),
      borderRadius: 7,
      borderSkipped: false,
      maxBarThickness: 30,
    }],
  }), [colors, data]);
  const finalStage = data.length ? data[data.length - 1] : { name: 'final stage', value: 0 };

  return (
    <ChartFrame
      label="Business conversion funnel"
      summary={`${finalStage.value || 0} people reached ${finalStage.name || 'the final stage'}.`}
    >
      <Bar data={chartData} options={options} />
    </ChartFrame>
  );
}

export function RankedRevenueChart({ data = [] }) {
  const theme = useTheme();
  const options = useInsightChartOptions({
    currencyAxis: true,
    horizontal: true,
    legend: false,
  });
  const colors = [
    theme.palette.primary.main,
    theme.palette.info.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
  ];
  const chartData = React.useMemo(() => ({
    labels: data.map((item) => item.name),
    datasets: [{
      label: 'Revenue',
      data: data.map((item) => Number(item.value) || 0),
      backgroundColor: data.map((item, index) => alpha(colors[index % colors.length], 0.68)),
      hoverBackgroundColor: data.map((item, index) => colors[index % colors.length]),
      borderRadius: 7,
      borderSkipped: false,
      maxBarThickness: 28,
    }],
  }), [colors, data]);
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  return (
    <ChartFrame
      label="Ranked customer revenue"
      summary={`The customers shown generated ${currency(total)} in recorded revenue.`}
    >
      <Bar data={chartData} options={options} />
    </ChartFrame>
  );
}
