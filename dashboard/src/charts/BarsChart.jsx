import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AXIS,
  ChartTooltip,
  GRID,
  legendProps,
  xAxisDateProps,
  xAxisMonthProps,
  yAxisProps,
} from './chartCommon';

/**
 * Gráfico de barras (agrupadas o apiladas).
 *
 * props:
 *  - data:  filas con la clave del eje X
 *  - series: [{ key, name, color }]
 *  - xType: 'date' | 'month' | 'category' (+ xKey para category)
 */
export default function BarsChart({
  data,
  series,
  xType = 'month',
  xKey = 'name',
  unit = 'm³',
  decimals = 1,
  height = 280,
  stacked = false,
  showLegend = true,
}) {
  const xProps =
    xType === 'date'
      ? xAxisDateProps
      : xType === 'month'
        ? xAxisMonthProps
        : { dataKey: xKey, ...AXIS, interval: 0 };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: 0 }} barCategoryGap="22%">
        <CartesianGrid {...GRID} />
        <XAxis {...xProps} />
        <YAxis {...yAxisProps} />
        <Tooltip
          content={
            <ChartTooltip
              unit={unit}
              decimals={decimals}
              labelType={xType === 'category' ? 'none' : xType}
            />
          }
          cursor={{ fill: 'rgba(52, 80, 126, 0.18)' }}
        />
        {showLegend && series.length > 1 && <Legend {...legendProps} />}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stackId={stacked ? 'stack' : undefined}
            fill={s.color}
            radius={stacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
            maxBarSize={42}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
