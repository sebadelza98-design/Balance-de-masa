import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartTooltip,
  GRID,
  legendProps,
  xAxisDateProps,
  yAxisProps,
} from './chartCommon';

/**
 * Gráfico de áreas (apilable) para consumos diarios o acumulados.
 *
 * props:
 *  - data:    [{ date, ...series }]
 *  - series:  [{ key, name, color }]
 *  - stacked: apilar series
 */
export default function AreaTrendChart({
  data,
  series,
  unit = 'm³',
  decimals = 1,
  height = 280,
  stacked = false,
  showLegend = true,
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.06} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis {...xAxisDateProps} />
        <YAxis {...yAxisProps} />
        <Tooltip
          content={<ChartTooltip unit={unit} decimals={decimals} />}
          cursor={{ stroke: '#34507e', strokeWidth: 1 }}
        />
        {showLegend && series.length > 1 && <Legend {...legendProps} />}
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stackId={stacked ? 'stack' : undefined}
            stroke={s.color}
            strokeWidth={1.8}
            fill={`url(#grad-${s.key})`}
            connectNulls
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
