/**
 * Smoke test de render: monta cada página y los componentes compartidos
 * con react-dom/server para detectar errores de runtime en el árbol React.
 * (Los gráficos Recharts montan su contenedor; su SVG interno solo se
 * dibuja en navegador, donde existe ResizeObserver.)
 *
 *   node scripts/smoke-render.mjs
 */
import { createServer } from 'vite';

const server = await createServer({
  root: new URL('..', import.meta.url).pathname,
  logLevel: 'silent',
  server: { middlewareMode: true },
});

try {
  const { runAll } = await server.ssrLoadModule('/scripts/smoke-render-entry.jsx');
  for (const r of runAll()) {
    if (r.pass) {
      console.log(`✅ ${r.name}`);
    } else {
      console.error(`❌ ${r.name}: ${r.detail}`);
      process.exitCode = 1;
    }
  }
} finally {
  await server.close();
}

console.log(process.exitCode ? '\n💥 SMOKE RENDER CON ERRORES' : '\n🎉 SMOKE RENDER OK');
