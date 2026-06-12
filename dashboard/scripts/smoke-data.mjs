/**
 * Smoke test de la capa de datos: carga el mockProvider y transforms
 * a través de Vite (resuelve imports sin extensión) y valida invariantes.
 *
 *   node scripts/smoke-data.mjs
 */
import { createServer } from 'vite';

const server = await createServer({
  root: new URL('..', import.meta.url).pathname,
  logLevel: 'silent',
  server: { middlewareMode: true },
});

const fail = (msg) => {
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
};
const ok = (msg) => console.log(`✅ ${msg}`);

try {
  const { default: mock } = await server.ssrLoadModule(
    '/src/services/providers/mockProvider.js'
  );
  const t = await server.ssrLoadModule('/src/services/transforms.js');
  const dates = await server.ssrLoadModule('/src/utils/dates.js');

  // 1. Registros diarios del rango
  const records = await mock.getDailyRecords('2026-06-01', '2026-06-12');
  records.length === 12
    ? ok(`getDailyRecords devuelve 12 registros`)
    : fail(`esperaba 12 registros, llegaron ${records.length}`);

  // 2. Determinismo
  const again = await mock.getDailyRecords('2026-06-05', '2026-06-05');
  JSON.stringify(again[0]) === JSON.stringify(records[4])
    ? ok('generación determinista (mismo día → mismos valores)')
    : fail('datos no deterministas');

  // 3. KPIs de planta en rangos plausibles
  const k = t.computePlantKpis(records);
  console.log('   KPIs:', JSON.stringify(k, (_, v) => (typeof v === 'number' ? +v.toFixed(2) : v)));
  (k.ratioAgua > 1.2 && k.ratioAgua < 3.5) ? ok('ratio agua/bebida plausible') : fail(`ratio fuera de rango: ${k.ratioAgua}`);
  (k.rechazoNano > 10 && k.rechazoNano < 35) ? ok('% rechazo Nano plausible') : fail(`rechazo: ${k.rechazoNano}`);
  (k.recuperacionWUR > 55 && k.recuperacionWUR < 95) ? ok('% recuperación WUR plausible') : fail(`WUR: ${k.recuperacionWUR}`);
  (k.eficienciaRO > 60 && k.eficienciaRO < 95) ? ok('eficiencia RO plausible') : fail(`RO: ${k.eficienciaRO}`);

  // 4. Coherencia interna de un registro
  const r = records[0];
  const nanoSum = Math.abs(r.nano.permeado + r.nano.rechazo - r.nano.alimentacion);
  nanoSum < 0.5 ? ok('balance NF: permeado + rechazo ≈ alimentación') : fail(`balance NF descuadrado en ${nanoSum}`);
  const destSum = Object.values(r.aguaPotable.destinos).reduce((a, b) => a + b, 0);
  Math.abs(destSum - r.aguaPotable.consumo) < 0.5
    ? ok('destinos de agua potable suman el consumo')
    : fail(`destinos=${destSum} vs consumo=${r.aguaPotable.consumo}`);

  // 5. Series y comparaciones
  const prevRange = dates.previousPeriod('2026-06-01', '2026-06-12');
  prevRange.start === '2026-05-20' && prevRange.end === '2026-05-31'
    ? ok('período anterior calculado correctamente')
    : fail(`período anterior: ${JSON.stringify(prevRange)}`);

  const prev = await mock.getDailyRecords(prevRange.start, prevRange.end);
  const cmp = t.withComparison(t.computePlantKpis(records), t.computePlantKpis(prev));
  cmp.ratioAgua.deltaPct !== null ? ok('deltas vs período anterior disponibles') : fail('delta nulo');

  const aligned = t.alignPeriods(records, prev, t.totalPozos);
  aligned.length === 12 && aligned[0].actual && aligned[0].anterior
    ? ok('alineación de períodos OK')
    : fail('alignPeriods inconsistente');

  const ranking = t.consumerRanking(records);
  const pctTotal = ranking.reduce((a, i) => a + i.pct, 0);
  Math.abs(pctTotal - 100) < 0.1 && ranking[0].agua >= ranking.at(-1).agua
    ? ok(`ranking de ${ranking.length} consumidores, participaciones suman 100 %`)
    : fail(`ranking: pct=${pctTotal}`);

  const monthly = t.monthlySeries(
    await mock.getDailyRecords('2025-07-01', '2026-06-12'),
    { pozos: t.totalPozos }
  );
  monthly.length === 12 ? ok('serie mensual de 12 meses') : fail(`meses: ${monthly.length}`);

  // 6. Rango disponible y última actualización
  const range = await mock.getAvailableRange();
  range.min === '2025-01-01' ? ok(`rango disponible ${range.min} → ${range.max}`) : fail('rango inválido');
  (await mock.getLastUpdated()) ? ok('última actualización disponible') : fail('sin lastUpdated');
} finally {
  await server.close();
}

console.log(process.exitCode ? '\n💥 SMOKE TEST CON ERRORES' : '\n🎉 SMOKE TEST OK');
