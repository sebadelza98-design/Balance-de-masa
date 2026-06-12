/* ════════════════════════════════════════════════════════════════════
   AquaPlant · Dashboard de monitoreo de planta de agua (standalone)
   Un solo archivo: datos simulados + KPIs + 7 páginas con Chart.js.

   Para conectar los Excel reales: reemplazar getDailyRecords() por una
   función que devuelva los mismos DailyRecord leídos del archivo
   (ver mapa de campos en buildDay). El resto no se modifica.
   ════════════════════════════════════════════════════════════════════ */
'use strict';

/* ════════════════ 1. Utilidades de formato (es-CL) ════════════════ */
const _nf = {};
function fmt(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const key = 'd' + decimals;
  _nf[key] ??= new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return _nf[key].format(value);
}
function fmtCompact(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return fmt(value / 1_000_000, 1) + ' M';
  if (abs >= 10_000) return fmt(value / 1000, 1) + ' k';
  return fmt(value, abs < 10 && abs !== 0 ? 1 : 0);
}
function fmtPct(value, decimals = 1) {
  return value === null || value === undefined || Number.isNaN(value)
    ? '—'
    : fmt(value, decimals) + '%';
}
const MONTHS_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const MONTHS_LONG = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const fmtDayShort = (iso) => `${iso.slice(8, 10)} ${MONTHS_SHORT[+iso.slice(5, 7) - 1]}`;
const fmtDateLong = (iso) => `${iso.slice(8, 10)} ${MONTHS_SHORT[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const fmtMonthShort = (m) => `${MONTHS_SHORT[+m.slice(5, 7) - 1]} ${m.slice(2, 4)}`;

/* ════════════════ 2. Fechas ISO ════════════════ */
function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
function addDays(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
function addMonths(iso, n) {
  const [y, m] = iso.split('-').map(Number);
  return toISO(new Date(y, m - 1 + n, 1, 12));
}
function daysBetween(a, b) {
  return Math.round((fromISO(b) - fromISO(a)) / 86_400_000) + 1;
}
function dateRange(a, b) {
  const out = [];
  for (let c = a; c <= b; c = addDays(c, 1)) out.push(c);
  return out;
}
const startOfMonth = (iso) => iso.slice(0, 7) + '-01';
function endOfMonth(iso) {
  const [y, m] = iso.split('-').map(Number);
  return `${iso.slice(0, 7)}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}
function previousPeriod(start, end) {
  const len = daysBetween(start, end);
  const pEnd = addDays(start, -1);
  return { start: addDays(pEnd, -(len - 1)), end: pEnd };
}
const monthKey = (iso) => iso.slice(0, 7);
const todayISO = () => toISO(new Date());
const clampISO = (v, min, max) => (v < min ? min : v > max ? max : v);

/* ════════════════ 3. Catálogo de planta ════════════════ */
const PALETTE = ['#22d3ee','#3b82f6','#a78bfa','#f472b6','#fb923c','#facc15','#4ade80','#2dd4bf','#94a3b8','#e879f9'];
const LINEAS_RETORNABLES = [
  { id: 'linea1', nombre: 'Línea 1', color: PALETTE[0] },
  { id: 'linea2', nombre: 'Línea 2', color: PALETTE[1] },
  { id: 'linea3', nombre: 'Línea 3', color: PALETTE[2] },
  { id: 'linea4', nombre: 'Línea 4', color: PALETTE[3] },
  { id: 'linea5', nombre: 'Línea 5', color: PALETTE[4] },
  { id: 'linea11', nombre: 'Línea 11', color: PALETTE[5] },
];
const LINEA_ONE_WAY = { id: 'oneWay', nombre: 'Línea One Way', color: PALETTE[6] };
const LINEA_10 = { id: 'linea10', nombre: 'Línea 10', color: PALETTE[7] };
const TODAS_LAS_LINEAS = [...LINEAS_RETORNABLES, LINEA_ONE_WAY, LINEA_10];
const POZOS = [
  { id: 'pozo1', nombre: 'Pozo 1' }, { id: 'pozo2', nombre: 'Pozo 2' },
  { id: 'pozo3', nombre: 'Pozo 3' }, { id: 'pozo1b', nombre: 'Pozo 1B' },
];
const SERVICIOS = [
  { id: 'torres', nombre: 'Torres de enfriamiento', color: PALETTE[0] },
  { id: 'calderas', nombre: 'Calderas', color: PALETTE[4] },
  { id: 'cip', nombre: 'CIP', color: PALETTE[2] },
  { id: 'sanitarios', nombre: 'Sanitarios y casino', color: PALETTE[3] },
  { id: 'riego', nombre: 'Riego de áreas verdes', color: PALETTE[6] },
  { id: 'otros', nombre: 'Otros auxiliares', color: PALETTE[8] },
];
const DESTINOS_AP = [
  { id: 'proceso', nombre: 'Proceso productivo', color: PALETTE[0] },
  { id: 'servicios', nombre: 'Servicios generales', color: PALETTE[1] },
  { id: 'casino', nombre: 'Casino y oficinas', color: PALETTE[3] },
  { id: 'sanitarios', nombre: 'Sanitarios', color: PALETTE[5] },
];

/* ════════════════ 4. Definición de KPIs y semáforos ════════════════ */
const KPI_DEFS = {
  ratioAgua: { label: 'Ratio Agua / Bebida', unit: 'L/L', decimals: 2, direction: 'below', ok: 2.6, warn: 3.0, accent: '#22d3ee' },
  produccion: { label: 'Bebida producida', unit: 'm³', decimals: 0, direction: 'volume', deltaGood: 'up', accent: '#4ade80' },
  consumoPozos: { label: 'Consumo total pozos', unit: 'm³', decimals: 0, direction: 'volume', deltaGood: 'down', accent: '#3b82f6' },
  consumoNano: { label: 'Consumo plantas Nano', unit: 'm³', decimals: 0, direction: 'volume', deltaGood: 'down', accent: '#a78bfa' },
  rechazoNano: { label: '% Rechazo Nano', unit: '%', decimals: 1, direction: 'below', ok: 18, warn: 24, accent: '#f472b6' },
  recuperacionWUR: { label: '% Recuperación WUR', unit: '%', decimals: 1, direction: 'above', ok: 75, warn: 65, accent: '#2dd4bf' },
  consumoCIP: { label: 'Agua CIP + Enjuague', unit: 'm³', decimals: 0, direction: 'volume', deltaGood: 'down', accent: '#fb923c' },
  eficienciaRO: { label: 'Eficiencia permeado RO', unit: '%', decimals: 1, direction: 'above', ok: 78, warn: 70, accent: '#facc15' },
};
const LINE_RATIO = { direction: 'below', ok: 1.9, warn: 2.4 };
const POTABLE_EF = { direction: 'above', ok: 92, warn: 86 };
const ELAB_RATIO = { direction: 'below', ok: 1.45, warn: 1.7 };

function evalStatus(value, def) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (!def || def.direction === 'volume' || def.ok === undefined) return null;
  if (def.direction === 'below') return value <= def.ok ? 'ok' : value <= def.warn ? 'warn' : 'bad';
  return value >= def.ok ? 'ok' : value >= def.warn ? 'warn' : 'bad';
}
function evalDelta(deltaPctV, def) {
  if (deltaPctV === null || deltaPctV === undefined || Number.isNaN(deltaPctV)) return 'neutral';
  if (Math.abs(deltaPctV) < 0.05) return 'neutral';
  const goodDown = def && (def.direction === 'below' || def.deltaGood === 'down');
  return (goodDown ? deltaPctV < 0 : deltaPctV > 0) ? 'good' : 'bad';
}

/* ════════════════ 5. Datos simulados (mock determinista) ════════════
   Mismo generador que el proyecto React: cada fecha produce siempre los
   mismos valores. Reemplazar getDailyRecords() para usar datos reales. */
const MIN_DATE = '2025-01-01';

function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const LINE_PARAMS = {
  linea1: { prod: 330, ratio: 2.35 }, linea2: { prod: 290, ratio: 2.2 },
  linea3: { prod: 410, ratio: 2.05 }, linea4: { prod: 250, ratio: 2.5 },
  linea5: { prod: 360, ratio: 2.15 }, linea11: { prod: 300, ratio: 1.95 },
  oneWay: { prod: 520, ratio: 1.6 }, linea10: { prod: 430, ratio: 1.75 },
};
const round1 = (v) => Math.round(v * 10) / 10;

function buildDay(iso) {
  const rnd = mulberry32(hashString(iso));
  const noise = (amp = 0.1) => 1 + (rnd() * 2 - 1) * amp;
  const d = fromISO(iso);
  const dow = d.getDay();
  const month = d.getMonth();

  const weekFactor = dow === 0 ? 0.45 : dow === 6 ? 0.72 : 1;
  const seasonFactor = 1 + 0.16 * Math.cos(((month - 0.5) / 12) * 2 * Math.PI);
  const yearsSinceStart = (d - fromISO(MIN_DATE)) / (365 * 86_400_000);
  const improvement = Math.max(0.9, 1 - 0.04 * yearsSinceStart);

  const lineas = {};
  let produccionTotal = 0;
  let aguaLineas = 0;
  for (const [id, p] of Object.entries(LINE_PARAMS)) {
    const stopped = dow !== 0 && rnd() < 0.04;
    const produccion = stopped ? 0 : p.prod * weekFactor * seasonFactor * noise(0.13);
    const ratioDia = p.ratio * improvement * noise(0.07) * (weekFactor < 1 ? 1.12 : 1);
    const agua = produccion > 0 ? produccion * ratioDia : p.prod * 0.08 * noise(0.3);
    lineas[id] = { agua: round1(agua), produccion: round1(produccion) };
    produccionTotal += produccion;
    aguaLineas += agua;
  }

  const cipVal = (95 + rnd() * 55) * (weekFactor === 1 ? 1 : 0.8);
  const enjuague = (62 + rnd() * 48) * (weekFactor === 1 ? 1 : 0.75);
  const servicios = {
    torres: round1((185 + rnd() * 70) * seasonFactor),
    calderas: round1((95 + rnd() * 45) * (2 - seasonFactor) * 0.95),
    cip: round1(cipVal),
    sanitarios: round1(42 + rnd() * 26),
    riego: round1(Math.max(4, 38 * (seasonFactor - 0.85) * 4 * noise(0.3))),
    otros: round1(30 + rnd() * 28),
  };
  const aguaServicios = Object.values(servicios).reduce((a, b) => a + b, 0);

  const elabProd = produccionTotal * 0.27 * noise(0.06);
  const elaboracion = {
    produccion: round1(elabProd),
    agua: round1(elabProd * 1.32 * improvement * noise(0.08) + 18),
  };

  const demandaTotal = aguaLineas + aguaServicios + elaboracion.agua + enjuague;
  const extraccion = demandaTotal * (1.05 + rnd() * 0.04);
  const pozos = {
    pozo1: round1(extraccion * 0.35 * noise(0.05)),
    pozo2: round1(extraccion * 0.3 * noise(0.05)),
    pozo3: round1(extraccion * 0.22 * noise(0.06)),
    pozo1b: round1(extraccion * 0.13 * noise(0.08)),
  };
  const pozosTotal = Object.values(pozos).reduce((a, b) => a + b, 0);

  const nanoAlim = pozosTotal * (0.54 + rnd() * 0.05);
  const rechazoPct = (0.17 + rnd() * 0.09) * (2 - improvement);
  const nano = {
    alimentacion: round1(nanoAlim),
    rechazo: round1(nanoAlim * rechazoPct),
    permeado: round1(nanoAlim * (1 - rechazoPct)),
  };
  const wurAlim = nano.rechazo + cipVal * 0.55;
  const recupPct = Math.min(0.86, (0.68 + rnd() * 0.12) / improvement);
  const wur = { alimentacion: round1(wurAlim), recuperada: round1(wurAlim * recupPct) };
  const roAlim = nano.permeado * (0.33 + rnd() * 0.05);
  const ro = { alimentacion: round1(roAlim), permeado: round1(roAlim * (0.72 + rnd() * 0.1)) };

  const potableProd = (410 + rnd() * 90) * (0.7 + 0.3 * weekFactor);
  const potableCons = potableProd * (0.87 + rnd() * 0.08);
  const w = {
    proceso: 0.46 * noise(0.1),
    servicios: 0.24 * noise(0.12),
    casino: 0.17 * noise(0.15) * weekFactor,
    sanitarios: 0.13 * noise(0.12),
  };
  const wSum = w.proceso + w.servicios + w.casino + w.sanitarios;
  const aguaPotable = {
    produccion: round1(potableProd),
    consumo: round1(potableCons),
    destinos: {
      proceso: round1((potableCons * w.proceso) / wSum),
      servicios: round1((potableCons * w.servicios) / wSum),
      casino: round1((potableCons * w.casino) / wSum),
      sanitarios: round1((potableCons * w.sanitarios) / wSum),
    },
  };

  return { date: iso, pozos, nano, wur, ro, cip: { cip: round1(cipVal), enjuague: round1(enjuague) }, lineas, servicios, aguaPotable, elaboracion };
}

const AVAILABLE = { min: MIN_DATE, max: todayISO() };

/** Capa de datos: única función que habría que reemplazar por Excel. */
function getDailyRecords(start, end) {
  const from = clampISO(start, AVAILABLE.min, AVAILABLE.max);
  const to = clampISO(end, AVAILABLE.min, AVAILABLE.max);
  if (from > to) return [];
  return dateRange(from, to).map(buildDay);
}

/* ════════════════ 6. Transformaciones / KPIs ════════════════ */
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const safeDiv = (n, d) => (d > 0 ? n / d : null);
const totalPozos = (r) => sum(POZOS.map((p) => r.pozos[p.id] ?? 0));
const totalServicios = (r) => sum(SERVICIOS.map((s) => r.servicios[s.id] ?? 0));
const totalProduccion = (r) => sum(TODAS_LAS_LINEAS.map((l) => r.lineas[l.id]?.produccion ?? 0));

function computePlantKpis(records) {
  if (!records.length) return null;
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
function deltaPct(value, prev) {
  if (value === null || prev === null || prev === undefined || prev === 0) return null;
  return ((value - prev) / Math.abs(prev)) * 100;
}
function monthlySeries(records, selectors) {
  const buckets = new Map();
  for (const rec of records) {
    const key = monthKey(rec.date);
    if (!buckets.has(key)) buckets.set(key, { month: key });
    const b = buckets.get(key);
    for (const [k, fn] of Object.entries(selectors)) b[k] = (b[k] ?? 0) + (fn(rec) ?? 0);
  }
  return [...buckets.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
}
function cumulative(values) {
  let acc = 0;
  return values.map((v) => round1((acc += v ?? 0)));
}
function consumerRanking(records) {
  const items = [];
  for (const l of TODAS_LAS_LINEAS) items.push({ id: l.id, nombre: l.nombre, color: l.color, agua: sum(records.map((r) => r.lineas[l.id]?.agua ?? 0)) });
  for (const s of SERVICIOS) items.push({ id: 'srv-' + s.id, nombre: s.nombre, color: s.color, agua: sum(records.map((r) => r.servicios[s.id] ?? 0)) });
  items.push({ id: 'elaboracion', nombre: 'Elaboración', color: '#e879f9', agua: sum(records.map((r) => r.elaboracion.agua)) });
  const total = sum(items.map((i) => i.agua));
  return items
    .map((i) => ({ ...i, agua: round1(i.agua), pct: total > 0 ? (i.agua / total) * 100 : 0 }))
    .sort((a, b) => b.agua - a.agua);
}
function lineTotals(records, lineId) {
  const agua = sum(records.map((r) => r.lineas[lineId]?.agua ?? 0));
  const produccion = sum(records.map((r) => r.lineas[lineId]?.produccion ?? 0));
  return { agua, produccion, ratio: safeDiv(agua, produccion) };
}
function potableKpis(records) {
  const produccion = sum(records.map((r) => r.aguaPotable.produccion));
  const consumo = sum(records.map((r) => r.aguaPotable.consumo));
  const perdidas = produccion - consumo;
  return { produccion, consumo, perdidas, perdidasPct: safeDiv(perdidas * 100, produccion), eficiencia: safeDiv(consumo * 100, produccion) };
}
function elabKpis(records) {
  const agua = sum(records.map((r) => r.elaboracion.agua));
  const produccion = sum(records.map((r) => r.elaboracion.produccion));
  return { agua, produccion, ratio: safeDiv(agua, produccion) };
}

/* ════════════════ 7. Estado global y datos del período ════════════ */
const state = {
  page: 'planta',
  start: startOfMonth(todayISO()),
  end: todayISO(),
};
let RECS = [];      // registros del período actual
let PREV = [];      // registros del período anterior (igual longitud)
let HIST = [];      // últimos 12 meses (para evoluciones mensuales)
let PREV_RANGE = previousPeriod(state.start, state.end);

function reloadData() {
  PREV_RANGE = previousPeriod(state.start, state.end);
  RECS = getDailyRecords(state.start, state.end);
  PREV = getDailyRecords(PREV_RANGE.start, PREV_RANGE.end);
  HIST = getDailyRecords(addMonths(state.end, -11), state.end);
}

/* ════════════════ 8. Chart.js: tema y fábrica ════════════════ */
Chart.defaults.color = '#93a4c3';
Chart.defaults.borderColor = '#1b2742';
Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
Chart.defaults.plugins.legend.labels.boxHeight = 7;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(13,22,38,0.96)';
Chart.defaults.plugins.tooltip.borderColor = '#233150';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.titleColor = '#e6edf7';
Chart.defaults.plugins.tooltip.bodyColor = '#93a4c3';
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.boxPadding = 4;
Chart.defaults.animation.duration = 350;

let charts = [];
function destroyCharts() {
  charts.forEach((c) => c.destroy());
  charts = [];
}
function makeChart(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  const chart = new Chart(ctx, config);
  charts.push(chart);
  return chart;
}

const tooltipNumber = (unit, decimals) => ({
  label: (ctx) => {
    const v = ctx.parsed.y ?? ctx.parsed.x ?? ctx.parsed;
    return ` ${ctx.dataset.label}: ${fmt(v, decimals)} ${unit}`;
  },
});
const scalesXY = (unit, decimals, { stacked = false, yMin } = {}) => ({
  x: { stacked, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
  y: { stacked, min: yMin, grid: { color: '#1b2742' }, ticks: { callback: (v) => fmtCompact(v) } },
});

function lineDataset(label, data, color, { dashed = false, fillArea = false, stack = false } = {}) {
  return {
    label, data,
    borderColor: color,
    backgroundColor: fillArea ? color + '3d' : color,
    fill: fillArea ? (stack ? (stack === 'first' ? 'origin' : '-1') : 'origin') : false,
    borderWidth: 2, tension: 0.3, pointRadius: 0, pointHoverRadius: 4,
    borderDash: dashed ? [6, 4] : undefined,
    spanGaps: true,
  };
}
function metaDataset(value, n, label) {
  return {
    label, data: Array(n).fill(value),
    borderColor: '#f59e0b', borderDash: [6, 4], borderWidth: 1.6,
    pointRadius: 0, pointHoverRadius: 0, fill: false,
  };
}
function barDataset(label, data, color) {
  return { label, data, backgroundColor: color, borderRadius: 4, maxBarThickness: 42 };
}

/* Texto central del donut */
const centerTextPlugin = {
  id: 'centerText',
  afterDraw(chart, _args, opts) {
    if (!opts || !opts.text) return;
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    if (!meta?.data?.length) return;
    const { x, y } = meta.data[0];
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e6edf7';
    ctx.font = '700 18px Segoe UI, sans-serif';
    ctx.fillText(opts.text, x, y - 2);
    ctx.fillStyle = '#5d6f93';
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.fillText(opts.sub ?? '', x, y + 14);
    ctx.restore();
  },
};
Chart.register(centerTextPlugin);

/* ════════════════ 9. Componentes HTML ════════════════ */
function deltaBadge(d, tone) {
  if (d === null || d === undefined || Number.isNaN(d)) {
    return '<span class="delta neutral" title="Sin datos del período anterior">—</span>';
  }
  const arrow = d > 0.05 ? '▲' : d < -0.05 ? '▼' : '●';
  return `<span class="delta ${tone}" title="vs período anterior">${arrow} ${fmtPct(Math.abs(d), 1)}</span>`;
}
function statusPill(status) {
  if (!status) return '<span style="color:var(--text-faint)">—</span>';
  const lbl = { ok: 'Óptimo', warn: 'Alerta', bad: 'Crítico' }[status];
  return `<span class="status-pill ${status}"><span class="status-dot ${status}"></span>${lbl}</span>`;
}
function kpiCard({ label, value, unit, decimals = 0, accent = '#22d3ee', status = null, delta = null, tone = 'neutral', subtitle = 'vs período anterior' }) {
  return `<div class="kpi-card" style="--kpi-accent:${accent}">
    <div class="kpi-head"><span class="kpi-label">${label}</span>${status ? `<span class="status-dot ${status}"></span>` : ''}</div>
    <div class="kpi-value">${fmt(value, decimals)}<span class="unit">${unit}</span></div>
    <div class="kpi-foot">${deltaBadge(delta, tone)}<span class="kpi-target">${subtitle}</span></div>
  </div>`;
}
function chartCard({ span = 12, title, subtitle = '', canvasId, height = 300, actions = '', body = '' }) {
  return `<div class="chart-card span-${span}">
    <div class="chart-card-head">
      <div><div class="chart-card-title">${title}</div>${subtitle ? `<div class="chart-card-subtitle">${subtitle}</div>` : ''}</div>
      ${actions ? `<div class="chart-card-actions">${actions}</div>` : ''}
    </div>
    <div class="chart-body" ${canvasId ? `style="height:${height}px"` : ''}>${canvasId ? `<canvas id="${canvasId}"></canvas>` : body}</div>
  </div>`;
}
function pageHeader(title, subtitle) {
  return `<div class="page-title-row">
    <div><h1 class="page-title">${title}</h1><div class="page-subtitle">${subtitle}</div></div>
    <div class="page-subtitle">Período: <strong>${fmtDateLong(state.start)} — ${fmtDateLong(state.end)}</strong>
      · vs ${fmtDateLong(PREV_RANGE.start)} — ${fmtDateLong(PREV_RANGE.end)}</div>
  </div>`;
}

/* Tabla dinámica ordenable */
const tables = {};
function renderTable(containerId, columns, rows, sortKey, sortDir = 'desc') {
  tables[containerId] = { columns, rows, sortKey, sortDir };
  const sorted = [...rows];
  if (sortKey) {
    sorted.sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const cmp = typeof va === 'string' ? va.localeCompare(vb, 'es') : va - vb;
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }
  const ths = columns
    .map((c) => `<th class="${c.num ? 'num' : ''} ${c.key === sortKey ? 'sorted' : ''}" data-key="${c.key}">
        ${c.label}${c.key === sortKey ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</th>`)
    .join('');
  const trs = sorted
    .map((r) => `<tr>${columns.map((c) => `<td class="${c.num ? 'num' : ''}">${c.html ? c.html(r) : (r[c.key] ?? '')}</td>`).join('')}</tr>`)
    .join('');
  const box = document.getElementById(containerId);
  box.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
  box.querySelectorAll('th').forEach((th) =>
    th.addEventListener('click', () => {
      const t = tables[containerId];
      const key = th.dataset.key;
      const dir = t.sortKey === key && t.sortDir === 'desc' ? 'asc' : 'desc';
      renderTable(containerId, t.columns, t.rows, key, dir);
    })
  );
}

/* ════════════════ 10. Páginas ════════════════ */
const dayLabels = () => RECS.map((r) => fmtDayShort(r.date));

/* ── 10.1 Planta General ── */
const KPI_ORDER = ['ratioAgua','produccion','consumoPozos','consumoNano','rechazoNano','recuperacionWUR','consumoCIP','eficienciaRO'];

function renderPlanta(root) {
  const kpis = computePlantKpis(RECS);
  const prevK = computePlantKpis(PREV);
  const dailyK = RECS.map((r) => computePlantKpis([r]));
  const ranking = consumerRanking(RECS);
  const monthly = monthlySeries(HIST, { pozos: totalPozos, produccion: totalProduccion });

  const cards = KPI_ORDER.map((key) => {
    const def = KPI_DEFS[key];
    const d = deltaPct(kpis[key], prevK?.[key] ?? null);
    return kpiCard({
      label: def.label, value: kpis[key], unit: def.unit, decimals: def.decimals,
      accent: def.accent, status: evalStatus(kpis[key], def), delta: d, tone: evalDelta(d, def),
      subtitle: def.ok !== undefined ? `Meta ${def.direction === 'below' ? '≤' : '≥'} ${fmt(def.ok, def.decimals)} ${def.unit}` : 'vs período anterior',
    });
  }).join('');

  const kpiOptions = KPI_ORDER.map((k) => `<option value="${k}">${KPI_DEFS[k].label}</option>`).join('');

  root.innerHTML = `
    ${pageHeader('Planta General', 'Balance hídrico global: captación, tratamiento, producción y servicios')}
    <div class="kpi-grid">${cards}</div>
    <div class="chart-grid">
      ${chartCard({ span: 7, title: 'Tendencia diaria del indicador', subtitle: 'Comportamiento día a día dentro del período', canvasId: 'ch-trend', actions: `<select id="sel-kpi">${kpiOptions}</select>` })}
      ${chartCard({ span: 5, title: 'Comparación con período anterior', subtitle: 'Series alineadas por día relativo', canvasId: 'ch-compare', actions: `<select id="sel-cmp"><option value="pozos">Consumo de pozos (m³)</option><option value="prod">Producción de bebida (m³)</option></select>` })}
      ${chartCard({ span: 7, title: 'Evolución mensual acumulada', subtitle: 'Últimos 12 meses · pozos vs bebida producida', canvasId: 'ch-monthly' })}
      ${chartCard({ span: 5, title: 'Distribución del consumo', subtitle: 'Participación por consumidor en el período', canvasId: 'ch-donut' })}
      ${chartCard({ span: 6, title: 'Ranking de consumidores de agua', subtitle: 'Principales consumidores del período (m³)', canvasId: 'ch-rank', height: 340 })}
      ${chartCard({ span: 6, title: 'Estado de indicadores', subtitle: 'Semáforo de desempeño vs metas y período anterior', body: '<div id="tbl-status"></div>' })}
    </div>`;

  /* Tendencia diaria con selector */
  let trendChart = null;
  const drawTrend = (key) => {
    const def = KPI_DEFS[key];
    const data = dailyK.map((k) => (k[key] === null ? null : +k[key].toFixed(2)));
    const datasets = [lineDataset(def.label, data, def.accent)];
    if (def.ok !== undefined) datasets.push(metaDataset(def.ok, data.length, `Meta ${fmt(def.ok, def.decimals)}`));
    if (trendChart) { trendChart.destroy(); charts = charts.filter((c) => c !== trendChart); }
    trendChart = makeChart('ch-trend', {
      type: 'line',
      data: { labels: dayLabels(), datasets },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: def.ok !== undefined }, tooltip: { callbacks: tooltipNumber(def.unit, def.decimals) } },
        scales: scalesXY(def.unit, def.decimals),
      },
    });
  };
  drawTrend('ratioAgua');
  document.getElementById('sel-kpi').addEventListener('change', (e) => drawTrend(e.target.value));

  /* Comparación períodos */
  let cmpChart = null;
  const drawCompare = (mode) => {
    const fn = mode === 'pozos' ? totalPozos : totalProduccion;
    const n = Math.max(RECS.length, PREV.length);
    const labels = Array.from({ length: n }, (_, i) => 'D' + (i + 1));
    const cur = Array.from({ length: n }, (_, i) => (RECS[i] ? round1(fn(RECS[i])) : null));
    const prev = Array.from({ length: n }, (_, i) => (PREV[i] ? round1(fn(PREV[i])) : null));
    if (cmpChart) { cmpChart.destroy(); charts = charts.filter((c) => c !== cmpChart); }
    cmpChart = makeChart('ch-compare', {
      type: 'line',
      data: { labels, datasets: [
        lineDataset('Período actual', cur, '#22d3ee'),
        lineDataset('Período anterior', prev, '#64748b', { dashed: true }),
      ]},
      options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 1) } }, scales: scalesXY('m³', 1) },
    });
  };
  drawCompare('pozos');
  document.getElementById('sel-cmp').addEventListener('change', (e) => drawCompare(e.target.value));

  /* Mensual acumulado */
  makeChart('ch-monthly', {
    type: 'bar',
    data: { labels: monthly.map((m) => fmtMonthShort(m.month)), datasets: [
      barDataset('Agua de pozos (m³)', monthly.map((m) => Math.round(m.pozos)), '#3b82f6'),
      barDataset('Bebida producida (m³)', monthly.map((m) => Math.round(m.produccion)), '#4ade80'),
    ]},
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 0) } }, scales: scalesXY('m³', 0) },
  });

  /* Donut distribución */
  const topDonut = ranking.slice(0, 8);
  makeChart('ch-donut', {
    type: 'doughnut',
    data: { labels: topDonut.map((d) => d.nombre), datasets: [{ data: topDonut.map((d) => d.agua), backgroundColor: topDonut.map((d) => d.color), borderWidth: 0, hoverOffset: 6 }] },
    options: {
      maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'right' },
        centerText: { text: fmtCompact(sum(topDonut.map((d) => d.agua))), sub: 'm³ totales' },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${fmt(ctx.parsed, 0)} m³ (${fmtPct((ctx.parsed / sum(topDonut.map((d) => d.agua))) * 100, 1)})` } },
      },
    },
  });

  /* Ranking horizontal */
  const topRank = ranking.slice(0, 10);
  makeChart('ch-rank', {
    type: 'bar',
    data: { labels: topRank.map((d) => d.nombre), datasets: [{ label: 'Consumo (m³)', data: topRank.map((d) => d.agua), backgroundColor: topRank.map((d) => d.color), borderRadius: 4, maxBarThickness: 18 }] },
    options: {
      indexAxis: 'y', maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${fmt(ctx.parsed.x, 0)} m³ (${fmtPct(topRank[ctx.dataIndex].pct, 1)})` } } },
      scales: { x: { grid: { color: '#1b2742' }, ticks: { callback: (v) => fmtCompact(v) } }, y: { grid: { display: false } } },
    },
  });

  /* Tabla semafórica */
  renderTable('tbl-status', [
    { key: 'indicador', label: 'Indicador' },
    { key: 'valor', label: 'Valor', num: true, html: (r) => `${fmt(r.valor, r.dec)} ${r.unidad}` },
    { key: 'anterior', label: 'Período anterior', num: true, html: (r) => `${fmt(r.anterior, r.dec)} ${r.unidad}` },
    { key: 'delta', label: 'Δ %', num: true, html: (r) => deltaBadge(r.delta, r.tone) },
    { key: 'status', label: 'Estado', html: (r) => statusPill(r.status) },
  ], KPI_ORDER.map((key) => {
    const def = KPI_DEFS[key];
    const d = deltaPct(kpis[key], prevK?.[key] ?? null);
    return { indicador: def.label, valor: kpis[key], anterior: prevK?.[key] ?? null, dec: def.decimals, unidad: def.unit, delta: d, tone: evalDelta(d, def), status: evalStatus(kpis[key], def) };
  }), null);
}

/* ── 10.2 Retornable ── */
function renderRetornable(root) {
  const totals = LINEAS_RETORNABLES.map((l) => ({ ...l, ...lineTotals(RECS, l.id) }));
  const prevTotals = LINEAS_RETORNABLES.map((l) => ({ ...l, ...lineTotals(PREV, l.id) }));
  const agua = sum(totals.map((t) => t.agua));
  const prod = sum(totals.map((t) => t.produccion));
  const aguaP = sum(prevTotals.map((t) => t.agua));
  const prodP = sum(prevTotals.map((t) => t.produccion));
  const ratio = safeDiv(agua, prod);
  const ratioP = safeDiv(aguaP, prodP);
  const mejor = totals.filter((t) => t.ratio !== null && t.produccion > 0).sort((a, b) => a.ratio - b.ratio)[0] ?? null;

  const dAgua = deltaPct(agua, aguaP), dProd = deltaPct(prod, prodP), dRatio = deltaPct(ratio, ratioP);

  root.innerHTML = `
    ${pageHeader('Líneas Retornables', 'Líneas 1 · 2 · 3 · 4 · 5 · 11 — lavado y envasado retornable')}
    <div class="kpi-grid">
      ${kpiCard({ label: 'Consumo de agua', value: agua, unit: 'm³', accent: '#3b82f6', delta: dAgua, tone: evalDelta(dAgua, { deltaGood: 'down' }) })}
      ${kpiCard({ label: 'Bebida producida', value: prod, unit: 'm³', accent: '#4ade80', delta: dProd, tone: evalDelta(dProd, { deltaGood: 'up' }) })}
      ${kpiCard({ label: 'Ratio agua / bebida', value: ratio, unit: 'L/L', decimals: 2, accent: '#22d3ee', status: evalStatus(ratio, LINE_RATIO), delta: dRatio, tone: evalDelta(dRatio, LINE_RATIO), subtitle: `Meta ≤ ${fmt(LINE_RATIO.ok, 1)} L/L` })}
      ${kpiCard({ label: 'Línea más eficiente', value: mejor?.ratio ?? null, unit: '', decimals: 2, accent: '#facc15', subtitle: mejor ? `${mejor.nombre} · L/L` : 'Sin producción' })}
    </div>
    <div class="chart-grid">
      ${chartCard({ span: 7, title: 'Consumo diario de agua por línea', subtitle: 'm³/día dentro del período', canvasId: 'ch-daily', height: 310 })}
      ${chartCard({ span: 5, title: 'Consumo acumulado del período', subtitle: 'Acumulado por línea (m³, apilado)', canvasId: 'ch-cum', height: 310 })}
      ${chartCard({ span: 7, title: 'Comparación entre líneas', subtitle: 'Agua vs bebida producida en el período', canvasId: 'ch-cmp-lineas' })}
      ${chartCard({ span: 5, title: 'Ranking de consumo', subtitle: 'Líneas ordenadas por consumo (m³)', canvasId: 'ch-rank' })}
      ${chartCard({ span: 7, title: 'Tendencia histórica mensual', subtitle: 'Consumo mensual por línea · últimos 12 meses', canvasId: 'ch-hist', height: 310 })}
      ${chartCard({ span: 5, title: 'Indicadores de eficiencia', subtitle: `Ratio objetivo ≤ ${fmt(LINE_RATIO.ok, 1)} L/L · alerta ≤ ${fmt(LINE_RATIO.warn, 1)} L/L`, body: '<div id="tbl-lineas"></div>' })}
    </div>`;

  makeChart('ch-daily', {
    type: 'line',
    data: { labels: dayLabels(), datasets: LINEAS_RETORNABLES.map((l) => lineDataset(l.nombre, RECS.map((r) => r.lineas[l.id].agua), l.color)) },
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 1) } }, scales: scalesXY('m³', 1) },
  });

  makeChart('ch-cum', {
    type: 'line',
    data: { labels: dayLabels(), datasets: LINEAS_RETORNABLES.map((l, i) =>
      lineDataset(l.nombre, cumulative(RECS.map((r) => r.lineas[l.id].agua)), l.color, { fillArea: true, stack: i === 0 ? 'first' : true })) },
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 0) } }, scales: scalesXY('m³', 0, { stacked: true }) },
  });

  makeChart('ch-cmp-lineas', {
    type: 'bar',
    data: { labels: totals.map((t) => t.nombre.replace('Línea ', 'L')), datasets: [
      barDataset('Agua (m³)', totals.map((t) => Math.round(t.agua)), '#3b82f6'),
      barDataset('Producción (m³)', totals.map((t) => Math.round(t.produccion)), '#4ade80'),
    ]},
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 0) } }, scales: scalesXY('m³', 0) },
  });

  const rank = [...totals].sort((a, b) => b.agua - a.agua);
  makeChart('ch-rank', {
    type: 'bar',
    data: { labels: rank.map((t) => t.nombre), datasets: [{ label: 'Consumo (m³)', data: rank.map((t) => Math.round(t.agua)), backgroundColor: rank.map((t) => t.color), borderRadius: 4, maxBarThickness: 20 }] },
    options: {
      indexAxis: 'y', maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${fmt(ctx.parsed.x, 0)} m³` } } },
      scales: { x: { grid: { color: '#1b2742' }, ticks: { callback: (v) => fmtCompact(v) } }, y: { grid: { display: false } } },
    },
  });

  const hist = monthlySeries(HIST, Object.fromEntries(LINEAS_RETORNABLES.map((l) => [l.id, (r) => r.lineas[l.id].agua])));
  makeChart('ch-hist', {
    type: 'line',
    data: { labels: hist.map((m) => fmtMonthShort(m.month)), datasets: LINEAS_RETORNABLES.map((l) => lineDataset(l.nombre, hist.map((m) => Math.round(m[l.id])), l.color)) },
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 0) } }, scales: scalesXY('m³', 0) },
  });

  renderTable('tbl-lineas', [
    { key: 'nombre', label: 'Línea', html: (r) => `<span class="row-label"><span class="row-swatch" style="background:${r.color}"></span>${r.nombre}</span>` },
    { key: 'agua', label: 'Agua m³', num: true, html: (r) => fmt(r.agua, 0) },
    { key: 'produccion', label: 'Prod. m³', num: true, html: (r) => fmt(r.produccion, 0) },
    { key: 'ratio', label: 'Ratio', num: true, html: (r) => fmt(r.ratio, 2) },
    { key: 'delta', label: 'Δ Agua', num: true, html: (r) => deltaBadge(r.delta, r.delta === null ? 'neutral' : r.delta < 0 ? 'good' : 'bad') },
    { key: 'status', label: 'Estado', html: (r) => statusPill(r.status) },
  ], totals.map((t) => ({
    ...t,
    delta: deltaPct(t.agua, prevTotals.find((p) => p.id === t.id)?.agua ?? null),
    status: evalStatus(t.ratio, LINE_RATIO),
  })), 'agua');
}

/* ── 10.3 Detalle de línea individual (One Way / Línea 10) ── */
function renderLineDetail(root, { lineId, title, subtitle, color }) {
  const k = lineTotals(RECS, lineId);
  const kp = lineTotals(PREV, lineId);
  const dAgua = deltaPct(k.agua, kp.agua), dProd = deltaPct(k.produccion, kp.produccion), dRatio = deltaPct(k.ratio, kp.ratio);

  const aguaDaily = RECS.map((r) => r.lineas[lineId].agua);
  const prodDaily = RECS.map((r) => r.lineas[lineId].produccion);
  const ratioDaily = RECS.map((r) => {
    const l = r.lineas[lineId];
    return l.produccion > 0 ? +(l.agua / l.produccion).toFixed(2) : null;
  });
  const peakIdx = aguaDaily.indexOf(Math.max(...aguaDaily));

  root.innerHTML = `
    ${pageHeader(title, subtitle)}
    <div class="kpi-grid">
      ${kpiCard({ label: 'Consumo de agua', value: k.agua, unit: 'm³', accent: '#3b82f6', delta: dAgua, tone: evalDelta(dAgua, { deltaGood: 'down' }) })}
      ${kpiCard({ label: 'Bebida producida', value: k.produccion, unit: 'm³', accent: '#4ade80', delta: dProd, tone: evalDelta(dProd, { deltaGood: 'up' }) })}
      ${kpiCard({ label: 'Ratio agua / bebida', value: k.ratio, unit: 'L/L', decimals: 2, accent: color, status: evalStatus(k.ratio, LINE_RATIO), delta: dRatio, tone: evalDelta(dRatio, LINE_RATIO), subtitle: `Meta ≤ ${fmt(LINE_RATIO.ok, 1)} L/L` })}
      ${kpiCard({ label: 'Día de mayor consumo', value: peakIdx >= 0 ? aguaDaily[peakIdx] : null, unit: 'm³', accent: '#fb923c', subtitle: peakIdx >= 0 ? fmtDayShort(RECS[peakIdx].date) : '—' })}
    </div>
    <div class="chart-grid">
      ${chartCard({ span: 7, title: 'Tendencia diaria', subtitle: 'Consumo de agua y producción (m³/día)', canvasId: 'ch-daily' })}
      ${chartCard({ span: 5, title: 'Ratio diario agua / bebida', subtitle: `Meta ≤ ${fmt(LINE_RATIO.ok, 1)} L/L`, canvasId: 'ch-ratio' })}
      ${chartCard({ span: 6, title: 'Acumulado del período', subtitle: 'Agua y producción acumuladas (m³)', canvasId: 'ch-cum', height: 290 })}
      ${chartCard({ span: 6, title: 'Comparación con período anterior', subtitle: 'Día a día vs período anterior equivalente', canvasId: 'ch-cmp', height: 290, actions: `<select id="sel-cmp"><option value="agua">Consumo de agua</option><option value="produccion">Producción</option></select>` })}
      ${chartCard({ span: 12, title: 'Comparación histórica mensual', subtitle: 'Totales mensuales · últimos 12 meses', canvasId: 'ch-hist' })}
    </div>`;

  makeChart('ch-daily', {
    type: 'line',
    data: { labels: dayLabels(), datasets: [
      lineDataset('Agua (m³)', aguaDaily, '#3b82f6'),
      lineDataset('Producción (m³)', prodDaily, '#4ade80'),
    ]},
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 1) } }, scales: scalesXY('m³', 1) },
  });

  makeChart('ch-ratio', {
    type: 'line',
    data: { labels: dayLabels(), datasets: [
      lineDataset('Ratio (L/L)', ratioDaily, color),
      metaDataset(LINE_RATIO.ok, ratioDaily.length, `Meta ${fmt(LINE_RATIO.ok, 1)}`),
    ]},
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('L/L', 2) } }, scales: scalesXY('L/L', 2) },
  });

  makeChart('ch-cum', {
    type: 'line',
    data: { labels: dayLabels(), datasets: [
      lineDataset('Agua acumulada', cumulative(aguaDaily), '#3b82f6', { fillArea: true }),
      lineDataset('Producción acumulada', cumulative(prodDaily), '#4ade80', { fillArea: true }),
    ]},
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 0) } }, scales: scalesXY('m³', 0) },
  });

  let cmpChart = null;
  const drawCompare = (metric) => {
    const n = Math.max(RECS.length, PREV.length);
    const labels = Array.from({ length: n }, (_, i) => 'D' + (i + 1));
    const cur = Array.from({ length: n }, (_, i) => (RECS[i] ? RECS[i].lineas[lineId][metric] : null));
    const prv = Array.from({ length: n }, (_, i) => (PREV[i] ? PREV[i].lineas[lineId][metric] : null));
    if (cmpChart) { cmpChart.destroy(); charts = charts.filter((c) => c !== cmpChart); }
    cmpChart = makeChart('ch-cmp', {
      type: 'line',
      data: { labels, datasets: [
        lineDataset('Período actual', cur, '#22d3ee'),
        lineDataset('Período anterior', prv, '#64748b', { dashed: true }),
      ]},
      options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 1) } }, scales: scalesXY('m³', 1) },
    });
  };
  drawCompare('agua');
  document.getElementById('sel-cmp').addEventListener('change', (e) => drawCompare(e.target.value));

  const hist = monthlySeries(HIST, { agua: (r) => r.lineas[lineId].agua, produccion: (r) => r.lineas[lineId].produccion });
  makeChart('ch-hist', {
    type: 'bar',
    data: { labels: hist.map((m) => fmtMonthShort(m.month)), datasets: [
      barDataset('Agua (m³)', hist.map((m) => Math.round(m.agua)), '#3b82f6'),
      barDataset('Producción (m³)', hist.map((m) => Math.round(m.produccion)), '#4ade80'),
    ]},
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 0) } }, scales: scalesXY('m³', 0) },
  });
}

/* ── 10.4 Servicios ── */
function renderServicios(root) {
  const totals = SERVICIOS.map((s) => ({ ...s, agua: round1(sum(RECS.map((r) => r.servicios[s.id]))) }));
  const prevTotals = SERVICIOS.map((s) => ({ ...s, agua: round1(sum(PREV.map((r) => r.servicios[s.id]))) }));
  const total = sum(totals.map((t) => t.agua));
  const totalPrev = sum(prevTotals.map((t) => t.agua));
  totals.forEach((t) => (t.pct = total > 0 ? (t.agua / total) * 100 : 0));
  const byId = (arr, id) => arr.find((x) => x.id === id);
  const dTotal = deltaPct(total, totalPrev);

  const kpiCards = ['torres', 'calderas', 'cip'].map((id) => {
    const t = byId(totals, id);
    const d = deltaPct(t.agua, byId(prevTotals, id)?.agua ?? null);
    return kpiCard({ label: t.nombre, value: t.agua, unit: 'm³', accent: t.color, delta: d, tone: evalDelta(d, { deltaGood: 'down' }) });
  }).join('');

  root.innerHTML = `
    ${pageHeader('Servicios Auxiliares', 'Torres de enfriamiento, calderas, CIP y otros servicios de planta')}
    <div class="kpi-grid">
      ${kpiCard({ label: 'Consumo total servicios', value: total, unit: 'm³', accent: '#22d3ee', delta: dTotal, tone: evalDelta(dTotal, { deltaGood: 'down' }) })}
      ${kpiCards}
    </div>
    <div class="chart-grid">
      ${chartCard({ span: 7, title: 'Consumo diario por servicio', subtitle: 'Series apiladas (m³/día)', canvasId: 'ch-daily', height: 310 })}
      ${chartCard({ span: 5, title: 'Distribución porcentual del consumo', subtitle: 'Participación de cada servicio en el período', canvasId: 'ch-donut', height: 310 })}
      ${chartCard({ span: 6, title: 'Consumo acumulado mensual', subtitle: 'Total de servicios por mes · últimos 12 meses', canvasId: 'ch-monthly', height: 290 })}
      ${chartCard({ span: 6, title: 'Tendencia histórica por servicio', subtitle: 'Consumo mensual (m³) · últimos 12 meses', canvasId: 'ch-hist', height: 290 })}
      ${chartCard({ span: 12, title: 'Detalle por servicio', subtitle: 'Consumo del período, participación y variación', body: '<div id="tbl-srv"></div>' })}
    </div>`;

  makeChart('ch-daily', {
    type: 'line',
    data: { labels: dayLabels(), datasets: SERVICIOS.map((s, i) =>
      lineDataset(s.nombre, RECS.map((r) => r.servicios[s.id]), s.color, { fillArea: true, stack: i === 0 ? 'first' : true })) },
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 1) } }, scales: scalesXY('m³', 1, { stacked: true }) },
  });

  makeChart('ch-donut', {
    type: 'doughnut',
    data: { labels: totals.map((t) => t.nombre), datasets: [{ data: totals.map((t) => t.agua), backgroundColor: totals.map((t) => t.color), borderWidth: 0, hoverOffset: 6 }] },
    options: {
      maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'right' },
        centerText: { text: fmtCompact(total), sub: 'm³ totales' },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${fmt(ctx.parsed, 0)} m³ (${fmtPct(totals[ctx.dataIndex].pct, 1)})` } },
      },
    },
  });

  const monthly = monthlySeries(HIST, { total: totalServicios });
  makeChart('ch-monthly', {
    type: 'bar',
    data: { labels: monthly.map((m) => fmtMonthShort(m.month)), datasets: [barDataset('Servicios (m³)', monthly.map((m) => Math.round(m.total)), '#22d3ee')] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: tooltipNumber('m³', 0) } }, scales: scalesXY('m³', 0) },
  });

  const histSrv = monthlySeries(HIST, Object.fromEntries(SERVICIOS.map((s) => [s.id, (r) => r.servicios[s.id]])));
  makeChart('ch-hist', {
    type: 'line',
    data: { labels: histSrv.map((m) => fmtMonthShort(m.month)), datasets: SERVICIOS.map((s) => lineDataset(s.nombre, histSrv.map((m) => Math.round(m[s.id])), s.color)) },
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 0) } }, scales: scalesXY('m³', 0) },
  });

  renderTable('tbl-srv', [
    { key: 'nombre', label: 'Servicio', html: (r) => `<span class="row-label"><span class="row-swatch" style="background:${r.color}"></span>${r.nombre}</span>` },
    { key: 'agua', label: 'Consumo m³', num: true, html: (r) => fmt(r.agua, 0) },
    { key: 'pct', label: 'Participación', num: true, html: (r) => fmtPct(r.pct, 1) },
    { key: 'bar', label: '', html: (r) => `<span class="inline-bar"><span style="width:${Math.min(100, r.pct)}%"></span></span>` },
    { key: 'delta', label: 'Δ vs anterior', num: true, html: (r) => deltaBadge(r.delta, r.delta === null ? 'neutral' : r.delta < 0 ? 'good' : 'bad') },
  ], totals.map((t) => ({ ...t, delta: deltaPct(t.agua, byId(prevTotals, t.id)?.agua ?? null) })), 'agua');
}

/* ── 10.5 Agua Potable ── */
function renderPotable(root) {
  const k = potableKpis(RECS);
  const kp = potableKpis(PREV);
  const dP = deltaPct(k.produccion, kp.produccion), dC = deltaPct(k.consumo, kp.consumo),
        dPer = deltaPct(k.perdidas, kp.perdidas), dEf = deltaPct(k.eficiencia, kp.eficiencia);

  const destinos = DESTINOS_AP.map((d) => ({ ...d, agua: round1(sum(RECS.map((r) => r.aguaPotable.destinos[d.id]))) }));
  const destTotal = sum(destinos.map((d) => d.agua));

  root.innerHTML = `
    ${pageHeader('Agua Potable', 'Producción, consumo, pérdidas y eficiencia del sistema de agua potable')}
    <div class="kpi-grid">
      ${kpiCard({ label: 'Producción', value: k.produccion, unit: 'm³', accent: '#22d3ee', delta: dP, tone: evalDelta(dP, {}) })}
      ${kpiCard({ label: 'Consumo', value: k.consumo, unit: 'm³', accent: '#3b82f6', delta: dC, tone: evalDelta(dC, { deltaGood: 'down' }) })}
      ${kpiCard({ label: 'Pérdidas', value: k.perdidas, unit: 'm³', accent: '#ef4444', delta: dPer, tone: evalDelta(dPer, { deltaGood: 'down' }), subtitle: `${fmt(k.perdidasPct, 1)} % de la producción` })}
      ${kpiCard({ label: 'Eficiencia del sistema', value: k.eficiencia, unit: '%', decimals: 1, accent: '#4ade80', status: evalStatus(k.eficiencia, POTABLE_EF), delta: dEf, tone: evalDelta(dEf, POTABLE_EF), subtitle: `Meta ≥ ${POTABLE_EF.ok} %` })}
    </div>
    <div class="chart-grid">
      ${chartCard({ span: 7, title: 'Balance de agua diario', subtitle: 'Consumo útil + pérdidas = producción (m³/día)', canvasId: 'ch-bal' })}
      ${chartCard({ span: 5, title: 'Eficiencia diaria', subtitle: `Meta ≥ ${POTABLE_EF.ok} %`, canvasId: 'ch-ef' })}
      ${chartCard({ span: 5, title: 'Distribución de consumos', subtitle: 'Consumo por destino en el período', canvasId: 'ch-donut' })}
      ${chartCard({ span: 7, title: 'Tendencia mensual', subtitle: 'Producción vs consumo · últimos 12 meses', canvasId: 'ch-monthly' })}
    </div>`;

  makeChart('ch-bal', {
    type: 'line',
    data: { labels: dayLabels(), datasets: [
      lineDataset('Consumo útil', RECS.map((r) => r.aguaPotable.consumo), '#3b82f6', { fillArea: true, stack: 'first' }),
      lineDataset('Pérdidas', RECS.map((r) => round1(r.aguaPotable.produccion - r.aguaPotable.consumo)), '#ef4444', { fillArea: true, stack: true }),
    ]},
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 1) } }, scales: scalesXY('m³', 1, { stacked: true }) },
  });

  const efDaily = RECS.map((r) => (r.aguaPotable.produccion > 0 ? +((r.aguaPotable.consumo / r.aguaPotable.produccion) * 100).toFixed(1) : null));
  makeChart('ch-ef', {
    type: 'line',
    data: { labels: dayLabels(), datasets: [
      lineDataset('Eficiencia (%)', efDaily, '#4ade80'),
      metaDataset(POTABLE_EF.ok, efDaily.length, `Meta ${POTABLE_EF.ok}%`),
    ]},
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('%', 1) } }, scales: scalesXY('%', 1) },
  });

  makeChart('ch-donut', {
    type: 'doughnut',
    data: { labels: destinos.map((d) => d.nombre), datasets: [{ data: destinos.map((d) => d.agua), backgroundColor: destinos.map((d) => d.color), borderWidth: 0, hoverOffset: 6 }] },
    options: {
      maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'right' },
        centerText: { text: fmtCompact(destTotal), sub: 'm³ totales' },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${fmt(ctx.parsed, 0)} m³ (${fmtPct((ctx.parsed / destTotal) * 100, 1)})` } },
      },
    },
  });

  const monthly = monthlySeries(HIST, { produccion: (r) => r.aguaPotable.produccion, consumo: (r) => r.aguaPotable.consumo });
  makeChart('ch-monthly', {
    type: 'bar',
    data: { labels: monthly.map((m) => fmtMonthShort(m.month)), datasets: [
      barDataset('Producción (m³)', monthly.map((m) => Math.round(m.produccion)), '#22d3ee'),
      barDataset('Consumo (m³)', monthly.map((m) => Math.round(m.consumo)), '#3b82f6'),
    ]},
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 0) } }, scales: scalesXY('m³', 0) },
  });
}

/* ── 10.6 Elaboración ── */
function renderElaboracion(root) {
  const k = elabKpis(RECS);
  const kp = elabKpis(PREV);
  const dA = deltaPct(k.agua, kp.agua), dP = deltaPct(k.produccion, kp.produccion), dR = deltaPct(k.ratio, kp.ratio);
  const aguaDaily = RECS.map((r) => r.elaboracion.agua);
  const prodDaily = RECS.map((r) => r.elaboracion.produccion);
  const ratioDaily = RECS.map((r) => (r.elaboracion.produccion > 0 ? +(r.elaboracion.agua / r.elaboracion.produccion).toFixed(2) : null));

  root.innerHTML = `
    ${pageHeader('Elaboración', 'Preparación de jarabes y mezclas — consumo de agua y producción')}
    <div class="kpi-grid">
      ${kpiCard({ label: 'Consumo de agua', value: k.agua, unit: 'm³', accent: '#3b82f6', delta: dA, tone: evalDelta(dA, { deltaGood: 'down' }) })}
      ${kpiCard({ label: 'Producto elaborado', value: k.produccion, unit: 'm³', accent: '#4ade80', delta: dP, tone: evalDelta(dP, { deltaGood: 'up' }) })}
      ${kpiCard({ label: 'Ratio agua / producto', value: k.ratio, unit: 'L/L', decimals: 2, accent: '#e879f9', status: evalStatus(k.ratio, ELAB_RATIO), delta: dR, tone: evalDelta(dR, ELAB_RATIO), subtitle: `Meta ≤ ${fmt(ELAB_RATIO.ok, 2)} L/L` })}
    </div>
    <div class="chart-grid">
      ${chartCard({ span: 7, title: 'Tendencia diaria', subtitle: 'Agua consumida y producto elaborado (m³/día)', canvasId: 'ch-daily' })}
      ${chartCard({ span: 5, title: 'Ratio diario agua / producto', subtitle: `Meta ≤ ${fmt(ELAB_RATIO.ok, 2)} L/L`, canvasId: 'ch-ratio' })}
      ${chartCard({ span: 6, title: 'Acumulado del período', subtitle: 'Agua y producto acumulados (m³)', canvasId: 'ch-cum', height: 290 })}
      ${chartCard({ span: 6, title: 'Comparación con período anterior', subtitle: 'Día a día vs período anterior equivalente', canvasId: 'ch-cmp', height: 290, actions: `<select id="sel-cmp"><option value="agua">Consumo de agua</option><option value="produccion">Producto elaborado</option></select>` })}
      ${chartCard({ span: 12, title: 'Comparación mensual', subtitle: 'Totales mensuales · últimos 12 meses', canvasId: 'ch-hist' })}
    </div>`;

  makeChart('ch-daily', {
    type: 'line',
    data: { labels: dayLabels(), datasets: [
      lineDataset('Agua (m³)', aguaDaily, '#3b82f6'),
      lineDataset('Producto (m³)', prodDaily, '#4ade80'),
    ]},
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 1) } }, scales: scalesXY('m³', 1) },
  });

  makeChart('ch-ratio', {
    type: 'line',
    data: { labels: dayLabels(), datasets: [
      lineDataset('Ratio (L/L)', ratioDaily, '#e879f9'),
      metaDataset(ELAB_RATIO.ok, ratioDaily.length, `Meta ${fmt(ELAB_RATIO.ok, 2)}`),
    ]},
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('L/L', 2) } }, scales: scalesXY('L/L', 2) },
  });

  makeChart('ch-cum', {
    type: 'line',
    data: { labels: dayLabels(), datasets: [
      lineDataset('Agua acumulada', cumulative(aguaDaily), '#3b82f6', { fillArea: true }),
      lineDataset('Producto acumulado', cumulative(prodDaily), '#4ade80', { fillArea: true }),
    ]},
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 0) } }, scales: scalesXY('m³', 0) },
  });

  let cmpChart = null;
  const drawCompare = (metric) => {
    const n = Math.max(RECS.length, PREV.length);
    const labels = Array.from({ length: n }, (_, i) => 'D' + (i + 1));
    const cur = Array.from({ length: n }, (_, i) => (RECS[i] ? RECS[i].elaboracion[metric] : null));
    const prv = Array.from({ length: n }, (_, i) => (PREV[i] ? PREV[i].elaboracion[metric] : null));
    if (cmpChart) { cmpChart.destroy(); charts = charts.filter((c) => c !== cmpChart); }
    cmpChart = makeChart('ch-cmp', {
      type: 'line',
      data: { labels, datasets: [
        lineDataset('Período actual', cur, '#22d3ee'),
        lineDataset('Período anterior', prv, '#64748b', { dashed: true }),
      ]},
      options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 1) } }, scales: scalesXY('m³', 1) },
    });
  };
  drawCompare('agua');
  document.getElementById('sel-cmp').addEventListener('change', (e) => drawCompare(e.target.value));

  const hist = monthlySeries(HIST, { agua: (r) => r.elaboracion.agua, produccion: (r) => r.elaboracion.produccion });
  makeChart('ch-hist', {
    type: 'bar',
    data: { labels: hist.map((m) => fmtMonthShort(m.month)), datasets: [
      barDataset('Agua (m³)', hist.map((m) => Math.round(m.agua)), '#3b82f6'),
      barDataset('Producto (m³)', hist.map((m) => Math.round(m.produccion)), '#4ade80'),
    ]},
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: tooltipNumber('m³', 0) } }, scales: scalesXY('m³', 0) },
  });
}

/* ════════════════ 11. Navegación y filtros ════════════════ */
const PAGES = {
  planta: { label: 'Planta General', icon: '🏭', group: 'General', render: renderPlanta },
  retornable: { label: 'Retornable', icon: '♻️', group: 'Líneas de producción', render: renderRetornable },
  oneway: { label: 'One Way', icon: '🧴', group: 'Líneas de producción',
    render: (root) => renderLineDetail(root, { lineId: 'oneWay', title: 'Línea One Way', subtitle: 'Envasado no retornable (PET / lata)', color: LINEA_ONE_WAY.color }) },
  linea10: { label: 'Línea 10', icon: '🔟', group: 'Líneas de producción',
    render: (root) => renderLineDetail(root, { lineId: 'linea10', title: 'Línea 10', subtitle: 'Indicadores exclusivos de la Línea 10', color: LINEA_10.color }) },
  servicios: { label: 'Servicios', icon: '⚙️', group: 'Áreas de soporte', render: renderServicios },
  potable: { label: 'Agua Potable', icon: '🚰', group: 'Áreas de soporte', render: renderPotable },
  elaboracion: { label: 'Elaboración', icon: '🧪', group: 'Áreas de soporte', render: renderElaboracion },
};

function renderNav() {
  const nav = document.getElementById('sidebar-nav');
  let html = '';
  let lastGroup = null;
  for (const [id, p] of Object.entries(PAGES)) {
    if (p.group !== lastGroup) {
      html += `<div class="nav-group-label">${p.group}</div>`;
      lastGroup = p.group;
    }
    html += `<button class="nav-item${id === state.page ? ' active' : ''}" data-page="${id}">
      <span class="nav-icon">${p.icon}</span>${p.label}</button>`;
  }
  nav.innerHTML = html;
  nav.querySelectorAll('.nav-item').forEach((btn) =>
    btn.addEventListener('click', () => {
      state.page = btn.dataset.page;
      closeSidebar();
      renderNav();
      renderPage();
    })
  );
}

function renderPage() {
  destroyCharts();
  const root = document.getElementById('page-root');
  PAGES[state.page].render(root);
  window.scrollTo({ top: 0 });
}

function syncFilterInputs() {
  document.getElementById('f-start').value = state.start;
  document.getElementById('f-end').value = state.end;
  document.getElementById('f-month').value = String(+state.start.slice(5, 7) - 1);
  document.getElementById('f-year').value = state.start.slice(0, 4);
}

function setRange(start, end) {
  let s = clampISO(start, AVAILABLE.min, AVAILABLE.max);
  let e = clampISO(end, AVAILABLE.min, AVAILABLE.max);
  if (s > e) [s, e] = [e, s];
  state.start = s;
  state.end = e;
  reloadData();
  syncFilterInputs();
  renderPage();
}

function initFilters() {
  const months = MONTHS_LONG.map((m, i) => `<option value="${i}">${m}</option>`).join('');
  document.getElementById('f-month').innerHTML = months;
  const yMin = +AVAILABLE.min.slice(0, 4);
  const yMax = +AVAILABLE.max.slice(0, 4);
  let years = '';
  for (let y = yMax; y >= yMin; y--) years += `<option value="${y}">${y}</option>`;
  document.getElementById('f-year').innerHTML = years;

  document.getElementById('f-start').min = AVAILABLE.min;
  document.getElementById('f-start').max = AVAILABLE.max;
  document.getElementById('f-end').min = AVAILABLE.min;
  document.getElementById('f-end').max = AVAILABLE.max;

  document.getElementById('f-start').addEventListener('change', (e) => e.target.value && setRange(e.target.value, state.end));
  document.getElementById('f-end').addEventListener('change', (e) => e.target.value && setRange(state.start, e.target.value));
  const monthYear = () => {
    const y = +document.getElementById('f-year').value;
    const m = +document.getElementById('f-month').value;
    const first = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    setRange(first, endOfMonth(first));
  };
  document.getElementById('f-month').addEventListener('change', monthYear);
  document.getElementById('f-year').addEventListener('change', monthYear);

  document.getElementById('last-update').textContent = new Date().toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/* Sidebar móvil */
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('backdrop').classList.remove('show');
}
document.getElementById('burger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('backdrop').classList.toggle('show');
});
document.getElementById('backdrop').addEventListener('click', closeSidebar);

/* ════════════════ 12. Inicio ════════════════ */
reloadData();
initFilters();
syncFilterInputs();
renderNav();
renderPage();
