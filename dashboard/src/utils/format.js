/**
 * Utilidades de formato numérico y de fechas (locale es-CL).
 */

const nfCache = new Map();

function nf(decimals) {
  const key = `d${decimals}`;
  if (!nfCache.has(key)) {
    nfCache.set(
      key,
      new Intl.NumberFormat('es-CL', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    );
  }
  return nfCache.get(key);
}

/** Formatea un número con separador de miles chileno. */
export function fmt(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return nf(decimals).format(value);
}

/** Formato compacto para ejes (12.500 → 12,5 k). */
export function fmtCompact(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${fmt(value / 1_000_000, 1)} M`;
  if (abs >= 10_000) return `${fmt(value / 1000, 1)} k`;
  return fmt(value, abs < 10 && abs !== 0 ? 1 : 0);
}

/** Porcentaje con signo opcional. */
export function fmtPct(value, decimals = 1, withSign = false) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = withSign && value > 0 ? '+' : '';
  return `${sign}${fmt(value, decimals)}%`;
}

/** 'YYYY-MM-DD' → 'dd mmm' (p. ej. 05 jun). */
export function fmtDayShort(isoDate) {
  if (!isoDate) return '';
  const [, m, d] = isoDate.split('-');
  return `${d} ${MONTHS_SHORT[Number(m) - 1]}`;
}

/** 'YYYY-MM-DD' → 'dd mmm yyyy'. */
export function fmtDateLong(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d} ${MONTHS_SHORT[Number(m) - 1]} ${y}`;
}

/** 'YYYY-MM' → 'mmm yy'. */
export function fmtMonthShort(isoMonth) {
  if (!isoMonth) return '';
  const [y, m] = isoMonth.split('-');
  return `${MONTHS_SHORT[Number(m) - 1]} ${y.slice(2)}`;
}

export const MONTHS_SHORT = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

export const MONTHS_LONG = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
