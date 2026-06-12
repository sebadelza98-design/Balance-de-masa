/**
 * mockProvider.js
 * ────────────────────────────────────────────────────────────────────
 * Proveedor de datos SIMULADOS. Genera registros diarios deterministas
 * (mismo día → mismos valores) con estacionalidad semanal y anual, para
 * validar diseño, navegación y gráficos del dashboard.
 *
 * Implementa la misma interfaz que `excelProvider`:
 *    getDailyRecords(startISO, endISO) → Promise<DailyRecord[]>
 *    getAvailableRange()               → Promise<{ min, max }>
 *    getLastUpdated()                  → Promise<string ISO datetime>
 *
 * Estructura de un DailyRecord (todas las cifras en m³/día):
 * {
 *   date: 'YYYY-MM-DD',
 *   pozos:       { pozo1, pozo2, pozo3, pozo1b },
 *   nano:        { alimentacion, permeado, rechazo },
 *   wur:         { alimentacion, recuperada },
 *   ro:          { alimentacion, permeado },
 *   cip:         { cip, enjuague },
 *   lineas:      { linea1..linea5, linea11, oneWay, linea10: { agua, produccion } },
 *   servicios:   { torres, calderas, cip, sanitarios, riego, otros },
 *   aguaPotable: { produccion, consumo,
 *                  destinos: { proceso, servicios, casino, sanitarios } },
 *   elaboracion: { agua, produccion },
 * }
 */
import { dateRange, fromISO, todayISO } from '../../utils/dates';

/** Rango de historia simulada disponible. */
const MIN_DATE = '2025-01-01';

/* ── PRNG determinista por día (mulberry32 sobre hash de la fecha) ── */
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

/* ── Parámetros base por línea: producción media (m³/día) y ratio agua/bebida ── */
const LINE_PARAMS = {
  linea1: { prod: 330, ratio: 2.35 },
  linea2: { prod: 290, ratio: 2.2 },
  linea3: { prod: 410, ratio: 2.05 },
  linea4: { prod: 250, ratio: 2.5 },
  linea5: { prod: 360, ratio: 2.15 },
  linea11: { prod: 300, ratio: 1.95 },
  oneWay: { prod: 520, ratio: 1.6 },
  linea10: { prod: 430, ratio: 1.75 },
};

const round1 = (v) => Math.round(v * 10) / 10;

/** Genera el registro de un día (determinista). */
function buildDay(iso) {
  const rnd = mulberry32(hashString(iso));
  const noise = (amp = 0.1) => 1 + (rnd() * 2 - 1) * amp;

  const d = fromISO(iso);
  const dow = d.getDay(); // 0 = domingo
  const month = d.getMonth(); // 0..11

  // Estacionalidad semanal: fines de semana con menor producción.
  const weekFactor = dow === 0 ? 0.45 : dow === 6 ? 0.72 : 1;
  // Estacionalidad anual (hemisferio sur): más demanda en verano (dic-feb).
  const seasonFactor = 1 + 0.16 * Math.cos(((month - 0.5) / 12) * 2 * Math.PI);
  // Mejora progresiva del desempeño hídrico (~4 % por año).
  const yearsSinceStart = (d - fromISO(MIN_DATE)) / (365 * 86_400_000);
  const improvement = Math.max(0.9, 1 - 0.04 * yearsSinceStart);

  // ── Líneas de producción ──
  const lineas = {};
  let produccionTotal = 0;
  let aguaLineas = 0;
  for (const [id, p] of Object.entries(LINE_PARAMS)) {
    // Paros aleatorios de línea (~4 % de los días hábiles).
    const stopped = dow !== 0 && rnd() < 0.04;
    const produccion = stopped
      ? 0
      : p.prod * weekFactor * seasonFactor * noise(0.13);
    // Con baja producción el ratio empeora (consumos fijos de arranque/lavado).
    const ratioDia =
      p.ratio * improvement * noise(0.07) * (weekFactor < 1 ? 1.12 : 1);
    const agua = produccion > 0 ? produccion * ratioDia : p.prod * 0.08 * noise(0.3);
    lineas[id] = { agua: round1(agua), produccion: round1(produccion) };
    produccionTotal += produccion;
    aguaLineas += agua;
  }

  // ── Servicios auxiliares ──
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

  // ── Elaboración (jarabes y mezclas) ──
  const elabProd = produccionTotal * 0.27 * noise(0.06);
  const elaboracion = {
    produccion: round1(elabProd),
    agua: round1(elabProd * 1.32 * improvement * noise(0.08) + 18),
  };

  // ── Demanda total y pozos ──
  const demandaTotal =
    aguaLineas + aguaServicios + elaboracion.agua + enjuague;
  const perdidasRed = demandaTotal * (0.05 + rnd() * 0.04);
  const extraccion = demandaTotal + perdidasRed;
  const pozos = {
    pozo1: round1(extraccion * 0.35 * noise(0.05)),
    pozo2: round1(extraccion * 0.3 * noise(0.05)),
    pozo3: round1(extraccion * 0.22 * noise(0.06)),
    pozo1b: round1(extraccion * 0.13 * noise(0.08)),
  };
  const pozosTotal = Object.values(pozos).reduce((a, b) => a + b, 0);

  // ── Tratamiento: Nano (NF), WUR y RO ──
  const nanoAlim = pozosTotal * (0.54 + rnd() * 0.05);
  const rechazoPct = (0.17 + rnd() * 0.09) * (2 - improvement);
  const nano = {
    alimentacion: round1(nanoAlim),
    rechazo: round1(nanoAlim * rechazoPct),
    permeado: round1(nanoAlim * (1 - rechazoPct)),
  };

  const wurAlim = nano.rechazo + cipVal * 0.55;
  const recupPct = Math.min(0.86, (0.68 + rnd() * 0.12) / improvement);
  const wur = {
    alimentacion: round1(wurAlim),
    recuperada: round1(wurAlim * recupPct),
  };

  const roAlim = nano.permeado * (0.33 + rnd() * 0.05);
  const roEf = 0.72 + rnd() * 0.1;
  const ro = {
    alimentacion: round1(roAlim),
    permeado: round1(roAlim * roEf),
  };

  // ── Agua potable ──
  const potableProd = (410 + rnd() * 90) * (0.7 + 0.3 * weekFactor);
  const potableEf = 0.87 + rnd() * 0.08;
  const potableCons = potableProd * potableEf;
  // Reparto del consumo por destino (pesos con leve variación diaria).
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

  return {
    date: iso,
    pozos,
    nano,
    wur,
    ro,
    cip: { cip: round1(cipVal), enjuague: round1(enjuague) },
    lineas,
    servicios,
    aguaPotable,
    elaboracion,
  };
}

/* Simula latencia de red/lectura de archivo para que la UI ya maneje estados async. */
const simulateLatency = (result) =>
  new Promise((resolve) => setTimeout(() => resolve(result), 120));

const mockProvider = {
  name: 'mock',

  async getDailyRecords(startISO, endISO) {
    const max = todayISO();
    const from = startISO < MIN_DATE ? MIN_DATE : startISO;
    const to = endISO > max ? max : endISO;
    if (from > to) return simulateLatency([]);
    return simulateLatency(dateRange(from, to).map(buildDay));
  },

  async getAvailableRange() {
    return simulateLatency({ min: MIN_DATE, max: todayISO() });
  },

  async getLastUpdated() {
    // Simula la marca de tiempo del último archivo cargado.
    return simulateLatency(new Date().toISOString());
  },
};

export default mockProvider;
