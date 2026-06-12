import { useEffect, useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { getDailyRecords } from '../services/dataService';
import { addMonths } from '../utils/dates';

/**
 * Registros históricos de los últimos `monthsBack` meses (terminando en la
 * fecha final del filtro global). Para gráficos de evolución mensual,
 * independientes del rango corto seleccionado.
 */
export function useHistoricalRecords(monthsBack = 12) {
  const { range } = useDashboard();
  const [state, setState] = useState({ records: [], loading: true });

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    const start = addMonths(range.end, -(monthsBack - 1));
    getDailyRecords(start, range.end)
      .then((records) => alive && setState({ records, loading: false }))
      .catch(() => alive && setState({ records: [], loading: false }));
    return () => {
      alive = false;
    };
  }, [range.end, monthsBack]);

  return state;
}
