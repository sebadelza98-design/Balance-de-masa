import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
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
  xAxisMonthProps,
  yAxisProps,
} from './chartCommon';

/**
 * Gráfico de líneas para tendencias diarias o mensuales.
 *
 * props:
 *  - data:   [{ date|month, ...series }]
 *  - series: [{ key, name, color, dashed? }]
 *  - xType:  'date' | 'month'
 *  - unit, decimals, height, referenceY ({ value, label, color })
 */
export default function TrendChart({
  data,
  series,
  xType = 'date',
  unit = 'm³',
  decimals = 1,
  height = 280,
  referenceY = null,
  showLegend = true,
}) {
  const xProps = xType === 'month' ? xAxisMonthProps : xAxisDateProps;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis {...xProps} />
        <YAxis {...yAxisProps} />
        <Tooltip
          content={<ChartTooltip unit={unit} decimals={decimals} labelType={xType} />}
          cursor={{ stroke: '#34507e', strokeWidth: 1 }}
        />
        {showLegend && series.length > 1 && <Legend {...legendProps} />}
        {referenceY && (
          <ReferenceLine
            y={referenceY.value}
            stroke={referenceY.color ?? '#f59e0b'}
            strokeDasharray="6 4"
            label={{
              value: referenceY.label,
              fill: referenceY.color ?? '#f59e0b',
              fontSize: 11,
              position: 'insideTopRight',
            }}
          />
        )}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2.2}
            strokeDasharray={s.dashed ? '6 4' : undefined}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
