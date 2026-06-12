import { fmtPct } from '../utils/format';

/**
 * Variación % vs período anterior, coloreada según sea mejora o deterioro.
 * `tone`: 'good' | 'bad' | 'neutral'.
 */
export default function DeltaBadge({ deltaPct, tone = 'neutral', title }) {
  if (deltaPct === null || deltaPct === undefined || Number.isNaN(deltaPct)) {
    return <span className="delta neutral" title="Sin datos del período anterior">—</span>;
  }
  const arrow = deltaPct > 0.05 ? '▲' : deltaPct < -0.05 ? '▼' : '●';
  return (
    <span className={`delta ${tone}`} title={title ?? 'vs período anterior'}>
      {arrow} {fmtPct(Math.abs(deltaPct), 1)}
    </span>
  );
}
