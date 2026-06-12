import { fmt, fmtCompact, fmtDayShort, fmtDateLong, fmtMonthShort } from '../utils/format';

/** Props comunes de ejes/grid para todos los gráficos. */
export const AXIS = {
  stroke: '#5d6f93',
  fontSize: 11,
  tickLine: false,
  axisLine: { stroke: '#233150' },
};

export const GRID = {
  stroke: '#1b2742',
  strokeDasharray: '3 3',
  vertical: false,
};

export const xAxisDateProps = {
  dataKey: 'date',
  tickFormatter: fmtDayShort,
  ...AXIS,
  minTickGap: 24,
};

export const xAxisMonthProps = {
  dataKey: 'month',
  tickFormatter: fmtMonthShort,
  ...AXIS,
  minTickGap: 16,
};

export const yAxisProps = {
  tickFormatter: fmtCompact,
  ...AXIS,
  width: 52,
};

const LABEL_FORMATTERS = {
  date: fmtDateLong,
  month: (v) => fmtMonthShort(v),
  day: (v) => `Día ${v}`,
  none: (v) => v,
};

/** Tooltip personalizado con estilo del tema. */
export function ChartTooltip({ active, payload, label, labelType = 'date', unit = '', decimals = 1 }) {
  if (!active || !payload?.length) return null;
  const fmtLabel = LABEL_FORMATTERS[labelType] ?? LABEL_FORMATTERS.none;
  return (
    <div className="chart-tooltip">
      <div className="tt-label">{fmtLabel(label)}</div>
      {payload
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p) => (
          <div className="tt-row" key={p.dataKey ?? p.name}>
            <span className="tt-swatch" style={{ background: p.color ?? p.fill }} />
            <span>{p.name}</span>
            <span className="tt-value">
              {fmt(p.value, decimals)} {p.unit ?? unit}
            </span>
          </div>
        ))}
    </div>
  );
}

export const LEGEND_STYLE = {
  fontSize: 12,
  color: '#93a4c3',
};

export const legendProps = {
  wrapperStyle: LEGEND_STYLE,
  iconType: 'circle',
  iconSize: 9,
};
