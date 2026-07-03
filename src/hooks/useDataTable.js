import { useState, useCallback } from 'react';

export function useDataTable({ initialPage = 0, initialSize = 20 } = {}) {
  const [page, setPage] = useState(initialPage);
  const [rowsPerPage, setRowsPerPage] = useState(initialSize);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const handlePageChange = useCallback((_e, newPage) => setPage(newPage), []);

  const handleRowsPerPageChange = useCallback((e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  }, []);

  const handleSearch = useCallback((value) => {
    setSearch(value);
    setPage(0);
  }, []);

  const handleSort = useCallback((field) => {
    setSortDir((prev) => (sortBy === field && prev === 'asc' ? 'desc' : 'asc'));
    setSortBy(field);
    setPage(0);
  }, [sortBy]);

  const reset = useCallback(() => {
    setPage(initialPage);
    setRowsPerPage(initialSize);
    setSearch('');
  }, [initialPage, initialSize]);

  return {
    page, rowsPerPage, search, sortBy, sortDir,
    handlePageChange, handleRowsPerPageChange, handleSearch, handleSort, reset,
  };
}
