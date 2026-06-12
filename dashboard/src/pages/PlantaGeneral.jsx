import { useMemo, useState } from 'react';
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
import BarsChart from '../charts/BarsChart';
import PeriodCompareChart from '../charts/PeriodCompareChart';
import RankingChart from '../charts/RankingChart';
import DonutChart from '../charts/DonutChart';
import {
  computePlantKpis,
  consumerRanking,
  monthlySeries,
  plantKpiDailySeries,
  totalPozos,
  totalProduccion,
  withComparison,
  alignPeriods,
} from '../services/transforms';
import { KPI_DEFS, evalDelta, evalStatus } from '../config/metrics';
import { fmt } from '../utils/format';

const KPI_ORDER = [
  'ratioAgua',
  'produccion',
  'consumoPozos',
  'consumoNano',
  'rechazoNano',
  'recuperacionWUR',
  'consumoCIP',
  'eficienciaRO',
];

const COMPARE_OPTIONS = [
  { key: 'agua', label: 'Consumo de pozos (m³)', selector: totalPozos, unit: 'm³' },
  { key: 'prod', label: 'Producción de bebida (m³)', selector: totalProduccion, unit: 'm³' },
];

export default function PlantaGeneral() {
  const { records, prevRecords, loading, error } = useDashboard();
  const historical = useHistoricalRecords(12);
  const [trendKpi, setTrendKpi] = useState('ratioAgua');
  const [compareKey, setCompareKey] = useState('agua');

  const kpis = useMemo(
    () => withComparison(computePlantKpis(records), computePlantKpis(prevRecords)),
    [records, prevRecords]
  );

  const dailyKpis = useMemo(() => plantKpiDailySeries(records), [records]);

  const monthly = useMemo(
    () =>
      monthlySeries(historical.records, {
        pozos: totalPozos,
        produccion: totalProduccion,
      }),
    [historical.records]
  );

  const ranking = useMemo(() => consumerRanking(records), [records]);

  const compareOpt = COMPARE_OPTIONS.find((o) => o.key === compareKey);
  const compareData = useMemo(
    () => alignPeriods(records, prevRecords, compareOpt.selector),
    [records, prevRecords, compareOpt]
  );

  const trendDef = KPI_DEFS[trendKpi];

  const statusRows = useMemo(() => {
    if (!kpis) return [];
    return KPI_ORDER.map((key) => {
      const def = KPI_DEFS[key];
      const k = kpis[key];
      return {
        id: key,
        indicador: def.label,
        valor: k.value,
        anterior: k.prev,
        deltaPct: k.deltaPct,
        unidad: def.unit,
        decimals: def.decimals,
        status: evalStatus(k.value, def),
        def,
      };
    });
  }, [kpis]);

  if (loading || error || !records.length) {
    return (
      <div className="page">
        <PageHeader title="Planta General" subtitle="Balance hídrico global de la planta" />
        <PageState loading={loading} error={error} empty={!records.length} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Planta General"
        subtitle="Balance hídrico global: captación, tratamiento, producción y servicios"
      />

      {/* ── KPIs principales ── */}
      <div className="kpi-grid">
        {KPI_ORDER.map((key) => (
          <KpiCard
            key={key}
            def={KPI_DEFS[key]}
            value={kpis[key].value}
            deltaPct={kpis[key].deltaPct}
          />
        ))}
      </div>

      <div className="chart-grid">
        {/* ── Tendencia diaria por indicador ── */}
        <ChartCard
          span={7}
          title="Tendencia diaria del indicador"
          subtitle="Comportamiento día a día dentro del período seleccionado"
          actions={
            <select value={trendKpi} onChange={(e) => setTrendKpi(e.target.value)}>
              {KPI_ORDER.map((key) => (
                <option key={key} value={key}>
                  {KPI_DEFS[key].label}
                </option>
              ))}
            </select>
          }
        >
          <TrendChart
            data={dailyKpis}
            series={[{ key: trendKpi, name: trendDef.label, color: trendDef.accent }]}
            unit={trendDef.unit}
            decimals={trendDef.decimals}
            referenceY={
              trendDef.ok !== undefined
                ? { value: trendDef.ok, label: `Meta ${fmt(trendDef.ok, trendDef.decimals)}`, color: '#f59e0b' }
                : null
            }
            showLegend={false}
            height={300}
          />
        </ChartCard>

        {/* ── Comparación vs período anterior ── */}
        <ChartCard
          span={5}
          title="Comparación con período anterior"
          subtitle="Series alineadas por día relativo del período"
          actions={
            <select value={compareKey} onChange={(e) => setCompareKey(e.target.value)}>
              {COMPARE_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          }
        >
          <PeriodCompareChart data={compareData} unit={compareOpt.unit} height={300} />
        </ChartCard>

        {/* ── Evolución mensual acumulada ── */}
        <ChartCard
          span={7}
          title="Evolución mensual acumulada"
          subtitle="Últimos 12 meses · consumo de pozos vs bebida producida"
        >
          {historical.loading ? (
            <PageState loading />
          ) : (
            <BarsChart
              data={monthly}
              series={[
                { key: 'pozos', name: 'Agua de pozos (m³)', color: '#3b82f6' },
                { key: 'produccion', name: 'Bebida producida (m³)', color: '#4ade80' },
              ]}
              xType="month"
              decimals={0}
              height={300}
            />
          )}
        </ChartCard>

        {/* ── Distribución del consumo ── */}
        <ChartCard
          span={5}
          title="Distribución del consumo"
          subtitle="Participación por consumidor en el período"
        >
          <DonutChart data={ranking.slice(0, 8)} height={300} />
        </ChartCard>

        {/* ── Ranking de consumidores ── */}
        <ChartCard
          span={6}
          title="Ranking de consumidores de agua"
          subtitle="Principales consumidores del período (m³)"
        >
          <RankingChart data={ranking} height={340} />
        </ChartCard>

        {/* ── Tabla semafórica ── */}
        <ChartCard
          span={6}
          title="Estado de indicadores"
          subtitle="Semáforo de desempeño vs metas y período anterior"
        >
          <DataTable
            initialSort={null}
            columns={[
              { key: 'indicador', label: 'Indicador' },
              {
                key: 'valor',
                label: 'Valor',
                num: true,
                render: (r) => `${fmt(r.valor, r.decimals)} ${r.unidad}`,
              },
              {
                key: 'anterior',
                label: 'Período anterior',
                num: true,
                render: (r) => `${fmt(r.anterior, r.decimals)} ${r.unidad}`,
              },
              {
                key: 'deltaPct',
                label: 'Δ %',
                num: true,
                render: (r) => (
                  <DeltaBadge deltaPct={r.deltaPct} tone={evalDelta(r.deltaPct, r.def)} />
                ),
              },
              {
                key: 'status',
                label: 'Estado',
                render: (r) => <StatusPill status={r.status} />,
              },
            ]}
            data={statusRows}
          />
        </ChartCard>
      </div>
    </div>
  );
}
