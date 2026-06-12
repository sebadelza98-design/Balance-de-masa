import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS, ChartTooltip, GRID, legendProps, yAxisProps } from './chartCommon';

/**
 * Comparación período actual vs período anterior, alineados por día
 * relativo del rango (Día 1, Día 2, …).
 *
 * data: [{ idx, label, actual, anterior }]  (ver transforms.alignPeriods)
 */
export default function PeriodCompareChart({
  data,
  unit = 'm³',
  decimals = 1,
  height = 280,
  currentName = 'Período actual',
  previousName = 'Período anterior',
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="idx" {...AXIS} minTickGap={20} tickFormatter={(v) => `D${v}`} />
        <YAxis {...yAxisProps} />
        <Tooltip
          content={<ChartTooltip unit={unit} decimals={decimals} labelType="day" />}
          cursor={{ stroke: '#34507e', strokeWidth: 1 }}
        />
        <Legend {...legendProps} />
        <Line
          type="monotone"
          dataKey="actual"
          name={currentName}
          stroke="#22d3ee"
          strokeWidth={2.4}
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="anterior"
          name={previousName}
          stroke="#64748b"
          strokeWidth={1.8}
          strokeDasharray="6 4"
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
