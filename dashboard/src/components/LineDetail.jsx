import { useMemo, useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useHistoricalRecords } from '../hooks/useHistoricalRecords';
import PageHeader from './PageHeader';
import PageState from './PageState';
import KpiCard from './KpiCard';
import ChartCard from './ChartCard';
import TrendChart from '../charts/TrendChart';
import AreaTrendChart from '../charts/AreaTrendChart';
import BarsChart from '../charts/BarsChart';
import PeriodCompareChart from '../charts/PeriodCompareChart';
import {
  alignPeriods,
  cumulativeSeries,
  dailySeries,
  deltaPct,
  lineKpis,
  monthlySeries,
} from '../services/transforms';
import { LINE_RATIO_THRESHOLDS } from '../config/metrics';
import { fmt, fmtDayShort } from '../utils/format';

/**
 * Vista de detalle para una línea individual (One Way, Línea 10, …):
 * KPIs, tendencias diarias, ratio vs meta, acumulado, comparación con el
 * período anterior y evolución histórica mensual.
 */
export default function LineDetail({ lineId, title, subtitle, color = '#22d3ee' }) {
  const { records, prevRecords, loading, error } = useDashboard();
  const historical = useHistoricalRecords(12);
  const [compareMetric, setCompareMetric] = useState('agua');

  const kpis = useMemo(() => lineKpis(records, lineId), [records, lineId]);
  const prevKpis = useMemo(() => lineKpis(prevRecords, lineId), [prevRecords, lineId]);

  const daily = useMemo(
    () =>
      dailySeries(records, {
        agua: (r) => r.lineas[lineId]?.agua ?? 0,
        produccion: (r) => r.lineas[lineId]?.produccion ?? 0,
        ratio: (r) => {
          const l = r.lineas[lineId];
          return l && l.produccion > 0 ? l.agua / l.produccion : null;
        },
      }),
    [records, lineId]
  );

  const cumulative = useMemo(
    () =>
      cumulativeSeries(records, {
        agua: (r) => r.lineas[lineId]?.agua ?? 0,
        produccion: (r) => r.lineas[lineId]?.produccion ?? 0,
      }),
    [records, lineId]
  );

  const monthly = useMemo(
    () =>
      monthlySeries(historical.records, {
        agua: (r) => r.lineas[lineId]?.agua ?? 0,
        produccion: (r) => r.lineas[lineId]?.produccion ?? 0,
      }),
    [historical.records, lineId]
  );

  const compareData = useMemo(
    () =>
      alignPeriods(records, prevRecords, (r) =>
        compareMetric === 'agua'
          ? (r.lineas[lineId]?.agua ?? 0)
          : (r.lineas[lineId]?.produccion ?? 0)
      ),
    [records, prevRecords, lineId, compareMetric]
  );

  const peakDay = useMemo(() => {
    if (!daily.length) return null;
    return daily.reduce((a, b) => (b.agua > a.agua ? b : a));
  }, [daily]);

  if (loading || error || !records.length) {
    return (
      <div className="page">
        <PageHeader title={title} subtitle={subtitle} />
        <PageState loading={loading} error={error} empty={!records.length} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title={title} subtitle={subtitle} />

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
          label="Bebida producida"
          unit="m³"
          accent="#4ade80"
          value={kpis.produccion}
          deltaPct={deltaPct(kpis.produccion, prevKpis?.produccion ?? null)}
          def={{ deltaGood: 'up' }}
        />
        <KpiCard
          label="Ratio agua / bebida"
          unit="L/L"
          decimals={2}
          accent={color}
          value={kpis.ratio}
          deltaPct={deltaPct(kpis.ratio, prevKpis?.ratio ?? null)}
          def={{ direction: 'below', ...LINE_RATIO_THRESHOLDS, unit: 'L/L', decimals: 2 }}
        />
        <KpiCard
          label="Día de mayor consumo"
          unit="m³"
          accent="#fb923c"
          value={peakDay?.agua}
          subtitle={peakDay ? fmtDayShort(peakDay.date) : '—'}
        />
      </div>

      <div className="chart-grid">
        <ChartCard
          span={7}
          title="Tendencia diaria"
          subtitle="Consumo de agua y producción (m³/día)"
        >
          <TrendChart
            data={daily}
            series={[
              { key: 'agua', name: 'Agua (m³)', color: '#3b82f6' },
              { key: 'produccion', name: 'Producción (m³)', color: '#4ade80' },
            ]}
            height={300}
          />
        </ChartCard>

        <ChartCard
          span={5}
          title="Ratio diario agua / bebida"
          subtitle={`Meta ≤ ${fmt(LINE_RATIO_THRESHOLDS.ok, 1)} L/L`}
        >
          <TrendChart
            data={daily}
            series={[{ key: 'ratio', name: 'Ratio (L/L)', color }]}
            unit="L/L"
            decimals={2}
            referenceY={{
              value: LINE_RATIO_THRESHOLDS.ok,
              label: `Meta ${fmt(LINE_RATIO_THRESHOLDS.ok, 1)}`,
            }}
            showLegend={false}
            height={300}
          />
        </ChartCard>

        <ChartCard
          span={6}
          title="Acumulado del período"
          subtitle="Agua y producción acumuladas (m³)"
        >
          <AreaTrendChart
            data={cumulative}
            series={[
              { key: 'agua', name: 'Agua acumulada', color: '#3b82f6' },
              { key: 'produccion', name: 'Producción acumulada', color: '#4ade80' },
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
              <option value="produccion">Producción</option>
            </select>
          }
        >
          <PeriodCompareChart data={compareData} height={290} />
        </ChartCard>

        <ChartCard
          span={12}
          title="Comparación histórica mensual"
          subtitle="Totales mensuales · últimos 12 meses"
        >
          {historical.loading ? (
            <PageState loading />
          ) : (
            <BarsChart
              data={monthly}
              series={[
                { key: 'agua', name: 'Agua (m³)', color: '#3b82f6' },
                { key: 'produccion', name: 'Producción (m³)', color: '#4ade80' },
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
