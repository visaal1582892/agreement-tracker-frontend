import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  MenuItem,
  CircularProgress,
  Grid,
  Chip,
  Avatar,
  Stack,
  FormControl,
  InputLabel,
  Select,
  useTheme
} from '@mui/material';
import {
  SettingsApplications,
  PlayCircleFilled,
  CheckCircle,
  Schedule,
  Sync
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import apiClient from '../../api/axiosInstance';
import { alpha } from '@mui/material/styles';

export default function RevenueRecognitionSchedulerPage() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [runningManual, setRunningManual] = useState(false);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1);
  const [supplierId, setSupplierId] = useState('');
  const [agreementId, setAgreementId] = useState('');

  const fetchSettings = async () => {
    try {
      const res = await apiClient.get('/revenue-recognition/settings');
      setSettings(res.data);
    } catch (err) {
      console.error(err);
      enqueueSnackbar('Failed to fetch settings', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    let intervalId;
    if (settings && settings.currentStatus === 'RUNNING') {
      intervalId = setInterval(() => {
        fetchSettings();
      }, 5000);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [settings?.currentStatus]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await apiClient.put('/revenue-recognition/settings', settings);
      setSettings(res.data);
      enqueueSnackbar('Scheduler configuration saved.', { variant: 'success' });
    } catch (err) {
      console.error(err);
      enqueueSnackbar('Failed to save settings', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleRunManual = async () => {
    const monthKeys = [];
    let currY = startYear;
    let currM = startMonth;

    while (currY < endYear || (currY === endYear && currM <= endMonth)) {
      monthKeys.push(currY * 100 + currM);
      currM++;
      if (currM > 12) {
        currM = 1;
        currY++;
      }
    }

    if (monthKeys.length === 0) {
      enqueueSnackbar('Invalid date range. Ensure start date is before end date.', { variant: 'warning' });
      return;
    }

    setRunningManual(true);
    try {
      const payload = {
        monthKeys,
        supplierId: supplierId ? parseInt(supplierId, 10) : null,
        agreementId: agreementId ? parseInt(agreementId, 10) : null
      };
      await apiClient.post('/revenue-recognition/settings/run-manual', payload);
      enqueueSnackbar('Manual batch execution completed successfully', { variant: 'success' });
      fetchSettings();
    } catch (err) {
      console.error(err);
      enqueueSnackbar('Manual execution failed', { variant: 'error' });
      fetchSettings();
    } finally {
      setRunningManual(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  const isRunning = runningManual || (settings && settings.currentStatus === 'RUNNING');
  
  const years = [2023, 2024, 2025, 2026, 2027];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
      
      {/* Page Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Avatar sx={{ bgcolor: theme.palette.primary.main, mr: 2, width: 56, height: 56 }}>
          <SettingsApplications fontSize="large" />
        </Avatar>
        <Box>
          <Typography variant="h4" fontWeight="800" color="text.primary">
            Revenue Recognition Engine
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Manage scheduled automation and manual batch processing for agreement payouts.
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={4}>
        {/* Left Column: Scheduled Config */}
        <Grid item xs={12} md={6}>
          <Card elevation={4} sx={{ borderRadius: 3, height: '100%', borderTop: `4px solid ${theme.palette.primary.main}` }}>
            <CardHeader 
              title="Automated Schedule" 
              titleTypographyProps={{ fontWeight: 600, variant: 'h6' }}
              avatar={<Schedule color="primary" />}
            />
            <CardContent>
              {settings && (
                <Stack spacing={3}>
                  <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.04), borderRadius: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch 
                          checked={settings.isEnabled} 
                          onChange={(e) => setSettings({ ...settings, isEnabled: e.target.checked })} 
                          color="primary"
                        />
                      }
                      label={
                        <Typography fontWeight="500">
                          {settings.isEnabled ? 'Scheduler is Active' : 'Scheduler is Disabled'}
                        </Typography>
                      }
                    />
                  </Box>

                  <TextField
                    label="Cron Expression"
                    variant="outlined"
                    value={settings.cronExpression}
                    onChange={(e) => setSettings({ ...settings, cronExpression: e.target.value })}
                    fullWidth
                    disabled={!settings.isEnabled}
                    helperText="Standard quartz cron expression (e.g. 0 0 1 1 * ?)"
                  />

                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField
                        label="Time Zone"
                        value={settings.timeZone}
                        onChange={(e) => setSettings({ ...settings, timeZone: e.target.value })}
                        fullWidth
                        disabled={!settings.isEnabled}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        label="Lookback Window (Months)"
                        type="number"
                        value={settings.lookbackWindowMonths}
                        onChange={(e) => setSettings({ ...settings, lookbackWindowMonths: parseInt(e.target.value) })}
                        fullWidth
                        disabled={!settings.isEnabled}
                        InputProps={{ inputProps: { min: 1, max: 12 } }}
                      />
                    </Grid>
                  </Grid>

                  <Button 
                    variant="contained" 
                    size="large"
                    onClick={handleSaveSettings} 
                    disabled={saving} 
                    sx={{ alignSelf: 'flex-start', px: 4, py: 1, borderRadius: 2 }}
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <CheckCircle />}
                  >
                    Save Configuration
                  </Button>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column: Engine Status */}
        <Grid item xs={12} md={6}>
          <Card elevation={4} sx={{ borderRadius: 3, height: '100%', background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.secondary.light, 0.05)} 100%)` }}>
            <CardHeader 
              title="Engine Status" 
              titleTypographyProps={{ fontWeight: 600, variant: 'h6' }}
              avatar={<Sync color="secondary" />}
              action={
                <Button size="small" variant="outlined" onClick={fetchSettings} sx={{ borderRadius: 2 }}>
                  Refresh
                </Button>
              }
            />
            <CardContent>
              {settings && (
                <Stack spacing={3}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body1" fontWeight="600" color="text.secondary">Current State</Typography>
                    <Chip 
                      label={settings.currentStatus} 
                      color={settings.currentStatus === 'RUNNING' ? 'primary' : settings.currentStatus === 'FAILED' ? 'error' : 'success'} 
                      variant={settings.currentStatus === 'RUNNING' ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 'bold', px: 1, '& .MuiChip-label': { letterSpacing: 1 } }}
                    />
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight="bold">Last Successful Run</Typography>
                      <Typography variant="body1" fontWeight="500">
                        {settings.lastSuccessfulRun ? new Date(settings.lastSuccessfulRun).toLocaleString() : 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight="bold">Last Failed Run</Typography>
                      <Typography variant="body1" fontWeight="500" color={settings.lastFailedRun ? 'error.main' : 'text.primary'}>
                        {settings.lastFailedRun ? new Date(settings.lastFailedRun).toLocaleString() : 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight="bold">Configuration Updated At</Typography>
                      <Typography variant="body2">
                        {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : 'N/A'}
                      </Typography>
                    </Grid>
                  </Grid>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Full Width: Manual Execution */}
        <Grid item xs={12}>
          <Card elevation={4} sx={{ borderRadius: 3, borderLeft: `4px solid ${theme.palette.secondary.main}` }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PlayCircleFilled color="secondary" sx={{ mr: 1.5, fontSize: 32 }} />
                <Typography variant="h6" fontWeight="600">Manual Batch Execution</Typography>
              </Box>
              <Typography variant="body1" color="text.secondary" mb={4} maxWidth="800px">
                Instantly run the revenue recognition aggregation engine for a specific timeframe. 
                The system will automatically extract all agreements active during this period, process all applicable slabs and constraints, and upsert the finalized bucketed payouts.
              </Typography>

              <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap', bgcolor: alpha(theme.palette.secondary.main, 0.03), p: 3, borderRadius: 2, border: '1px solid', borderColor: alpha(theme.palette.secondary.main, 0.1) }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <FormControl size="small" sx={{ width: 120, bgcolor: 'background.paper' }}>
                    <InputLabel>Start Month</InputLabel>
                    <Select value={startMonth} label="Start Month" onChange={(e) => setStartMonth(e.target.value)}>
                      {months.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ width: 120, bgcolor: 'background.paper' }}>
                    <InputLabel>Start Year</InputLabel>
                    <Select value={startYear} label="Start Year" onChange={(e) => setStartYear(e.target.value)}>
                      {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Stack>

                <Typography variant="overline" color="text.disabled" fontWeight="bold">UNTIL</Typography>

                <Stack direction="row" spacing={2} alignItems="center">
                  <FormControl size="small" sx={{ width: 120, bgcolor: 'background.paper' }}>
                    <InputLabel>End Month</InputLabel>
                    <Select value={endMonth} label="End Month" onChange={(e) => setEndMonth(e.target.value)}>
                      {months.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ width: 120, bgcolor: 'background.paper' }}>
                    <InputLabel>End Year</InputLabel>
                    <Select value={endYear} label="End Year" onChange={(e) => setEndYear(e.target.value)}>
                      {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Stack>

                <TextField
                  label="Supplier ID (Optional)"
                  variant="outlined"
                  size="small"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  sx={{ bgcolor: 'background.paper', width: 180 }}
                />

                <TextField
                  label="Agreement ID (Optional)"
                  variant="outlined"
                  size="small"
                  value={agreementId}
                  onChange={(e) => setAgreementId(e.target.value)}
                  sx={{ bgcolor: 'background.paper', width: 180 }}
                />

                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  onClick={handleRunManual}
                  disabled={isRunning}
                  sx={{ ml: 'auto', px: 5, py: 1.5, borderRadius: 8, fontWeight: 'bold' }}
                  startIcon={isRunning ? <CircularProgress size={20} color="inherit" /> : <PlayCircleFilled />}
                >
                  {isRunning ? 'Processing Batch...' : 'Execute Calculation Engine'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
