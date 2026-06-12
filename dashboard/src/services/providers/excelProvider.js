/**
 * excelProvider.js
 * ────────────────────────────────────────────────────────────────────
 * Proveedor de datos para archivos EXCEL reales (uno por mes, con
 * registros diarios — p. ej. `05_Mapa_Agua_Mayo.xlsx`, hoja METROSCUB).
 *
 * ⚠️ PLANTILLA: implementa la MISMA interfaz que `mockProvider`. Para
 * activarlo basta con cambiar `ACTIVE_PROVIDER` en `dataService.js`;
 * ninguna página ni gráfico requiere modificaciones.
 *
 * Pasos para la integración real:
 *   1. Instalar un parser de Excel:  npm install xlsx
 *   2. Completar `COLUMN_MAP` con la celda/columna real de cada señal.
 *   3. Implementar `parseWorkbook()` usando XLSX.read(...).
 *   4. Cargar los archivos vía <input type="file">, fetch a una carpeta
 *      compartida o un endpoint backend, según despliegue.
 *
 * El contrato de salida es idéntico al del mock (ver DailyRecord en
 * mockProvider.js): todas las cifras diarias en m³.
 */

/**
 * Mapa columna-Excel → campo del DailyRecord.
 * Ajustar los nombres a los encabezados reales de la hoja METROSCUB.
 */
export const COLUMN_MAP = {
  fecha: 'FECHA',
  pozos: {
    pozo1: 'POZO_1',
    pozo2: 'POZO_2',
    pozo3: 'POZO_3',
    pozo1b: 'POZO_1B',
  },
  nano: {
    alimentacion: 'NF_ALIMENTACION',
    permeado: 'NF_PERMEADO',
    rechazo: 'NF_RECHAZO',
  },
  wur: {
    alimentacion: 'WUR_ALIMENTACION',
    recuperada: 'WUR_PERMEADO',
  },
  ro: {
    alimentacion: 'RO_ALIMENTACION',
    permeado: 'RO_PERMEADO',
  },
  cip: { cip: 'CIP', enjuague: 'ENJUAGUE' },
  lineas: {
    linea1: { agua: 'L1_AGUA', produccion: 'L1_PROD' },
    linea2: { agua: 'L2_AGUA', produccion: 'L2_PROD' },
    linea3: { agua: 'L3_AGUA', produccion: 'L3_PROD' },
    linea4: { agua: 'L4_AGUA', produccion: 'L4_PROD' },
    linea5: { agua: 'L5_AGUA', produccion: 'L5_PROD' },
    linea11: { agua: 'L11_AGUA', produccion: 'L11_PROD' },
    oneWay: { agua: 'OW_AGUA', produccion: 'OW_PROD' },
    linea10: { agua: 'L10_AGUA', produccion: 'L10_PROD' },
  },
  servicios: {
    torres: 'TORRES',
    calderas: 'CALDERAS',
    cip: 'CIP',
    sanitarios: 'SANITARIOS',
    riego: 'RIEGO',
    otros: 'OTROS_SERVICIOS',
  },
  aguaPotable: {
    produccion: 'AP_PRODUCCION',
    consumo: 'AP_CONSUMO',
    destinos: {
      proceso: 'AP_PROCESO',
      servicios: 'AP_SERVICIOS',
      casino: 'AP_CASINO',
      sanitarios: 'AP_SANITARIOS',
    },
  },
  elaboracion: { agua: 'ELAB_AGUA', produccion: 'ELAB_PROD' },
};

/* Archivos cargados en memoria: Map<'YYYY-MM', DailyRecord[]> */
const loadedMonths = new Map();
let lastUpdated = null;

/**
 * Parsea un workbook y registra sus días en memoria.
 * Implementar con `xlsx` (SheetJS):
 *
 *   import * as XLSX from 'xlsx';
 *   const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
 *   const rows = XLSX.utils.sheet_to_json(wb.Sheets['METROSCUB']);
 *   rows.forEach((row) => { ...mapear según COLUMN_MAP... });
 */
export async function parseWorkbook(/* arrayBuffer, fileName */) {
  throw new Error(
    'excelProvider: parseWorkbook() pendiente de implementación. ' +
      'Instala `xlsx` y completa el mapeo COLUMN_MAP.'
  );
}

/** Registra registros ya parseados (útil también para tests). */
export function registerRecords(records) {
  for (const rec of records) {
    const key = rec.date.slice(0, 7);
    if (!loadedMonths.has(key)) loadedMonths.set(key, []);
    loadedMonths.get(key).push(rec);
  }
  lastUpdated = new Date().toISOString();
}

const excelProvider = {
  name: 'excel',

  async getDailyRecords(startISO, endISO) {
    const out = [];
    for (const records of loadedMonths.values()) {
      for (const rec of records) {
        if (rec.date >= startISO && rec.date <= endISO) out.push(rec);
      }
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
  },

  async getAvailableRange() {
    let min = null;
    let max = null;
    for (const records of loadedMonths.values()) {
      for (const rec of records) {
        if (!min || rec.date < min) min = rec.date;
        if (!max || rec.date > max) max = rec.date;
      }
    }
    return { min, max };
  },

  async getLastUpdated() {
    return lastUpdated;
  },
};

export default excelProvider;
