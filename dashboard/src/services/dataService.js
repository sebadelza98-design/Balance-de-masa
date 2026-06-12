/**
 * dataService.js
 * ────────────────────────────────────────────────────────────────────
 * Fachada ÚNICA de acceso a datos para toda la UI.
 *
 * Las páginas y gráficos consumen exclusivamente estas funciones, por lo
 * que pasar de datos simulados a archivos Excel reales solo requiere
 * cambiar ACTIVE_PROVIDER (o implementar excelProvider) — la capa de
 * visualización no se toca.
 */
import mockProvider from './providers/mockProvider';
import excelProvider from './providers/excelProvider';

const PROVIDERS = {
  mock: mockProvider,
  excel: excelProvider,
};

/** Cambiar a 'excel' cuando el proveedor real esté implementado. */
const ACTIVE_PROVIDER = 'mock';

let provider = PROVIDERS[ACTIVE_PROVIDER];

/** Permite cambiar el proveedor en runtime (p. ej. al cargar un Excel). */
export function setProvider(name) {
  if (!PROVIDERS[name]) throw new Error(`Proveedor desconocido: ${name}`);
  provider = PROVIDERS[name];
}

export function getProviderName() {
  return provider.name;
}

/** Registros diarios dentro del rango [start, end] (ISO 'YYYY-MM-DD'). */
export function getDailyRecords(startISO, endISO) {
  return provider.getDailyRecords(startISO, endISO);
}

/** Rango de fechas con datos disponibles. */
export function getAvailableRange() {
  return provider.getAvailableRange();
}

/** Marca de tiempo de la última actualización de datos. */
export function getLastUpdated() {
  return provider.getLastUpdated();
}
