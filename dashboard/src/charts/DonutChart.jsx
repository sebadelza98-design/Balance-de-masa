import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { fmt, fmtPct } from '../utils/format';
import { legendProps } from './chartCommon';

function DonutTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="chart-tooltip">
      <div className="tt-label">{p.name}</div>
      <div className="tt-row">
        <span className="tt-swatch" style={{ background: p.payload.color }} />
        <span>Consumo</span>
        <span className="tt-value">{fmt(p.value, 1)} {unit}</span>
      </div>
      <div className="tt-row">
        <span>Participación</span>
        <span className="tt-value">{fmtPct(p.payload.pct, 1)}</span>
      </div>
    </div>
  );
}

/**
 * Gráfico de torta/donut para distribución porcentual.
 * data: [{ nombre|name, agua|value, color, pct }]
 */
export default function DonutChart({ data, unit = 'm³', height = 280, valueKey = 'agua', nameKey = 'nombre' }) {
  const total = data.reduce((a, d) => a + (d[valueKey] ?? 0), 0);
  return (
    <div style={{ position: 'relative' }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            innerRadius="58%"
            outerRadius="84%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.id ?? d[nameKey]} fill={d.color} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip unit={unit} />} />
          <Legend {...legendProps} layout="vertical" align="right" verticalAlign="middle" />
        </PieChart>
      </ResponsiveContainer>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          pointerEvents: 'none',
          transform: 'translateX(-17%)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(total, 0)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{unit} totales</div>
        </div>
      </div>
    </div>
  );
}
