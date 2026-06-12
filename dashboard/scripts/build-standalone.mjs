/**
 * Ensambla el dashboard standalone (un solo archivo HTML autocontenido)
 * a partir de standalone/{template.html, styles.css, app.js} + Chart.js
 * UMD embebido. Salida: ../dashboard.html (raíz del repositorio).
 *
 *   npm run build:standalone
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(root + p, 'utf8');

const template = read('standalone/template.html');
const css = read('standalone/styles.css');
const app = read('standalone/app.js');
const chartjs = read('node_modules/chart.js/dist/chart.umd.js');

for (const [name, code] of [['app.js', app], ['chart.umd.js', chartjs], ['styles.css', css]]) {
  if (code.includes('</script')) {
    throw new Error(`${name} contiene '</script>' y rompería el HTML embebido`);
  }
}

const html = template
  .replace('/*__CSS__*/', () => css)
  .replace('/*__CHARTJS__*/', () => chartjs)
  .replace('/*__APP__*/', () => app);

const out = fileURLToPath(new URL('../../dashboard.html', import.meta.url));
writeFileSync(out, html);
console.log(`✅ generado ${out} (${(html.length / 1024).toFixed(0)} KB)`);
