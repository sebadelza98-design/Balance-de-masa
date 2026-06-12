import { useDashboard } from '../context/DashboardContext';
import { fmtDateLong } from '../utils/format';

/** Título de página + período activo y período de comparación. */
export default function PageHeader({ title, subtitle }) {
  const { range, prevRange } = useDashboard();
  return (
    <div className="page-title-row">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>
      <div className="page-subtitle">
        Período: <strong>{fmtDateLong(range.start)} — {fmtDateLong(range.end)}</strong>
        {' · '}vs {fmtDateLong(prevRange.start)} — {fmtDateLong(prevRange.end)}
      </div>
    </div>
  );
}
