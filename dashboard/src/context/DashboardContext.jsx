/**
 * DashboardContext
 * ────────────────────────────────────────────────────────────────────
 * Estado global del dashboard:
 *  - Filtros de fecha (inicial / final) compartidos por todas las páginas.
 *  - Registros del período actual y del período anterior (para deltas),
 *    obtenidos una sola vez por cambio de filtro vía dataService.
 *  - Rango disponible y marca de última actualización.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  getAvailableRange,
  getDailyRecords,
  getLastUpdated,
  getProviderName,
} from '../services/dataService';
import {
  clampISO,
  endOfMonth,
  previousPeriod,
  startOfMonth,
  todayISO,
} from '../utils/dates';

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const today = todayISO();

  const [available, setAvailable] = useState({ min: '2025-01-01', max: today });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [range, setRangeState] = useState({
    start: startOfMonth(today),
    end: today,
  });
  const [data, setData] = useState({
    records: [],
    prevRecords: [],
    loading: true,
    error: null,
  });

  /* Rango disponible + última actualización (una vez al montar). */
  useEffect(() => {
    getAvailableRange().then(setAvailable).catch(() => {});
    getLastUpdated().then(setLastUpdated).catch(() => {});
  }, []);

  /* Carga de datos al cambiar el rango: período actual + anterior. */
  useEffect(() => {
    let alive = true;
    setData((d) => ({ ...d, loading: true, error: null }));
    const prev = previousPeriod(range.start, range.end);

    Promise.all([
      getDailyRecords(range.start, range.end),
      getDailyRecords(prev.start, prev.end),
    ])
      .then(([records, prevRecords]) => {
        if (!alive) return;
        setData({ records, prevRecords, loading: false, error: null });
      })
      .catch((err) => {
        if (!alive) return;
        setData({
          records: [],
          prevRecords: [],
          loading: false,
          error: err?.message ?? 'Error al cargar datos',
        });
      });

    return () => {
      alive = false;
    };
  }, [range.start, range.end]);

  /* ── Acciones de filtro ── */
  const setRange = useCallback(
    (start, end) => {
      let s = clampISO(start, available.min, available.max);
      let e = clampISO(end, available.min, available.max);
      if (s > e) [s, e] = [e, s];
      setRangeState({ start: s, end: e });
    },
    [available.min, available.max]
  );

  /** Selecciona un mes calendario completo (recortado al rango disponible). */
  const setMonth = useCallback(
    (year, monthIndex) => {
      const first = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
      setRange(first, endOfMonth(first));
    },
    [setRange]
  );

  const value = useMemo(
    () => ({
      range,
      prevRange: previousPeriod(range.start, range.end),
      setRange,
      setMonth,
      available,
      lastUpdated,
      providerName: getProviderName(),
      ...data,
    }),
    [range, setRange, setMonth, available, lastUpdated, data]
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

/** Hook de acceso al estado global del dashboard. */
export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboard debe usarse dentro de <DashboardProvider>');
  }
  return ctx;
}
