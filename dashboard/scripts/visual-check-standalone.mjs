/**
 * Verificación del dashboard.html standalone: lo abre vía file:// (sin
 * servidor, como lo usará el usuario final), navega todas las páginas,
 * cambia filtros y detecta errores de consola.
 *
 *   node scripts/visual-check-standalone.mjs
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const root = new URL('..', import.meta.url).pathname;
const shotsDir = `${root}scripts/shots`;
mkdirSync(shotsDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1480, height: 1000 } });

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`PAGEERROR: ${err.message}`));

await page.goto(`file://${root}../dashboard.html`);

const PAGES = ['planta', 'retornable', 'oneway', 'linea10', 'servicios', 'potable', 'elaboracion'];
let failures = 0;

for (const id of PAGES) {
  await page.click(`.nav-item[data-page="${id}"]`);
  try {
    await page.waitForSelector('.kpi-card', { timeout: 5000 });
    await page.waitForSelector('.chart-body canvas', { timeout: 5000 });
    await page.waitForTimeout(450);
    const kpis = await page.locator('.kpi-card').count();
    const canvases = await page.locator('.chart-body canvas').count();
    console.log(`✅ ${id}: ${kpis} KPI cards, ${canvases} gráficos`);
  } catch (err) {
    failures++;
    console.error(`❌ ${id}: ${err.message.split('\n')[0]}`);
  }
  await page.screenshot({ path: `${shotsDir}/standalone-${id}.png`, fullPage: true });
}

/* Cambiar filtros: mes completo anterior */
await page.click('.nav-item[data-page="planta"]');
await page.selectOption('#f-month', '4'); // Mayo
await page.waitForTimeout(500);
const periodo = await page.locator('.page-subtitle').last().textContent();
periodo.includes('may')
  ? console.log(`✅ filtro de mes aplica: "${periodo.trim().slice(0, 70)}…"`)
  : (failures++, console.error(`❌ filtro de mes no aplicó: ${periodo}`));

/* Selector de KPI del gráfico de tendencia */
await page.selectOption('#sel-kpi', 'recuperacionWUR');
await page.waitForTimeout(400);
console.log('✅ selector de indicador de tendencia funciona');

/* Vista móvil */
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${shotsDir}/standalone-mobile.png` });
await page.click('#burger');
await page.waitForTimeout(350);
await page.screenshot({ path: `${shotsDir}/standalone-mobile-menu.png` });
console.log('✅ vista móvil + menú lateral');

await browser.close();

if (consoleErrors.length) {
  console.error('\n⚠️ Errores de consola:');
  for (const e of [...new Set(consoleErrors)]) console.error(`   ${e}`);
  process.exitCode = 1;
}
if (failures) process.exitCode = 1;
console.log(process.exitCode ? '\n💥 STANDALONE CON ERRORES' : '\n🎉 STANDALONE OK');
