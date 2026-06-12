/**
 * Catálogo maestro de la planta: líneas, pozos, servicios y paleta asociada.
 * Toda la app (mock, transformaciones y vistas) se referencia a este catálogo,
 * de modo que al conectar el Excel real solo haya que mapear estos mismos ids.
 */

export const CHART_COLORS = [
  '#22d3ee', '#3b82f6', '#a78bfa', '#f472b6',
  '#fb923c', '#facc15', '#4ade80', '#2dd4bf',
  '#94a3b8', '#e879f9',
];

/** Líneas de envasado retornable. */
export const LINEAS_RETORNABLES = [
  { id: 'linea1', nombre: 'Línea 1', color: CHART_COLORS[0] },
  { id: 'linea2', nombre: 'Línea 2', color: CHART_COLORS[1] },
  { id: 'linea3', nombre: 'Línea 3', color: CHART_COLORS[2] },
  { id: 'linea4', nombre: 'Línea 4', color: CHART_COLORS[3] },
  { id: 'linea5', nombre: 'Línea 5', color: CHART_COLORS[4] },
  { id: 'linea11', nombre: 'Línea 11', color: CHART_COLORS[5] },
];

export const LINEA_ONE_WAY = { id: 'oneWay', nombre: 'Línea One Way', color: CHART_COLORS[6] };
export const LINEA_10 = { id: 'linea10', nombre: 'Línea 10', color: CHART_COLORS[7] };

/** Todas las líneas productivas (retornables + one way + línea 10). */
export const TODAS_LAS_LINEAS = [...LINEAS_RETORNABLES, LINEA_ONE_WAY, LINEA_10];

/** Pozos de captación de agua cruda. */
export const POZOS = [
  { id: 'pozo1', nombre: 'Pozo 1', color: CHART_COLORS[1] },
  { id: 'pozo2', nombre: 'Pozo 2', color: CHART_COLORS[0] },
  { id: 'pozo3', nombre: 'Pozo 3', color: CHART_COLORS[2] },
  { id: 'pozo1b', nombre: 'Pozo 1B', color: CHART_COLORS[4] },
];

/** Servicios auxiliares. */
export const SERVICIOS = [
  { id: 'torres', nombre: 'Torres de enfriamiento', color: CHART_COLORS[0] },
  { id: 'calderas', nombre: 'Calderas', color: CHART_COLORS[4] },
  { id: 'cip', nombre: 'CIP', color: CHART_COLORS[2] },
  { id: 'sanitarios', nombre: 'Sanitarios y casino', color: CHART_COLORS[3] },
  { id: 'riego', nombre: 'Riego de áreas verdes', color: CHART_COLORS[6] },
  { id: 'otros', nombre: 'Otros auxiliares', color: CHART_COLORS[8] },
];

/** Destinos de consumo de agua potable. */
export const DESTINOS_AGUA_POTABLE = [
  { id: 'proceso', nombre: 'Proceso productivo', color: CHART_COLORS[0] },
  { id: 'servicios', nombre: 'Servicios generales', color: CHART_COLORS[1] },
  { id: 'casino', nombre: 'Casino y oficinas', color: CHART_COLORS[3] },
  { id: 'sanitarios', nombre: 'Sanitarios', color: CHART_COLORS[5] },
];
