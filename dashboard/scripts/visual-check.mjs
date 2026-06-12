/**
 * Verificación visual con Playwright sobre el build de producción:
 * sirve dist/, recorre todas las rutas, detecta errores de consola y
 * guarda una captura de cada página en scripts/shots/.
 *
 *   node scripts/visual-check.mjs
 */
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

// playwright está instalado globalmente en el entorno (no es dependencia
// del proyecto): se carga por ruta absoluta.
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const root = new URL('..', import.meta.url).pathname;
const shotsDir = `${root}scripts/shots`;
mkdirSync(shotsDir, { recursive: true });

const server = await createServer({
  root,
  logLevel: 'silent',
  server: { port: 5199, strictPort: true },
});
await server.listen();

const ROUTES = [
  ['planta-general', '/'],
  ['retornable', '/retornable'],
  ['one-way', '/one-way'],
  ['linea-10', '/linea-10'],
  ['servicios', '/servicios'],
  ['agua-potable', '/agua-potable'],
  ['elaboracion', '/elaboracion'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1480, height: 1000 } });

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`PAGEERROR: ${err.message}`));

let failures = 0;
for (const [name, route] of ROUTES) {
  await page.goto(`http://localhost:5199/#${route}`);
  // Espera a que termine la carga y aparezcan tarjetas y SVGs de gráficos.
  try {
    await page.waitForSelector('.kpi-card', { timeout: 8000 });
    await page.waitForSelector('.chart-card svg.recharts-surface', { timeout: 8000 });
    await page.waitForTimeout(500); // animaciones
    const kpis = await page.locator('.kpi-card').count();
    const charts = await page.locator('svg.recharts-surface').count();
    console.log(`✅ ${name}: ${kpis} KPI cards, ${charts} gráficos renderizados`);
  } catch (err) {
    failures++;
    console.error(`❌ ${name}: ${err.message.split('\n')[0]}`);
  }
  await page.screenshot({ path: `${shotsDir}/${name}.png`, fullPage: true });
}

// Vista móvil de la página principal (menú colapsado)
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://localhost:5199/#/');
await page.waitForSelector('.kpi-card', { timeout: 8000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${shotsDir}/mobile-planta.png` });
await page.click('.header-burger');
await page.waitForTimeout(350);
await page.screenshot({ path: `${shotsDir}/mobile-menu.png` });
console.log('✅ vista móvil capturada (dashboard + menú lateral)');

await browser.close();
await server.close();

if (consoleErrors.length) {
  console.error('\n⚠️ Errores de consola del navegador:');
  for (const e of [...new Set(consoleErrors)]) console.error(`   ${e}`);
  process.exitCode = 1;
}
if (failures) process.exitCode = 1;
console.log(process.exitCode ? '\n💥 VISUAL CHECK CON ERRORES' : '\n🎉 VISUAL CHECK OK');
