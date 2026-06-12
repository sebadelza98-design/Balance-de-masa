import { useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { MONTHS_LONG } from '../utils/format';

/**
 * Encabezado con filtros globales: fecha inicial/final, selector de mes,
 * selector de año e indicador de última actualización.
 */
export default function Header({ onToggleSidebar }) {
  const { range, setRange, setMonth, available, lastUpdated, providerName } =
    useDashboard();

  const selYear = Number(range.start.slice(0, 4));
  const selMonth = Number(range.start.slice(5, 7)) - 1;

  const years = useMemo(() => {
    const from = Number(available.min.slice(0, 4));
    const to = Number(available.max.slice(0, 4));
    const out = [];
    for (let y = to; y >= from; y--) out.push(y);
    return out;
  }, [available]);

  const lastUpdatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <header className="app-header">
      <button
        className="header-burger"
        onClick={onToggleSidebar}
        aria-label="Abrir menú"
      >
        ☰
      </button>

      <div className="header-title">
        Monitoreo Planta de Agua
        <small>
          Fuente de datos: {providerName === 'mock' ? 'simulada (mock)' : 'Excel'}
        </small>
      </div>

      <div className="filters">
        <div className="filter-field">
          <label htmlFor="f-start">Fecha inicial</label>
          <input
            id="f-start"
            type="date"
            value={range.start}
            min={available.min}
            max={available.max}
            onChange={(e) => e.target.value && setRange(e.target.value, range.end)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="f-end">Fecha final</label>
          <input
            id="f-end"
            type="date"
            value={range.end}
            min={available.min}
            max={available.max}
            onChange={(e) => e.target.value && setRange(range.start, e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="f-month">Mes</label>
          <select
            id="f-month"
            value={selMonth}
            onChange={(e) => setMonth(selYear, Number(e.target.value))}
          >
            {MONTHS_LONG.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="f-year">Año</label>
          <select
            id="f-year"
            value={selYear}
            onChange={(e) => setMonth(Number(e.target.value), selMonth)}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="last-update" title="Última actualización de datos">
          <span className="pulse-dot" />
          <span>
            Actualizado
            <br />
            <strong>{lastUpdatedLabel}</strong>
          </span>
        </div>
      </div>
    </header>
  );
}
