import { useMemo, useState } from 'react';

/**
 * Ordenamiento de tablas dinámicas.
 * Devuelve { rows, sortKey, sortDir, requestSort }.
 */
export function useSortableTable(data, initialKey = null, initialDir = 'desc') {
  const [sortKey, setSortKey] = useState(initialKey);
  const [sortDir, setSortDir] = useState(initialDir);

  const rows = useMemo(() => {
    if (!sortKey) return data;
    const sorted = [...data].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'string') return va.localeCompare(vb, 'es');
      return va - vb;
    });
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [data, sortKey, sortDir]);

  const requestSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return { rows, sortKey, sortDir, requestSort };
}
