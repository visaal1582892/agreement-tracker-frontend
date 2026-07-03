import { useState, useCallback } from 'react';
import { useDebounce } from './useDebounce';

/**
 * Centralises all state a master-data page needs:
 *  - Server-side pagination
 *  - Server-side sorting
 *  - Column-level filter map (debounced before hitting the API)
 *
 * Returns the raw filter state (for controlled inputs) AND the debounced
 * filters (to pass as the API request body).
 */
export function useMasterTable({ initialSize = 20, debounceMs = 1000 } = {}) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialSize);
  const [sortBy, setSortBy] = useState('id');
  const [sortDir, setSortDir] = useState('asc');
  const [filters, setFilters] = useState({});

  const debouncedFilters = useDebounce(filters, debounceMs);

  const handlePageChange = useCallback((_e, newPage) => setPage(newPage), []);

  const handleRowsPerPageChange = useCallback((e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  }, []);

  const handleSort = useCallback(
    (field) => {
      setSortDir((prev) => (sortBy === field && prev === 'asc' ? 'desc' : 'asc'));
      setSortBy(field);
      setPage(0);
    },
    [sortBy],
  );

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => {
      if (value === '' || value == null) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
    setPage(0);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({});
    setPage(0);
  }, []);

  /** Build the request body to POST to /master/xxx/search */
  const buildRequest = useCallback(
    (extraFilters = {}) => ({
      page,
      size: rowsPerPage,
      sortBy,
      sortDirection: sortDir.toUpperCase(),
      filters: { ...debouncedFilters, ...extraFilters },
    }),
    [page, rowsPerPage, sortBy, sortDir, debouncedFilters],
  );

  return {
    page,
    rowsPerPage,
    sortBy,
    sortDir,
    filters,
    debouncedFilters,
    handlePageChange,
    handleRowsPerPageChange,
    handleSort,
    handleFilterChange,
    resetFilters,
    buildRequest,
  };
}
