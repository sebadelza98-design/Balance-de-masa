import DeltaBadge from './DeltaBadge';
import { StatusDot } from './StatusPill';
import { fmt } from '../utils/format';
import { evalDelta, evalStatus } from '../config/metrics';

/**
 * Tarjeta KPI: valor agregado del período + semáforo + variación vs
 * período anterior.
 *
 * props:
 *  - def:    definición del KPI (config/metrics.js) — label, unit, umbrales…
 *  - value:  valor del período actual
 *  - deltaPct: variación % vs período anterior (opcional)
 *  - label / unit / decimals / accent: overrides puntuales
 */
export default function KpiCard({
  def = {},
  value,
  deltaPct = null,
  label,
  unit,
  decimals,
  accent,
  subtitle,
}) {
  const status = evalStatus(value, def);
  const tone = evalDelta(deltaPct, def);

  return (
    <div
      className="kpi-card"
      style={{ '--kpi-accent': accent ?? def.accent ?? 'var(--accent)' }}
      title={def.description}
    >
      <div className="kpi-head">
        <span className="kpi-label">{label ?? def.label}</span>
        <StatusDot status={status} />
      </div>

      <div className="kpi-value">
        {fmt(value, decimals ?? def.decimals ?? 0)}
        <span className="unit">{unit ?? def.unit}</span>
      </div>

      <div className="kpi-foot">
        <DeltaBadge deltaPct={deltaPct} tone={tone} />
        <span className="kpi-target">
          {subtitle ??
            (def.ok !== undefined
              ? `Meta ${def.direction === 'below' ? '≤' : '≥'} ${fmt(def.ok, def.decimals ?? 0)} ${def.unit}`
              : 'vs período anterior')}
        </span>
      </div>
    </div>
  );
}
