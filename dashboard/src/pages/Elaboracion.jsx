import { useMemo, useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useHistoricalRecords } from '../hooks/useHistoricalRecords';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import TrendChart from '../charts/TrendChart';
import AreaTrendChart from '../charts/AreaTrendChart';
import BarsChart from '../charts/BarsChart';
import PeriodCompareChart from '../charts/PeriodCompareChart';
import {
  alignPeriods,
  cumulativeSeries,
  dailySeries,
  deltaPct,
  elaboracionKpis,
  monthlySeries,
} from '../services/transforms';
import { fmt } from '../utils/format';

/** Umbral de ratio agua/producto para elaboración (jarabe terminado). */
const ELAB_RATIO = { direction: 'below', ok: 1.45, warn: 1.7 };

export default function Elaboracion() {
  const { records, prevRecords, loading, error } = useDashboard();
  const historical = useHistoricalRecords(12);
  const [compareMetric, setCompareMetric] = useState('agua');

  const kpis = useMemo(() => elaboracionKpis(records), [records]);
  const prevKpis = useMemo(() => elaboracionKpis(prevRecords), [prevRecords]);

  const daily = useMemo(
    () =>
      dailySeries(records, {
        agua: (r) => r.elaboracion.agua,
        produccion: (r) => r.elaboracion.produccion,
        ratio: (r) =>
          r.elaboracion.produccion > 0
            ? r.elaboracion.agua / r.elaboracion.produccion
            : null,
      }),
    [records]
  );

  const cumulative = useMemo(
    () =>
      cumulativeSeries(records, {
        agua: (r) => r.elaboracion.agua,
        produccion: (r) => r.elaboracion.produccion,
      }),
    [records]
  );

  const monthly = useMemo(
    () =>
      monthlySeries(historical.records, {
        agua: (r) => r.elaboracion.agua,
        produccion: (r) => r.elaboracion.produccion,
      }),
    [historical.records]
  );

  const compareData = useMemo(
    () =>
      alignPeriods(records, prevRecords, (r) =>
        compareMetric === 'agua' ? r.elaboracion.agua : r.elaboracion.produccion
      ),
    [records, prevRecords, compareMetric]
  );

  if (loading || error || !records.length) {
    return (
      <div className="page">
        <PageHeader title="Elaboración" />
        <PageState loading={loading} error={error} empty={!records.length} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Elaboración"
        subtitle="Preparación de jarabes y mezclas — consumo de agua y producción"
      />

      <div className="kpi-grid">
        <KpiCard
          label="Consumo de agua"
          unit="m³"
          accent="#3b82f6"
          value={kpis.agua}
          deltaPct={deltaPct(kpis.agua, prevKpis?.agua ?? null)}
          def={{ deltaGood: 'down' }}
        />
        <KpiCard
          label="Producto elaborado"
          unit="m³"
          accent="#4ade80"
          value={kpis.produccion}
          deltaPct={deltaPct(kpis.produccion, prevKpis?.produccion ?? null)}
          def={{ deltaGood: 'up' }}
        />
        <KpiCard
          label="Ratio agua / producto"
          unit="L/L"
          decimals={2}
          accent="#e879f9"
          value={kpis.ratio}
          deltaPct={deltaPct(kpis.ratio, prevKpis?.ratio ?? null)}
          def={{ ...ELAB_RATIO, unit: 'L/L', decimals: 2 }}
        />
      </div>

      <div className="chart-grid">
        <ChartCard
          span={7}
          title="Tendencia diaria"
          subtitle="Agua consumida y producto elaborado (m³/día)"
        >
          <TrendChart
            data={daily}
            series={[
              { key: 'agua', name: 'Agua (m³)', color: '#3b82f6' },
              { key: 'produccion', name: 'Producto (m³)', color: '#4ade80' },
            ]}
            height={300}
          />
        </ChartCard>

        <ChartCard
          span={5}
          title="Ratio diario agua / producto"
          subtitle={`Meta ≤ ${fmt(ELAB_RATIO.ok, 2)} L/L`}
        >
          <TrendChart
            data={daily}
            series={[{ key: 'ratio', name: 'Ratio (L/L)', color: '#e879f9' }]}
            unit="L/L"
            decimals={2}
            referenceY={{ value: ELAB_RATIO.ok, label: `Meta ${fmt(ELAB_RATIO.ok, 2)}` }}
            showLegend={false}
            height={300}
          />
        </ChartCard>

        <ChartCard
          span={6}
          title="Acumulado del período"
          subtitle="Agua y producto acumulados (m³)"
        >
          <AreaTrendChart
            data={cumulative}
            series={[
              { key: 'agua', name: 'Agua acumulada', color: '#3b82f6' },
              { key: 'produccion', name: 'Producto acumulado', color: '#4ade80' },
            ]}
            decimals={0}
            height={290}
          />
        </ChartCard>

        <ChartCard
          span={6}
          title="Comparación con período anterior"
          subtitle="Día a día vs período anterior equivalente"
          actions={
            <select value={compareMetric} onChange={(e) => setCompareMetric(e.target.value)}>
              <option value="agua">Consumo de agua</option>
              <option value="produccion">Producto elaborado</option>
            </select>
          }
        >
          <PeriodCompareChart data={compareData} height={290} />
        </ChartCard>

        <ChartCard
          span={12}
          title="Comparación mensual"
          subtitle="Totales mensuales · últimos 12 meses"
        >
          {historical.loading ? (
            <PageState loading />
          ) : (
            <BarsChart
              data={monthly}
              series={[
                { key: 'agua', name: 'Agua (m³)', color: '#3b82f6' },
                { key: 'produccion', name: 'Producto (m³)', color: '#4ade80' },
              ]}
              xType="month"
              decimals={0}
              height={300}
            />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
