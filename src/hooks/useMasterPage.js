import { useState, useEffect, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { isRecordActive } from '../utils/masterUtils';
import { useMasterTable } from './useMasterTable';

/**
 * Encapsulates the full lifecycle of a master-data CRUD page:
 *  - Table state (pagination / sort / filters via useMasterTable)
 *  - API calls  (search / create / update / toggleStatus)
 *  - Slide-panel open/close for create + edit forms
 *  - Toast notifications
 *
 * Usage:
 *   const page = useMasterPage({ api: companyApi, entityLabel: 'Company' });
 *
 * `api` must expose: search(req), create(data), update(id, data), toggleStatus(id)
 */
export function useMasterPage({ api, entityLabel = 'Record' }) {
  const { enqueueSnackbar } = useSnackbar();
  const {
    page,
    rowsPerPage,
    sortBy,
    sortDir,
    debouncedFilters,
    buildRequest,
    ...tableHandlers
  } = useMasterTable();

  const [rows, setRows]         = useState([]);
  const [totalCount, setTotal]  = useState(0);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);

  const [panelOpen, setPanelOpen]     = useState(false);
  const [editingRow, setEditingRow]   = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const req = buildRequest();
      const res = await api.search(req);
      setRows(res.content.map((row) => ({ ...row, isActive: isRecordActive(row) })));
      setTotal(res.totalElements);
    } catch (err) {
      enqueueSnackbar(err?.response?.data?.message || `Failed to load ${entityLabel}s`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [api, entityLabel, buildRequest, enqueueSnackbar]);

  // Re-fetch whenever pagination/sort/debounced-filters change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingRow(null);
    setPanelOpen(true);
  };

  const openEdit = (row) => {
    setEditingRow(row);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditingRow(null);
  };

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (editingRow) {
        await api.update(editingRow.id, data);
        enqueueSnackbar(`${entityLabel} updated successfully`, { variant: 'success' });
      } else {
        await api.create(data);
        enqueueSnackbar(`${entityLabel} created successfully`, { variant: 'success' });
      }
      closePanel();
      fetchData();
    } catch (err) {
      enqueueSnackbar(err?.response?.data?.message || `Failed to save ${entityLabel}`, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (row) => {
    try {
      await api.toggleStatus(row.id);
      enqueueSnackbar(
        `${entityLabel} ${isRecordActive(row) ? 'deactivated' : 'activated'} successfully`,
        { variant: 'success' },
      );
      fetchData();
    } catch (err) {
      enqueueSnackbar(err?.response?.data?.message || `Failed to update status`, { variant: 'error' });
    }
  };

  return {
    // Table
    rows,
    totalCount,
    loading,
    saving,
    page,
    rowsPerPage,
    sortBy,
    sortDir,
    debouncedFilters,
    buildRequest,
    ...tableHandlers,
    // Panel
    panelOpen,
    editingRow,
    openCreate,
    openEdit,
    closePanel,
    // Actions
    handleSave,
    handleToggleStatus,
    refetch: fetchData,
  };
}
