/**
 * Entry del smoke de render (cargado vía Vite SSR para resolver JSX/CJS).
 * Exporta runAll(): ejecuta cada caso y devuelve [{ name, pass, detail }].
 */
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { DashboardProvider } from '../src/context/DashboardContext';
import AppLayout from '../src/layout/AppLayout';
import KpiCard from '../src/components/KpiCard';
import DataTable from '../src/components/DataTable';
import { ChartTooltip } from '../src/charts/chartCommon';
import { KPI_DEFS } from '../src/config/metrics';
import TrendChart from '../src/charts/TrendChart';
import AreaTrendChart from '../src/charts/AreaTrendChart';
import BarsChart from '../src/charts/BarsChart';
import DonutChart from '../src/charts/DonutChart';
import RankingChart from '../src/charts/RankingChart';
import PeriodCompareChart from '../src/charts/PeriodCompareChart';
import PlantaGeneral from '../src/pages/PlantaGeneral';
import Retornable from '../src/pages/Retornable';
import OneWay from '../src/pages/OneWay';
import Linea10 from '../src/pages/Linea10';
import Servicios from '../src/pages/Servicios';
import AguaPotable from '../src/pages/AguaPotable';
import Elaboracion from '../src/pages/Elaboracion';

const wrap = (el) => h(MemoryRouter, null, h(DashboardProvider, null, el));

export function runAll() {
  const results = [];
  const test = (name, fn) => {
    try {
      const detail = fn();
      results.push({ name, pass: true, detail });
    } catch (err) {
      results.push({ name, pass: false, detail: err.message });
    }
  };

  const pages = {
    PlantaGeneral,
    Retornable,
    OneWay,
    Linea10,
    Servicios,
    AguaPotable,
    Elaboracion,
  };
  for (const [name, Page] of Object.entries(pages)) {
    test(`página ${name} renderiza`, () => {
      const html = renderToString(wrap(h(Page)));
      if (!html.includes('Cargando datos')) throw new Error('HTML inesperado');
    });
  }

  test('layout (sidebar + header con filtros)', () => {
    const html = renderToString(wrap(h(AppLayout)));
    if (!html.includes('AquaPlant') || !html.includes('Fecha inicial')) {
      throw new Error('layout incompleto');
    }
  });

  test('KpiCard: formato es-CL, semáforo y delta', () => {
    const html = renderToString(
      h(KpiCard, { def: KPI_DEFS.ratioAgua, value: 2.45, deltaPct: -3.2 })
    );
    if (!html.includes('2,45')) throw new Error('número sin formato es-CL');
    if (!html.includes('status-dot ok')) throw new Error('semáforo incorrecto');
    if (!html.includes('▼')) throw new Error('delta sin flecha');
  });

  test('ChartTooltip: fecha y número formateados', () => {
    const html = renderToString(
      h(ChartTooltip, {
        active: true,
        label: '2026-06-05',
        payload: [{ dataKey: 'a', name: 'Pozos', value: 1234.5, color: '#fff' }],
        unit: 'm³',
      })
    );
    if (!html.includes('05 jun 2026')) throw new Error('etiqueta de fecha');
    if (!html.includes('1.234,5')) throw new Error('número sin miles');
  });

  test('DataTable: orden inicial descendente', () => {
    const html = renderToString(
      h(DataTable, {
        initialSort: 'v',
        columns: [
          { key: 'n', label: 'Nombre' },
          { key: 'v', label: 'Valor', num: true },
        ],
        data: [
          { id: 'a', n: 'Fila A', v: 10 },
          { id: 'b', n: 'Fila B', v: 30 },
        ],
      })
    );
    if (html.indexOf('Fila B') > html.indexOf('Fila A')) throw new Error('no ordena');
  });

  const charts = [
    [TrendChart, 'TrendChart', { data: [{ date: '2026-06-01', a: 1 }], series: [{ key: 'a', name: 'A', color: '#fff' }] }],
    [AreaTrendChart, 'AreaTrendChart', { data: [{ date: '2026-06-01', a: 1 }], series: [{ key: 'a', name: 'A', color: '#fff' }] }],
    [BarsChart, 'BarsChart', { data: [{ month: '2026-06', a: 1 }], series: [{ key: 'a', name: 'A', color: '#fff' }] }],
    [DonutChart, 'DonutChart', { data: [{ id: 'x', nombre: 'X', agua: 5, color: '#fff', pct: 100 }] }],
    [RankingChart, 'RankingChart', { data: [{ id: 'x', nombre: 'X', agua: 5, color: '#fff', pct: 100 }] }],
    [PeriodCompareChart, 'PeriodCompareChart', { data: [{ idx: 1, actual: 2, anterior: 3 }] }],
  ];
  for (const [Chart, name, props] of charts) {
    test(`gráfico ${name} monta`, () => {
      renderToString(h(Chart, props));
    });
  }

  return results;
}
