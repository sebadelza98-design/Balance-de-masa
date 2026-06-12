const LABELS = { ok: 'Óptimo', warn: 'Alerta', bad: 'Crítico' };

/** Indicador semafórico (verde / amarillo / rojo). */
export function StatusDot({ status }) {
  if (!status) return null;
  return <span className={`status-dot ${status}`} title={LABELS[status]} />;
}

export default function StatusPill({ status, label }) {
  if (!status) return <span style={{ color: 'var(--text-faint)' }}>—</span>;
  return (
    <span className={`status-pill ${status}`}>
      <span className={`status-dot ${status}`} />
      {label ?? LABELS[status]}
    </span>
  );
}
