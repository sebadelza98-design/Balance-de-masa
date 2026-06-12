import { useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useHistoricalRecords } from '../hooks/useHistoricalRecords';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import AreaTrendChart from '../charts/AreaTrendChart';
import TrendChart from '../charts/TrendChart';
import BarsChart from '../charts/BarsChart';
import DonutChart from '../charts/DonutChart';
import {
  dailySeries,
  deltaPct,
  monthlySeries,
  potableKpis,
} from '../services/transforms';
import { DESTINOS_AGUA_POTABLE } from '../config/plant';
import { POTABLE_THRESHOLDS } from '../config/metrics';

export default function AguaPotable() {
  const { records, prevRecords, loading, error } = useDashboard();
  const historical = useHistoricalRecords(12);

  const kpis = useMemo(() => potableKpis(records), [records]);
  const prevKpis = useMemo(() => potableKpis(prevRecords), [prevRecords]);

  const dailyBalance = useMemo(
    () =>
      dailySeries(records, {
        consumo: (r) => r.aguaPotable.consumo,
        perdidas: (r) => r.aguaPotable.produccion - r.aguaPotable.consumo,
      }),
    [records]
  );

  const dailyEficiencia = useMemo(
    () =>
      dailySeries(records, {
        eficiencia: (r) =>
          r.aguaPotable.produccion > 0
            ? (r.aguaPotable.consumo / r.aguaPotable.produccion) * 100
            : null,
      }),
    [records]
  );

  const destinos = useMemo(() => {
    const items = DESTINOS_AGUA_POTABLE.map((d) => ({
      ...d,
      agua: records.reduce((a, r) => a + (r.aguaPotable.destinos?.[d.id] ?? 0), 0),
    }));
    const total = items.reduce((a, i) => a + i.agua, 0);
    return items.map((i) => ({
      ...i,
      agua: Math.round(i.agua * 10) / 10,
      pct: total > 0 ? (i.agua / total) * 100 : 0,
    }));
  }, [records]);

  const monthly = useMemo(
    () =>
      monthlySeries(historical.records, {
        produccion: (r) => r.aguaPotable.produccion,
        consumo: (r) => r.aguaPotable.consumo,
      }),
    [historical.records]
  );

  if (loading || error || !records.length) {
    return (
      <div className="page">
        <PageHeader title="Agua Potable" />
        <PageState loading={loading} error={error} empty={!records.length} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Agua Potable"
        subtitle="Producción, consumo, pérdidas y eficiencia del sistema de agua potable"
      />

      <div className="kpi-grid">
        <KpiCard
          label="Producción"
          unit="m³"
          accent="#22d3ee"
          value={kpis.produccion}
          deltaPct={deltaPct(kpis.produccion, prevKpis?.produccion ?? null)}
        />
        <KpiCard
          label="Consumo"
          unit="m³"
          accent="#3b82f6"
          value={kpis.consumo}
          deltaPct={deltaPct(kpis.consumo, prevKpis?.consumo ?? null)}
          def={{ deltaGood: 'down' }}
        />
        <KpiCard
          label="Pérdidas"
          unit="m³"
          accent="#ef4444"
          value={kpis.perdidas}
          deltaPct={deltaPct(kpis.perdidas, prevKpis?.perdidas ?? null)}
          def={{ deltaGood: 'down' }}
          subtitle={`${kpis.perdidasPct?.toFixed(1) ?? '—'} % de la producción`}
        />
        <KpiCard
          label="Eficiencia del sistema"
          unit="%"
          decimals={1}
          accent="#4ade80"
          value={kpis.eficiencia}
          deltaPct={deltaPct(kpis.eficiencia, prevKpis?.eficiencia ?? null)}
          def={{ ...POTABLE_THRESHOLDS.eficiencia, unit: '%', decimals: 1 }}
        />
      </div>

      <div className="chart-grid">
        <ChartCard
          span={7}
          title="Balance de agua diario"
          subtitle="Consumo útil + pérdidas = producción (m³/día)"
        >
          <AreaTrendChart
            data={dailyBalance}
            series={[
              { key: 'consumo', name: 'Consumo útil', color: '#3b82f6' },
              { key: 'perdidas', name: 'Pérdidas', color: '#ef4444' },
            ]}
            stacked
            height={300}
          />
        </ChartCard>

        <ChartCard
          span={5}
          title="Eficiencia diaria"
          subtitle={`Meta ≥ ${POTABLE_THRESHOLDS.eficiencia.ok} %`}
        >
          <TrendChart
            data={dailyEficiencia}
            series={[{ key: 'eficiencia', name: 'Eficiencia (%)', color: '#4ade80' }]}
            unit="%"
            decimals={1}
            referenceY={{
              value: POTABLE_THRESHOLDS.eficiencia.ok,
              label: `Meta ${POTABLE_THRESHOLDS.eficiencia.ok}%`,
            }}
            showLegend={false}
            height={300}
          />
        </ChartCard>

        <ChartCard
          span={5}
          title="Distribución de consumos"
          subtitle="Consumo por destino en el período"
        >
          <DonutChart data={destinos} height={300} />
        </ChartCard>

        <ChartCard
          span={7}
          title="Tendencia mensual"
          subtitle="Producción vs consumo · últimos 12 meses"
        >
          {historical.loading ? (
            <PageState loading />
          ) : (
            <BarsChart
              data={monthly}
              series={[
                { key: 'produccion', name: 'Producción (m³)', color: '#22d3ee' },
                { key: 'consumo', name: 'Consumo (m³)', color: '#3b82f6' },
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
