/**
 * Contenedor estándar para gráficos: título, subtítulo, acciones
 * (selectores propios del gráfico) y cuerpo.
 */
export default function ChartCard({ title, subtitle, actions, children, span = 12 }) {
  return (
    <div className={`chart-card span-${span}`}>
      <div className="chart-card-head">
        <div>
          <div className="chart-card-title">{title}</div>
          {subtitle && <div className="chart-card-subtitle">{subtitle}</div>}
        </div>
        {actions && <div className="chart-card-actions">{actions}</div>}
      </div>
      <div className="chart-body">{children}</div>
    </div>
  );
}
