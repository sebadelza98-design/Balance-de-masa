/* ════════════════════════════════════════════════════════════════════════
   aquaplant-db.js · Capa de persistencia con IndexedDB para AquaPlant
   ════════════════════════════════════════════════════════════════════════

   Qué hace este archivo (las 5 capacidades solicitadas):

     1. CREAR LA BASE  · al cargar el dashboard se abre/crea una base
        IndexedDB llamada  "Planda de agua"  con un almacén (tabla)
        llamado  "registro".
     2. GUARDAR DATOS DEL EXCEL · guardar(registro) / guardarMuchos([...]).
     3. CONSULTAR TODOS · todos()  → devuelve todos los registros ordenados.
     4. EVITAR DUPLICADOS · la clave única es la FECHA ("YYYY-MM-DD").
        Se usa put(): si la fecha no existe → inserta; si ya existe →
        actualiza. Así cargar dos veces el mismo mes NO duplica filas.
     5. LEER EXCEL · leerExcel(file) lee un .xlsx con SheetJS (XLSX).
        Detecta automáticamente:
          · Hoja "METROSCUB" (fechas en una fila, etiquetas en la columna B)
            — formato del "Mapa de Agua" del proyecto (ver data_loader.py).
          · Cualquier hoja tabular (1ª fila = encabezados, una fila por día).

   API pública (global  window.AquaPlantDB):

     await AquaPlantDB.abrir()                  → IDBDatabase
     await AquaPlantDB.guardar(registro)        → { insertados, actualizados }
     await AquaPlantDB.guardarMuchos(registros) → { insertados, actualizados, total }
     await AquaPlantDB.todos()                  → [registro, ...] (ordenado por fecha)
     await AquaPlantDB.porFecha("2026-05-01")   → registro | undefined
     await AquaPlantDB.claves()                 → ["2026-05-01", ...]
     await AquaPlantDB.contar()                 → número de registros
     await AquaPlantDB.borrar("2026-05-01")     → void
     await AquaPlantDB.borrarTodo()             → void
     await AquaPlantDB.leerExcel(file)          → [registro, ...] (sin guardar)
     await AquaPlantDB.importar(file)           → { insertados, actualizados, total, registros }
     AquaPlantDB.on("cambio", fn)               → escucha cambios (tras importar/guardar)

   Uso rápido desde consola:
     const recs = await AquaPlantDB.todos();
   ════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ──────────────── Configuración de la base ──────────────── */
  const DB_NAME = 'Planda de agua'; // nombre solicitado (posible typo de "Planta")
  const DB_VERSION = 1;
  const STORE = 'registro';         // almacén/tabla
  const KEY = 'date';               // clave única = fecha ISO "YYYY-MM-DD"

  /* ════════════════ 1. Abrir / crear la base ════════════════ */
  let _dbPromise = null;

  function abrir() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise(function (resolve, reject) {
      if (!('indexedDB' in global)) {
        reject(new Error('Este navegador no soporta IndexedDB.'));
        return;
      }
      const req = global.indexedDB.open(DB_NAME, DB_VERSION);
      // Se ejecuta sólo cuando la base no existe o cambia de versión:
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          // keyPath: "date" → cada registro se identifica por su fecha.
          db.createObjectStore(STORE, { keyPath: KEY });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return _dbPromise;
  }

  /* Helpers internos de transacción/petición */
  function _store(mode) {
    return abrir().then(function (db) {
      const tx = db.transaction(STORE, mode);
      return { tx: tx, store: tx.objectStore(STORE) };
    });
  }
  function _req(request) {
    return new Promise(function (res, rej) {
      request.onsuccess = function () { res(request.result); };
      request.onerror = function () { rej(request.error); };
    });
  }
  function _txDone(tx) {
    return new Promise(function (res, rej) {
      tx.oncomplete = function () { res(); };
      tx.onerror = function () { rej(tx.error); };
      tx.onabort = function () { rej(tx.error); };
    });
  }

  /* ════════════════ 2. Guardar (upsert por fecha) ════════════════ */
  // guardarMuchos: inserta los nuevos y actualiza los existentes en una
  // sola transacción. Reporta cuántos se insertaron vs. actualizaron.
  async function guardarMuchos(registros) {
    const norm = (registros || []).map(_normalizarClave).filter(function (r) { return r.date; });
    if (!norm.length) return { insertados: 0, actualizados: 0, total: 0 };

    // Averiguar qué fechas ya existen (para el reporte insertados/actualizados).
    const existentes = new Set(await claves());

    const ref = await _store('readwrite');
    let insertados = 0, actualizados = 0;
    for (const r of norm) {
      if (existentes.has(r.date)) {
        actualizados++;
      } else {
        insertados++;
        existentes.add(r.date);
      }
      ref.store.put(r); // put = inserta o reemplaza según la clave (date)
    }
    await _txDone(ref.tx);

    const res = { insertados: insertados, actualizados: actualizados, total: norm.length };
    _emit('cambio', res);
    return res;
  }

  // guardar: azúcar para un único registro.
  function guardar(registro) {
    return guardarMuchos([registro]);
  }

  /* ════════════════ 3. Consultar registros ════════════════ */
  async function todos() {
    const ref = await _store('readonly');
    const arr = await _req(ref.store.getAll());
    return arr.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  async function porFecha(fecha) {
    const ref = await _store('readonly');
    return _req(ref.store.get(_iso(fecha) || fecha));
  }
  async function claves() {
    const ref = await _store('readonly');
    return _req(ref.store.getAllKeys());
  }
  async function contar() {
    const ref = await _store('readonly');
    return _req(ref.store.count());
  }

  /* Borrado (utilidades) */
  async function borrar(fecha) {
    const ref = await _store('readwrite');
    ref.store.delete(_iso(fecha) || fecha);
    await _txDone(ref.tx);
    _emit('cambio', { borrado: fecha });
  }
  async function borrarTodo() {
    const ref = await _store('readwrite');
    ref.store.clear();
    await _txDone(ref.tx);
    _emit('cambio', { vaciado: true });
  }

  /* ════════════════ 4. Evitar duplicados — clave única ════════════════
     La clave es "date". Garantizamos que cada registro tenga una fecha ISO
     válida antes de guardarlo; si no la tiene, no se guarda (filtrado). */
  function _normalizarClave(registro) {
    const r = Object.assign({}, registro);
    if (r.date != null && r.date !== '') {
      r.date = _iso(r.date) || String(r.date);
    } else {
      // Buscar una columna de fecha con nombre alternativo.
      const alt = ['fecha', 'Fecha', 'FECHA', 'dia', 'día', 'Día', 'DIA'];
      for (const k of alt) {
        if (r[k] != null && r[k] !== '') { r.date = _iso(r[k]); break; }
      }
    }
    return r;
  }

  /* ════════════════ 5. Leer Excel ════════════════ */
  // Etiquetas reconocidas en la hoja METROSCUB (col B). Mismo conjunto que
  // data_loader.py del proyecto, para que la lectura sea coherente con el
  // pipeline de Python.
  const METROSCUB_LABELS = [
    'Consumo pozos', 'Agua Potable (25%)',
    'Retroavado F. Azud',
    'Tanque Recuperacion TK300', 'Retrolavado FFMM',
    'Total Nano', 'Rechazo nano',
    'WUR 1 Entrada', 'WUR 1 Permeado', 'WUR 1 Rechazo',
    'WUR 2 Entrada T810', 'WUR 2 Permeado', 'WUR 2 Rechazo',
    'CIP', 'ENJUAGUE DE LINEAS',
    'Agua Servicio', 'Zona humeda', 'Torres Enfriamiento', 'Condensadores Evaporativos',
  ];

  async function leerExcel(file) {
    const XLSX = await _cargarSheetJS();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    // Preferir la hoja METROSCUB del "Mapa de Agua"; si no, primera hoja.
    if (wb.SheetNames.indexOf('METROSCUB') !== -1) {
      return _parseMetroscub(XLSX, wb.Sheets['METROSCUB']);
    }
    const hoja = wb.Sheets[wb.SheetNames[0]];
    return _parseTabular(XLSX, hoja);
  }

  // Lee + guarda en un solo paso. Devuelve el resumen + los registros leídos.
  async function importar(file) {
    const registros = await leerExcel(file);
    const res = await guardarMuchos(registros);
    res.registros = registros;
    return res;
  }

  /* ─── Parser METROSCUB (fechas en fila 3, etiquetas en columna B) ─── */
  function _parseMetroscub(XLSX, ws) {
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

    // Fila de fechas: data_loader.py usa la fila 3 (índice 2). Con respaldo:
    // si ahí no hay fechas, buscamos en las primeras filas.
    let dateRow = 2;
    let dateCols = _detectarColumnasFecha(aoa, dateRow);
    if (dateCols.length === 0) {
      for (let r = 0; r < Math.min(aoa.length, 12); r++) {
        const cols = _detectarColumnasFecha(aoa, r);
        if (cols.length >= 2) { dateRow = r; dateCols = cols; break; }
      }
    }
    if (dateCols.length === 0) {
      throw new Error('Hoja METROSCUB: no se encontraron fechas (fila 3 / columna C en adelante).');
    }

    const LABEL_COL = 1; // columna B
    const conocidas = new Set(METROSCUB_LABELS);
    const filasEtiqueta = [];
    for (let r = dateRow + 1; r < aoa.length; r++) {
      const fila = aoa[r];
      if (!fila) continue;
      const etiqueta = fila[LABEL_COL];
      if (etiqueta == null) continue;
      const key = String(etiqueta).trim();
      if (conocidas.has(key)) filasEtiqueta.push({ r: r, key: key });
    }

    const registros = [];
    for (const dc of dateCols) {
      const raw = {};
      for (const fe of filasEtiqueta) {
        const v = aoa[fe.r][dc.col];
        if (typeof v === 'number' && isFinite(v) && v > 0) raw[fe.key] = v;
      }
      if (Object.keys(raw).length === 0) continue;
      registros.push({
        date: dc.date,
        origen: 'METROSCUB',
        raw: raw,                  // valores leídos (m³/día)
        flows: _rawToFlows(raw),   // caudales por corriente (m³/h), como data_loader.py
      });
    }
    return registros;
  }

  // Detecta columnas (≥ índice 2) cuya celda en la fila r es una fecha.
  function _detectarColumnasFecha(aoa, r) {
    const fila = aoa[r] || [];
    const cols = [];
    for (let c = 2; c < fila.length; c++) {
      const v = fila[c];
      let iso = null;
      if (v instanceof Date) iso = _iso(v);
      else if (typeof v === 'string' && /\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(v)) iso = _iso(v);
      if (iso) cols.push({ col: c, date: iso });
    }
    return cols;
  }

  // Convierte etiquetas brutas (m³/día) → caudales por corriente (m³/h).
  // Puerto fiel de data_loader.py._raw_to_flows (plant_config v2.0).
  function _rawToFlows(raw) {
    const m3h = function (m3dia) { return Math.round((m3dia / 24) * 1000) / 1000; };
    const get = function (k) { return typeof raw[k] === 'number' ? raw[k] : 0; };
    const has = function (k) { return typeof raw[k] === 'number'; };
    const flows = {};

    if (has('Consumo pozos')) flows.S01 = m3h(raw['Consumo pozos']);
    if (has('Agua Potable (25%)')) flows.S02 = m3h(raw['Agua Potable (25%)']);
    if (has('Retroavado F. Azud')) flows.S04 = m3h(raw['Retroavado F. Azud'] * 2);
    if (has('Tanque Recuperacion TK300')) flows.S05 = m3h(raw['Tanque Recuperacion TK300']);
    if (has('WUR 2 Permeado')) flows.S06 = m3h(raw['WUR 2 Permeado']);
    if (has('Total Nano')) flows.S08 = m3h(raw['Total Nano']);
    if (has('Retrolavado FFMM') && has('Tanque Recuperacion TK300')) {
      const retroDrain = raw['Retrolavado FFMM'] - raw['Tanque Recuperacion TK300'];
      if (retroDrain > 0) flows.S10 = m3h(retroDrain);
    }
    const wur1Ent = get('WUR 1 Entrada');
    if (wur1Ent > 0) flows.S12 = m3h(wur1Ent);
    const recNano = get('Rechazo nano');
    if (recNano > 0 && wur1Ent > 0) {
      const directo = Math.max(0, recNano - wur1Ent);
      if (directo > 0) flows.S13 = m3h(directo);
    }
    if (has('WUR 1 Permeado')) flows.S14 = m3h(raw['WUR 1 Permeado']);
    if (has('WUR 2 Rechazo')) flows.S27 = m3h(raw['WUR 2 Rechazo']);
    const cipTotal = get('CIP') + get('ENJUAGUE DE LINEAS');
    const cipRecovery = get('WUR 2 Permeado') + get('WUR 2 Rechazo');
    if (cipTotal > 0) flows.S22 = m3h(Math.max(0, cipTotal - cipRecovery));
    if (cipRecovery > 0) flows.S23 = m3h(cipRecovery);
    return flows;
  }

  /* ─── Parser tabular genérico (1ª fila = encabezados) ─── */
  function _parseTabular(XLSX, ws) {
    const filas = XLSX.utils.sheet_to_json(ws, { raw: true, defval: null });
    if (!filas.length) throw new Error('La hoja no contiene filas de datos.');
    const cols = Object.keys(filas[0]);
    let dateKey = cols.find(function (k) { return /fecha|date|d[ií]a/i.test(k); });
    if (!dateKey) dateKey = _primeraColumnaFecha(filas, cols);
    if (!dateKey) throw new Error('No se encontró una columna de fecha en el Excel.');

    const out = [];
    for (const fila of filas) {
      const date = _iso(fila[dateKey]);
      if (!date) continue;
      const rec = { date: date, origen: 'tabular' };
      for (const k of cols) {
        if (k === dateKey) continue;
        rec[k] = fila[k];
      }
      out.push(rec);
    }
    return out;
  }
  function _primeraColumnaFecha(filas, cols) {
    for (const k of cols) {
      let ok = 0, n = 0;
      for (const f of filas.slice(0, 8)) { if (f[k] != null) { n++; if (_iso(f[k])) ok++; } }
      if (n > 0 && ok === n) return k;
    }
    return null;
  }

  /* ─── Carga perezosa de SheetJS (XLSX) ─── */
  let _xlsxPromise = null;
  function _cargarSheetJS() {
    if (global.XLSX) return Promise.resolve(global.XLSX);
    if (_xlsxPromise) return _xlsxPromise;
    // Orden de intento: copia local (offline) → CDN oficial → jsDelivr.
    const fuentes = [
      './xlsx.full.min.js',
      'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
      'https://cdn.jsdelivr.net/npm/xlsx@0.20.3/dist/xlsx.full.min.js',
    ];
    _xlsxPromise = fuentes
      .reduce(function (p, url) { return p.catch(function () { return _inyectarScript(url); }); }, Promise.reject())
      .then(function () {
        if (!global.XLSX) throw new Error('No se pudo cargar SheetJS (XLSX).');
        return global.XLSX;
      })
      .catch(function (e) {
        _xlsxPromise = null; // permitir reintento posterior
        throw new Error('No se pudo cargar la librería para leer Excel (SheetJS). ' +
          'Conéctate a internet una vez, o coloca "xlsx.full.min.js" junto a este archivo. ' +
          'Detalle: ' + e.message);
      });
    return _xlsxPromise;
  }
  function _inyectarScript(src) {
    return new Promise(function (res, rej) {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error('No se pudo cargar ' + src)); };
      document.head.appendChild(s);
    });
  }

  /* ─── Normalización de fechas a ISO "YYYY-MM-DD" ─── */
  const _p = function (n) { return String(n).padStart(2, '0'); };
  const _fmt = function (d) { return d.getFullYear() + '-' + _p(d.getMonth() + 1) + '-' + _p(d.getDate()); };
  const _fmtUTC = function (d) { return d.getUTCFullYear() + '-' + _p(d.getUTCMonth() + 1) + '-' + _p(d.getUTCDate()); };

  function _iso(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : _fmt(value);
    if (typeof value === 'number' && isFinite(value)) {
      // Número de serie de Excel (días desde 1899-12-30).
      const ms = Math.round((value - 25569) * 86400 * 1000);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : _fmtUTC(d);
    }
    if (typeof value === 'string') {
      const s = value.trim();
      let m;
      if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {       // YYYY-MM-DD
        return m[1] + '-' + _p(m[2]) + '-' + _p(m[3]);
      }
      if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) {       // DD-MM-YYYY (día primero, es-CL)
        return m[3] + '-' + _p(m[2]) + '-' + _p(m[1]);
      }
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : _fmt(d);
    }
    return null;
  }

  /* ─── Mini bus de eventos (para que la UI se refresque sola) ─── */
  const _listeners = {};
  function on(evt, fn) { (_listeners[evt] || (_listeners[evt] = [])).push(fn); return function () { off(evt, fn); }; }
  function off(evt, fn) {
    const a = _listeners[evt]; if (!a) return;
    const i = a.indexOf(fn); if (i !== -1) a.splice(i, 1);
  }
  function _emit(evt, data) {
    (_listeners[evt] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } });
  }

  /* ─── API pública ─── */
  global.AquaPlantDB = {
    DB_NAME: DB_NAME, STORE: STORE, KEY: KEY, VERSION: DB_VERSION,
    abrir: abrir,
    guardar: guardar,
    guardarMuchos: guardarMuchos,
    todos: todos,
    porFecha: porFecha,
    claves: claves,
    contar: contar,
    borrar: borrar,
    borrarTodo: borrarTodo,
    leerExcel: leerExcel,
    importar: importar,
    rawToFlows: _rawToFlows, // utilidad expuesta (m³/día → m³/h)
    iso: _iso,               // utilidad de normalización de fecha
    on: on,
    off: off,
  };

  /* ════════════════ 1 (bis). Crear la base al cargar ════════════════
     Cumple "Crear la base de datos cuando se abre el dashboard". */
  abrir().catch(function (e) { console.warn('[AquaPlantDB] No se pudo abrir la base:', e); });

})(typeof window !== 'undefined' ? window : this);
