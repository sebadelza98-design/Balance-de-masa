import { useSortableTable } from '../hooks/useSortableTable';

/**
 * Tabla dinámica con ordenamiento por columna.
 *
 * props:
 *  - columns: [{ key, label, num?, render?(row) }]
 *  - data:    filas
 *  - initialSort: clave inicial de orden
 */
export default function DataTable({ columns, data, initialSort }) {
  const { rows, sortKey, sortDir, requestSort } = useSortableTable(
    data,
    initialSort
  );

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${col.num ? 'num' : ''} ${sortKey === col.key ? 'sorted' : ''}`}
                onClick={() => requestSort(col.key)}
                title="Ordenar"
              >
                {col.label}
                {sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? row.key ?? i}>
              {columns.map((col) => (
                <td key={col.key} className={col.num ? 'num' : ''}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
