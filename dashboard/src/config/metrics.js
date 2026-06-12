/**
 * Definición de KPIs: etiqueta, unidad, decimales, dirección de mejora
 * y umbrales semafóricos.
 *
 *  direction: 'below'  → mejor mientras MENOR (ratio, rechazo, pérdidas)
 *  direction: 'above'  → mejor mientras MAYOR (recuperación, eficiencia)
 *  direction: 'volume' → volumen informativo (sin semáforo por valor;
 *                        el delta se evalúa según `deltaGood`)
 *
 *  Umbrales: para 'below'  → ok si valor ≤ ok; warn si ≤ warn; si no, bad.
 *            para 'above'  → ok si valor ≥ ok; warn si ≥ warn; si no, bad.
 */

export const KPI_DEFS = {
  ratioAgua: {
    label: 'Ratio Agua / Bebida',
    short: 'Ratio agua',
    unit: 'L/L',
    decimals: 2,
    direction: 'below',
    ok: 2.6,
    warn: 3.0,
    accent: '#22d3ee',
    description:
      'Litros de agua total de planta utilizados por litro de bebida producida',
  },
  produccion: {
    label: 'Bebida producida',
    short: 'Producción',
    unit: 'm³',
    decimals: 0,
    direction: 'volume',
    deltaGood: 'up',
    accent: '#4ade80',
    description: 'Volumen total de bebida terminada',
  },
  consumoPozos: {
    label: 'Consumo total pozos',
    short: 'Pozos',
    unit: 'm³',
    decimals: 0,
    direction: 'volume',
    deltaGood: 'down',
    accent: '#3b82f6',
    description: 'Extracción de agua cruda desde pozos',
  },
  consumoNano: {
    label: 'Consumo plantas Nano',
    short: 'Nano',
    unit: 'm³',
    decimals: 0,
    direction: 'volume',
    deltaGood: 'down',
    accent: '#a78bfa',
    description: 'Alimentación total a plantas de nanofiltración',
  },
  rechazoNano: {
    label: '% Rechazo Nano',
    short: 'Rechazo NF',
    unit: '%',
    decimals: 1,
    direction: 'below',
    ok: 18,
    warn: 24,
    accent: '#f472b6',
    description: 'Porcentaje de rechazo de las plantas de nanofiltración',
  },
  recuperacionWUR: {
    label: '% Recuperación WUR',
    short: 'WUR',
    unit: '%',
    decimals: 1,
    direction: 'above',
    ok: 75,
    warn: 65,
    accent: '#2dd4bf',
    description: 'Agua recuperada por las unidades WUR sobre su alimentación',
  },
  consumoCIP: {
    label: 'Agua CIP + Enjuague',
    short: 'CIP + Enj.',
    unit: 'm³',
    decimals: 0,
    direction: 'volume',
    deltaGood: 'down',
    accent: '#fb923c',
    description: 'Consumo de agua en limpieza CIP y enjuagues',
  },
  eficienciaRO: {
    label: 'Eficiencia permeado RO',
    short: 'RO',
    unit: '%',
    decimals: 1,
    direction: 'above',
    ok: 78,
    warn: 70,
    accent: '#facc15',
    description: 'Permeado obtenido sobre alimentación a osmosis inversa',
  },
};

/** Ratio objetivo por línea (L agua / L bebida) para semáforos de líneas. */
export const LINE_RATIO_THRESHOLDS = { ok: 1.9, warn: 2.4 };

/** Eficiencia de agua potable. */
export const POTABLE_THRESHOLDS = {
  eficiencia: { direction: 'above', ok: 92, warn: 86 },
  perdidas: { direction: 'below', ok: 8, warn: 14 },
};

/**
 * Evalúa el estado semafórico de un valor según una definición
 * { direction, ok, warn }. Devuelve 'ok' | 'warn' | 'bad' | null.
 */
export function evalStatus(value, def) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (!def || def.direction === 'volume' || def.ok === undefined) return null;
  if (def.direction === 'below') {
    if (value <= def.ok) return 'ok';
    if (value <= def.warn) return 'warn';
    return 'bad';
  }
  if (value >= def.ok) return 'ok';
  if (value >= def.warn) return 'warn';
  return 'bad';
}

/**
 * Evalúa si un delta (% vs período anterior) es bueno o malo según la
 * dirección de mejora del KPI.
 */
export function evalDelta(deltaPct, def) {
  if (deltaPct === null || deltaPct === undefined || Number.isNaN(deltaPct)) return 'neutral';
  if (Math.abs(deltaPct) < 0.05) return 'neutral';
  const goodWhenDown =
    def?.direction === 'below' || def?.deltaGood === 'down';
  const improving = goodWhenDown ? deltaPct < 0 : deltaPct > 0;
  return improving ? 'good' : 'bad';
}
