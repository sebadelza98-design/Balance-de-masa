import { useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useHistoricalRecords } from '../hooks/useHistoricalRecords';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import DataTable from '../components/DataTable';
import DeltaBadge from '../components/DeltaBadge';
import AreaTrendChart from '../charts/AreaTrendChart';
import BarsChart from '../charts/BarsChart';
import DonutChart from '../charts/DonutChart';
import TrendChart from '../charts/TrendChart';
import {
  dailySeries,
  deltaPct,
  monthlySeries,
  serviciosTotals,
  totalServicios,
} from '../services/transforms';
import { SERVICIOS } from '../config/plant';
import { fmt, fmtPct } from '../utils/format';

const srvSelectors = Object.fromEntries(
  SERVICIOS.map((s) => [s.id, (rec) => rec.servicios[s.id] ?? 0])
);

const series = SERVICIOS.map((s) => ({ key: s.id, name: s.nombre, color: s.color }));

export default function Servicios() {
  const { records, prevRecords, loading, error } = useDashboard();
  const historical = useHistoricalRecords(12);

  const totals = useMemo(() => serviciosTotals(records), [records]);
  const prevTotals = useMemo(() => serviciosTotals(prevRecords), [prevRecords]);

  const total = totals.reduce((a, t) => a + t.agua, 0);
  const totalPrev = prevTotals.reduce((a, t) => a + t.agua, 0);

  const daily = useMemo(() => dailySeries(records, srvSelectors), [records]);
  const monthly = useMemo(
    () => monthlySeries(historical.records, { total: totalServicios }),
    [historical.records]
  );
  const monthlyByService = useMemo(
    () => monthlySeries(historical.records, srvSelectors),
    [historical.records]
  );

  const byId = (arr, id) => arr.find((t) => t.id === id);

  const tableRows = useMemo(
    () =>
      totals.map((t) => ({
        ...t,
        delta: deltaPct(t.agua, byId(prevTotals, t.id)?.agua ?? null),
      })),
    [totals, prevTotals]
  );

  if (loading || error || !records.length) {
    return (
      <div className="page">
        <PageHeader title="Servicios Auxiliares" />
        <PageState loading={loading} error={error} empty={!records.length} />
      </div>
    );
  }

  const kpiIds = ['torres', 'calderas', 'cip'];

  return (
    <div className="page">
      <PageHeader
        title="Servicios Auxiliares"
        subtitle="Torres de enfriamiento, calderas, CIP y otros servicios de planta"
      />

      <div className="kpi-grid">
        <KpiCard
          label="Consumo total servicios"
          unit="m³"
          accent="#22d3ee"
          value={total}
          deltaPct={deltaPct(total, totalPrev)}
          def={{ deltaGood: 'down' }}
        />
        {kpiIds.map((id) => {
          const t = byId(totals, id);
          const p = byId(prevTotals, id);
          return (
            <KpiCard
              key={id}
              label={t.nombre}
              unit="m³"
              accent={t.color}
              value={t.agua}
              deltaPct={deltaPct(t.agua, p?.agua ?? null)}
              def={{ deltaGood: 'down' }}
            />
          );
        })}
      </div>

      <div className="chart-grid">
        <ChartCard
          span={7}
          title="Consumo diario por servicio"
          subtitle="Series apiladas (m³/día)"
        >
          <AreaTrendChart data={daily} series={series} stacked height={310} />
        </ChartCard>

        <ChartCard
          span={5}
          title="Distribución porcentual del consumo"
          subtitle="Participación de cada servicio en el período"
        >
          <DonutChart data={totals} height={310} />
        </ChartCard>

        <ChartCard
          span={6}
          title="Consumo acumulado mensual"
          subtitle="Total de servicios por mes · últimos 12 meses"
        >
          {historical.loading ? (
            <PageState loading />
          ) : (
            <BarsChart
              data={monthly}
              series={[{ key: 'total', name: 'Servicios (m³)', color: '#22d3ee' }]}
              xType="month"
              decimals={0}
              height={290}
              showLegend={false}
            />
          )}
        </ChartCard>

        <ChartCard
          span={6}
          title="Tendencia histórica por servicio"
          subtitle="Consumo mensual (m³) · últimos 12 meses"
        >
          {historical.loading ? (
            <PageState loading />
          ) : (
            <TrendChart
              data={monthlyByService}
              series={series}
              xType="month"
              decimals={0}
              height={290}
            />
          )}
        </ChartCard>

        <ChartCard
          span={12}
          title="Detalle por servicio"
          subtitle="Consumo del período, participación y variación"
        >
          <DataTable
            initialSort="agua"
            columns={[
              {
                key: 'nombre',
                label: 'Servicio',
                render: (r) => (
                  <span className="row-label">
                    <span className="row-swatch" style={{ background: r.color }} />
                    {r.nombre}
                  </span>
                ),
              },
              { key: 'agua', label: 'Consumo m³', num: true, render: (r) => fmt(r.agua, 0) },
              { key: 'pct', label: 'Participación', num: true, render: (r) => fmtPct(r.pct, 1) },
              {
                key: 'bar',
                label: '',
                render: (r) => (
                  <span className="inline-bar">
                    <span style={{ width: `${Math.min(100, r.pct)}%` }} />
                  </span>
                ),
              },
              {
                key: 'delta',
                label: 'Δ vs anterior',
                num: true,
                render: (r) => (
                  <DeltaBadge
                    deltaPct={r.delta}
                    tone={r.delta === null ? 'neutral' : r.delta < 0 ? 'good' : 'bad'}
                  />
                ),
              },
            ]}
            data={tableRows}
          />
        </ChartCard>
      </div>
    </div>
  );
}
