/**
 * transforms.js
 * ────────────────────────────────────────────────────────────────────
 * Funciones PURAS de agregación y cálculo de KPIs sobre DailyRecord[].
 * Independientes del proveedor de datos (mock o Excel).
 */
import { monthKey } from '../utils/dates';
import { LINEAS_RETORNABLES, SERVICIOS, POZOS, TODAS_LAS_LINEAS } from '../config/plant';

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const safeDiv = (num, den) => (den > 0 ? num / den : null);

/* ════════════════ Totales básicos ════════════════ */

export function totalPozos(rec) {
  return sum(POZOS.map((p) => rec.pozos[p.id] ?? 0));
}

export function totalServicios(rec) {
  return sum(SERVICIOS.map((s) => rec.servicios[s.id] ?? 0));
}

export function totalProduccion(rec) {
  return sum(TODAS_LAS_LINEAS.map((l) => rec.lineas[l.id]?.produccion ?? 0));
}

export function totalAguaLineas(rec) {
  return sum(TODAS_LAS_LINEAS.map((l) => rec.lineas[l.id]?.agua ?? 0));
}

/* ════════════════ KPIs de Planta General ════════════════ */

/**
 * Calcula los KPIs agregados de planta para un conjunto de días.
 * Devuelve { ratioAgua, produccion, consumoPozos, consumoNano,
 *            rechazoNano, recuperacionWUR, consumoCIP, eficienciaRO }
 */
export function computePlantKpis(records) {
  if (!records?.length) return null;
  const pozos = sum(records.map(totalPozos));
  const produccion = sum(records.map(totalProduccion));
  const nanoAlim = sum(records.map((r) => r.nano.alimentacion));
  const nanoRech = sum(records.map((r) => r.nano.rechazo));
  const wurAlim = sum(records.map((r) => r.wur.alimentacion));
  const wurRec = sum(records.map((r) => r.wur.recuperada));
  const roAlim = sum(records.map((r) => r.ro.alimentacion));
  const roPerm = sum(records.map((r) => r.ro.permeado));
  const cip = sum(records.map((r) => r.cip.cip + r.cip.enjuague));

  return {
    ratioAgua: safeDiv(pozos, produccion),
    produccion,
    consumoPozos: pozos,
    consumoNano: nanoAlim,
    rechazoNano: safeDiv(nanoRech * 100, nanoAlim),
    recuperacionWUR: safeDiv(wurRec * 100, wurAlim),
    consumoCIP: cip,
    eficienciaRO: safeDiv(roPerm * 100, roAlim),
  };
}

/** KPIs diarios de planta (para tendencias). */
export function plantKpiDailySeries(records) {
  return records.map((rec) => {
    const k = computePlantKpis([rec]);
    return { date: rec.date, ...k };
  });
}

/* ════════════════ Comparación de períodos ════════════════ */

/**
 * Combina KPIs del período actual y anterior:
 * { kpiKey: { value, prev, deltaPct } }
 */
export function withComparison(currentKpis, previousKpis) {
  if (!currentKpis) return null;
  const out = {};
  for (const [key, value] of Object.entries(currentKpis)) {
    const prev = previousKpis?.[key] ?? null;
    let deltaPct = null;
    if (value !== null && prev !== null && prev !== 0) {
      deltaPct = ((value - prev) / Math.abs(prev)) * 100;
    }
    out[key] = { value, prev, deltaPct };
  }
  return out;
}

/** Variación porcentual simple. */
export function deltaPct(value, prev) {
  if (value === null || prev === null || prev === undefined || prev === 0) return null;
  return ((value - prev) / Math.abs(prev)) * 100;
}

/* ════════════════ Series para gráficos ════════════════ */

/**
 * Serie diaria genérica: [{ date, [key]: value }] a partir de un
 * diccionario de selectores { key: (rec) => number }.
 */
export function dailySeries(records, selectors) {
  return records.map((rec) => {
    const row = { date: rec.date };
    for (const [key, fn] of Object.entries(selectors)) {
      const v = fn(rec);
      row[key] = v === null || v === undefined ? null : Math.round(v * 100) / 100;
    }
    return row;
  });
}

/**
 * Agregado mensual: [{ month: 'YYYY-MM', [key]: total }].
 * `mode` por clave: 'sum' (defecto) o 'avg'.
 */
export function monthlySeries(records, selectors, modes = {}) {
  const buckets = new Map();
  for (const rec of records) {
    const key = monthKey(rec.date);
    if (!buckets.has(key)) buckets.set(key, { month: key, _n: 0 });
    const b = buckets.get(key);
    b._n += 1;
    for (const [k, fn] of Object.entries(selectors)) {
      const v = fn(rec) ?? 0;
      b[k] = (b[k] ?? 0) + v;
    }
  }
  const out = [...buckets.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
  for (const row of out) {
    for (const k of Object.keys(selectors)) {
      if (modes[k] === 'avg' && row._n > 0) row[k] = row[k] / row._n;
      row[k] = Math.round(row[k] * 10) / 10;
    }
    delete row._n;
  }
  return out;
}

/**
 * Serie acumulada dentro del rango: [{ date, [key]: acumulado }].
 */
export function cumulativeSeries(records, selectors) {
  const acc = {};
  return records.map((rec) => {
    const row = { date: rec.date };
    for (const [key, fn] of Object.entries(selectors)) {
      acc[key] = (acc[key] ?? 0) + (fn(rec) ?? 0);
      row[key] = Math.round(acc[key] * 10) / 10;
    }
    return row;
  });
}

/**
 * Alinea período actual vs anterior por índice de día:
 * [{ idx, label, actual, anterior }]
 */
export function alignPeriods(currentRecords, previousRecords, selector) {
  const len = Math.max(currentRecords.length, previousRecords.length);
  const out = [];
  for (let i = 0; i < len; i++) {
    out.push({
      idx: i + 1,
      label: `Día ${i + 1}`,
      date: currentRecords[i]?.date ?? null,
      actual: currentRecords[i] ? Math.round(selector(currentRecords[i]) * 10) / 10 : null,
      anterior: previousRecords[i] ? Math.round(selector(previousRecords[i]) * 10) / 10 : null,
    });
  }
  return out;
}

/* ════════════════ Rankings y distribuciones ════════════════ */

/**
 * Ranking de consumidores de agua de la planta (líneas + servicios +
 * elaboración) sobre el rango: [{ id, nombre, agua, color, pct }].
 */
export function consumerRanking(records) {
  if (!records?.length) return [];
  const items = [];

  for (const l of TODAS_LAS_LINEAS) {
    items.push({
      id: l.id,
      nombre: l.nombre,
      color: l.color,
      agua: sum(records.map((r) => r.lineas[l.id]?.agua ?? 0)),
    });
  }
  for (const s of SERVICIOS) {
    items.push({
      id: `srv-${s.id}`,
      nombre: s.nombre,
      color: s.color,
      agua: sum(records.map((r) => r.servicios[s.id] ?? 0)),
    });
  }
  items.push({
    id: 'elaboracion',
    nombre: 'Elaboración',
    color: '#e879f9',
    agua: sum(records.map((r) => r.elaboracion.agua)),
  });

  const total = sum(items.map((i) => i.agua));
  return items
    .map((i) => ({
      ...i,
      agua: Math.round(i.agua * 10) / 10,
      pct: total > 0 ? (i.agua / total) * 100 : 0,
    }))
    .sort((a, b) => b.agua - a.agua);
}

/** Totales por línea retornable: [{ id, nombre, color, agua, produccion, ratio }] */
export function retornableTotals(records) {
  return LINEAS_RETORNABLES.map((l) => {
    const agua = sum(records.map((r) => r.lineas[l.id]?.agua ?? 0));
    const produccion = sum(records.map((r) => r.lineas[l.id]?.produccion ?? 0));
    return {
      ...l,
      agua: Math.round(agua * 10) / 10,
      produccion: Math.round(produccion * 10) / 10,
      ratio: safeDiv(agua, produccion),
    };
  });
}

/** Totales por servicio: [{ id, nombre, color, agua, pct }] */
export function serviciosTotals(records) {
  const items = SERVICIOS.map((s) => ({
    ...s,
    agua: Math.round(sum(records.map((r) => r.servicios[s.id] ?? 0)) * 10) / 10,
  }));
  const total = sum(items.map((i) => i.agua));
  return items.map((i) => ({ ...i, pct: total > 0 ? (i.agua / total) * 100 : 0 }));
}

/** KPIs de una línea individual sobre el rango. */
export function lineKpis(records, lineId) {
  if (!records?.length) return null;
  const agua = sum(records.map((r) => r.lineas[lineId]?.agua ?? 0));
  const produccion = sum(records.map((r) => r.lineas[lineId]?.produccion ?? 0));
  return { agua, produccion, ratio: safeDiv(agua, produccion) };
}

/** KPIs de agua potable sobre el rango. */
export function potableKpis(records) {
  if (!records?.length) return null;
  const produccion = sum(records.map((r) => r.aguaPotable.produccion));
  const consumo = sum(records.map((r) => r.aguaPotable.consumo));
  const perdidas = produccion - consumo;
  return {
    produccion,
    consumo,
    perdidas,
    perdidasPct: safeDiv(perdidas * 100, produccion),
    eficiencia: safeDiv(consumo * 100, produccion),
  };
}

/** KPIs de elaboración sobre el rango. */
export function elaboracionKpis(records) {
  if (!records?.length) return null;
  const agua = sum(records.map((r) => r.elaboracion.agua));
  const produccion = sum(records.map((r) => r.elaboracion.produccion));
  return { agua, produccion, ratio: safeDiv(agua, produccion) };
}
