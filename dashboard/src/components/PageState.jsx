/** Estados de página: cargando / error / sin datos. */
export default function PageState({ loading, error, empty }) {
  if (loading) {
    return (
      <div className="loader-box">
        <div className="spinner" />
        <div>Cargando datos del período…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="empty-note">
        ⚠️ Error al cargar datos: {error}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="empty-note">
        No hay registros para el rango de fechas seleccionado.
      </div>
    );
  }
  return null;
}
