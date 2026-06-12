/**
 * Helpers de fechas basados en strings ISO 'YYYY-MM-DD' (sin zonas horarias).
 */

/** Date → 'YYYY-MM-DD' */
export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' → Date (mediodía local para evitar saltos de TZ) */
export function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/** Suma días a una fecha ISO. */
export function addDays(iso, days) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Días entre dos fechas ISO (inclusive ambos extremos). */
export function daysBetween(startISO, endISO) {
  const ms = fromISO(endISO) - fromISO(startISO);
  return Math.round(ms / 86_400_000) + 1;
}

/** Lista de fechas ISO entre start y end (inclusive). */
export function dateRange(startISO, endISO) {
  const out = [];
  let cur = startISO;
  while (cur <= endISO) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** Primer día del mes de una fecha ISO. */
export function startOfMonth(iso) {
  return `${iso.slice(0, 7)}-01`;
}

/** Último día del mes de una fecha ISO. */
export function endOfMonth(iso) {
  const [y, m] = iso.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${iso.slice(0, 7)}-${String(last).padStart(2, '0')}`;
}

/** Suma meses a una fecha ISO (se ancla al día 1 del mes resultante). */
export function addMonths(iso, months) {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(y, m - 1 + months, 1, 12);
  return toISO(d);
}

/** Rango (start, end) del período anterior de igual longitud. */
export function previousPeriod(startISO, endISO) {
  const len = daysBetween(startISO, endISO);
  const prevEnd = addDays(startISO, -1);
  const prevStart = addDays(prevEnd, -(len - 1));
  return { start: prevStart, end: prevEnd };
}

/** 'YYYY-MM-DD' → 'YYYY-MM' */
export function monthKey(iso) {
  return iso.slice(0, 7);
}

/** Hoy en ISO. */
export function todayISO() {
  return toISO(new Date());
}

/** Limita una fecha ISO a un rango [min, max]. */
export function clampISO(iso, minISO, maxISO) {
  if (iso < minISO) return minISO;
  if (iso > maxISO) return maxISO;
  return iso;
}
