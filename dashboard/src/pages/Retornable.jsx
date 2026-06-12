import { useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useHistoricalRecords } from '../hooks/useHistoricalRecords';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import DeltaBadge from '../components/DeltaBadge';
import TrendChart from '../charts/TrendChart';
import AreaTrendChart from '../charts/AreaTrendChart';
import BarsChart from '../charts/BarsChart';
import RankingChart from '../charts/RankingChart';
import {
  cumulativeSeries,
  dailySeries,
  deltaPct,
  monthlySeries,
  retornableTotals,
} from '../services/transforms';
import { LINEAS_RETORNABLES } from '../config/plant';
import { LINE_RATIO_THRESHOLDS, evalStatus } from '../config/metrics';
import { fmt } from '../utils/format';

const lineSelectors = Object.fromEntries(
  LINEAS_RETORNABLES.map((l) => [l.id, (rec) => rec.lineas[l.id]?.agua ?? 0])
);

const RATIO_DEF = { direction: 'below', ...LINE_RATIO_THRESHOLDS };

export default function Retornable() {
  const { records, prevRecords, loading, error } = useDashboard();
  const historical = useHistoricalRecords(12);

  const totals = useMemo(() => retornableTotals(records), [records]);
  const prevTotals = useMemo(() => retornableTotals(prevRecords), [prevRecords]);

  const aguaTotal = totals.reduce((a, t) => a + t.agua, 0);
  const prodTotal = totals.reduce((a, t) => a + t.produccion, 0);
  const aguaPrev = prevTotals.reduce((a, t) => a + t.agua, 0);
  const prodPrev = prevTotals.reduce((a, t) => a + t.produccion, 0);
  const ratio = prodTotal > 0 ? aguaTotal / prodTotal : null;
  const ratioPrev = prodPrev > 0 ? aguaPrev / prodPrev : null;

  const mejorLinea = useMemo(() => {
    const conRatio = totals.filter((t) => t.ratio !== null && t.produccion > 0);
    if (!conRatio.length) return null;
    return conRatio.reduce((a, b) => (a.ratio < b.ratio ? a : b));
  }, [totals]);

  const daily = useMemo(() => dailySeries(records, lineSelectors), [records]);
  const cumulative = useMemo(
    () => cumulativeSeries(records, lineSelectors),
    [records]
  );
  const monthly = useMemo(
    () => monthlySeries(historical.records, lineSelectors),
    [historical.records]
  );

  const series = LINEAS_RETORNABLES.map((l) => ({
    key: l.id,
    name: l.nombre,
    color: l.color,
  }));

  const compareData = useMemo(
    () =>
      totals.map((t) => ({
        name: t.nombre.replace('Línea ', 'L'),
        agua: t.agua,
        produccion: t.produccion,
      })),
    [totals]
  );

  const ranking = useMemo(() => {
    const total = aguaTotal || 1;
    return [...totals]
      .sort((a, b) => b.agua - a.agua)
      .map((t) => ({ ...t, pct: (t.agua / total) * 100 }));
  }, [totals, aguaTotal]);

  const tableRows = useMemo(
    () =>
      totals.map((t) => {
        const prev = prevTotals.find((p) => p.id === t.id);
        return {
          id: t.id,
          nombre: t.nombre,
          color: t.color,
          agua: t.agua,
          produccion: t.produccion,
          ratio: t.ratio,
          delta: deltaPct(t.agua, prev?.agua ?? null),
          status: evalStatus(t.ratio, RATIO_DEF),
        };
      }),
    [totals, prevTotals]
  );

  if (loading || error || !records.length) {
    return (
      <div className="page">
        <PageHeader title="Líneas Retornables" />
        <PageState loading={loading} error={error} empty={!records.length} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Líneas Retornables"
        subtitle="Líneas 1 · 2 · 3 · 4 · 5 · 11 — lavado y envasado retornable"
      />

      <div className="kpi-grid">
        <KpiCard
          label="Consumo de agua"
          unit="m³"
          accent="#3b82f6"
          value={aguaTotal}
          deltaPct={deltaPct(aguaTotal, aguaPrev)}
          def={{ deltaGood: 'down' }}
        />
        <KpiCard
          label="Bebida producida"
          unit="m³"
          accent="#4ade80"
          value={prodTotal}
          deltaPct={deltaPct(prodTotal, prodPrev)}
          def={{ deltaGood: 'up' }}
        />
        <KpiCard
          label="Ratio agua / bebida"
          unit="L/L"
          decimals={2}
          accent="#22d3ee"
          value={ratio}
          deltaPct={deltaPct(ratio, ratioPrev)}
          def={{ direction: 'below', ...LINE_RATIO_THRESHOLDS, decimals: 2, unit: 'L/L' }}
        />
        <KpiCard
          label="Línea más eficiente"
          unit=""
          accent="#facc15"
          value={mejorLinea?.ratio}
          decimals={2}
          subtitle={mejorLinea ? `${mejorLinea.nombre} · L/L` : 'Sin producción'}
        />
      </div>

      <div className="chart-grid">
        <ChartCard
          span={7}
          title="Consumo diario de agua por línea"
          subtitle="m³/día dentro del período seleccionado"
        >
          <TrendChart data={daily} series={series} height={310} />
        </ChartCard>

        <ChartCard
          span={5}
          title="Consumo acumulado del período"
          subtitle="Acumulado por línea (m³)"
        >
          <AreaTrendChart data={cumulative} series={series} stacked height={310} />
        </ChartCard>

        <ChartCard
          span={7}
          title="Comparación entre líneas"
          subtitle="Agua consumida vs bebida producida en el período"
        >
          <BarsChart
            data={compareData}
            series={[
              { key: 'agua', name: 'Agua (m³)', color: '#3b82f6' },
              { key: 'produccion', name: 'Producción (m³)', color: '#4ade80' },
            ]}
            xType="category"
            decimals={0}
            height={300}
          />
        </ChartCard>

        <ChartCard
          span={5}
          title="Ranking de consumo"
          subtitle="Líneas ordenadas por consumo de agua (m³)"
        >
          <RankingChart data={ranking} height={300} />
        </ChartCard>

        <ChartCard
          span={7}
          title="Tendencia histórica mensual"
          subtitle="Consumo mensual de agua por línea · últimos 12 meses"
        >
          {historical.loading ? (
            <PageState loading />
          ) : (
            <TrendChart data={monthly} series={series} xType="month" decimals={0} height={310} />
          )}
        </ChartCard>

        <ChartCard
          span={5}
          title="Indicadores de eficiencia"
          subtitle="Ratio objetivo ≤ 1,9 L/L · alerta ≤ 2,4 L/L"
        >
          <DataTable
            initialSort="agua"
            columns={[
              {
                key: 'nombre',
                label: 'Línea',
                render: (r) => (
                  <span className="row-label">
                    <span className="row-swatch" style={{ background: r.color }} />
                    {r.nombre}
                  </span>
                ),
              },
              { key: 'agua', label: 'Agua m³', num: true, render: (r) => fmt(r.agua, 0) },
              { key: 'produccion', label: 'Prod. m³', num: true, render: (r) => fmt(r.produccion, 0) },
              { key: 'ratio', label: 'Ratio', num: true, render: (r) => fmt(r.ratio, 2) },
              {
                key: 'delta',
                label: 'Δ Agua',
                num: true,
                render: (r) => (
                  <DeltaBadge
                    deltaPct={r.delta}
                    tone={r.delta === null ? 'neutral' : r.delta < 0 ? 'good' : 'bad'}
                  />
                ),
              },
              { key: 'status', label: 'Estado', render: (r) => <StatusPill status={r.status} /> },
            ]}
            data={tableRows}
          />
        </ChartCard>
      </div>
    </div>
  );
}
