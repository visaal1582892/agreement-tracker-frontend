import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Autocomplete,
  TextField,
  Button,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { useSnackbar } from 'notistack';
import axiosInstance from '../../api/axiosInstance';

// Helper to format currency
const formatCurrency = (value) => {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
};

export default function RevenueRecognitionDashboard() {
  const { enqueueSnackbar } = useSnackbar();

  const [years, setYears] = useState([]);
  const [months, setMonths] = useState([]);
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Hardcode some options for now, or generate them
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      years.forEach((y) => params.append('years', y));
      months.forEach((m) => params.append('months', m));

      const res = await axiosInstance.get(`/revenue-recognition/dashboard?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
      enqueueSnackbar('Failed to fetch dashboard data', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = [
    { field: 'agreementName', headerName: 'Agreement Name', flex: 1, minWidth: 150 },
    { field: 'versionName', headerName: 'Version Name', flex: 1, minWidth: 120 },
    { field: 'supplierId', headerName: 'Supplier ID', flex: 1, minWidth: 120 },
    { field: 'calendarYear', headerName: 'Year', flex: 1, minWidth: 100 },
    { field: 'calendarMonth', headerName: 'Month', flex: 1, minWidth: 100 },
    { field: 'triggeredFrequencies', headerName: 'Triggered Frequencies', flex: 2, minWidth: 200 },
    {
      field: 'earnedAmount',
      headerName: 'Earned Amount',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => formatCurrency(params.value),
    },
    {
      field: 'paymentInterval',
      headerName: 'Payment Interval',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'payableAmount',
      headerName: 'Final Payable',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => formatCurrency(params.value),
    },
  ];

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h5" fontWeight="bold">
        Revenue Recognition Dashboard
      </Typography>
      
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Autocomplete
            multiple
            options={yearOptions}
            value={years}
            onChange={(e, val) => setYears(val)}
            renderInput={(params) => <TextField {...params} label="Years" size="small" />}
            sx={{ minWidth: 200 }}
          />
          <Autocomplete
            multiple
            options={monthOptions}
            value={months}
            onChange={(e, val) => setMonths(val)}
            renderInput={(params) => <TextField {...params} label="Months" size="small" />}
            sx={{ minWidth: 200 }}
          />
          <Button variant="contained" onClick={fetchData} disabled={loading}>
            Apply Filters
          </Button>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <DataGrid
          rows={data}
          columns={columns}
          loading={loading}
          autoHeight
          getRowId={(row) => row.id}
          initialState={{
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
          }}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
        />
      </Paper>
    </Box>
  );
}
