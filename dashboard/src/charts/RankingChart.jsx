import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS } from './chartCommon';
import { fmt, fmtCompact, fmtPct } from '../utils/format';

function RankTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="tt-label">{row.nombre}</div>
      <div className="tt-row">
        <span className="tt-swatch" style={{ background: row.color }} />
        <span>Consumo</span>
        <span className="tt-value">{fmt(row.agua, 1)} {unit}</span>
      </div>
      {row.pct !== undefined && (
        <div className="tt-row">
          <span>Participación</span>
          <span className="tt-value">{fmtPct(row.pct, 1)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Ranking horizontal de consumidores de agua.
 * data: [{ nombre, agua, color, pct? }] ya ordenado descendente.
 */
export default function RankingChart({ data, unit = 'm³', height = 320, maxItems = 10 }) {
  const rows = data.slice(0, maxItems);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 0, right: 56, bottom: 0, left: 8 }}
      >
        <XAxis type="number" tickFormatter={fmtCompact} {...AXIS} />
        <YAxis
          type="category"
          dataKey="nombre"
          width={150}
          {...AXIS}
          interval={0}
        />
        <Tooltip content={<RankTooltip unit={unit} />} cursor={{ fill: 'rgba(52, 80, 126, 0.18)' }} />
        <Bar dataKey="agua" radius={[0, 5, 5, 0]} maxBarSize={20}>
          {rows.map((d) => (
            <Cell key={d.id ?? d.nombre} fill={d.color} />
          ))}
          <LabelList
            dataKey="agua"
            position="right"
            formatter={(v) => fmtCompact(v)}
            style={{ fill: '#93a4c3', fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
