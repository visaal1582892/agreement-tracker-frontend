import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Stack,
} from '@mui/material';
import {
  flattenJbpReviewRows,
  resolveJbpReviewHeaders,
  jbpFrequencyLabel,
} from '../../../utils/jbpMatrixUtils';

export default function JbpMatrixReviewTable({
  stagedWorkbook,
  configurations = [],
  title = 'JBP Relational Matrix',
  financialYearStartMonth = 4,
}) {
  const [selectedConfigKey, setSelectedConfigKey] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const rawSheets = stagedWorkbook?.sheets ?? [];

  // Group sheets robustly by their true relational database identifier or configuration index
  const groupedConfigurations = useMemo(() => {
    if (!rawSheets.length) return [];

    const map = new Map();

    rawSheets.forEach((sheet, idx) => {
      // 1. Determine a stable configuration identifier (check database properties first before regex)
      let configKey;
      if (sheet.configIndex != null && !Number.isNaN(Number(sheet.configIndex))) {
        configKey = Number(sheet.configIndex);
      } else if (sheet.configurationIndex != null && !Number.isNaN(Number(sheet.configurationIndex))) {
        configKey = Number(sheet.configurationIndex);
      } else if (sheet.configId != null && !Number.isNaN(Number(sheet.configId))) {
        configKey = Number(sheet.configId);
      } else if (sheet.jbpConfigurationId != null && !Number.isNaN(Number(sheet.jbpConfigurationId))) {
        configKey = Number(sheet.jbpConfigurationId);
      } else if (sheet.configurationId != null && !Number.isNaN(Number(sheet.configurationId))) {
        configKey = Number(sheet.configurationId);
      } else if (sheet.configNumber != null && !Number.isNaN(Number(sheet.configNumber))) {
        configKey = Number(sheet.configNumber);
      } else {
        // Fallback: only use regex on sheetName if no explicit database identifier was attached to the sheet
        const match = /^Config(\d+)-/i.exec(sheet.sheetName || '');
        configKey = match ? parseInt(match[1], 10) : 1;
      }

      if (!map.has(configKey)) {
        // 2. Find matching configuration metadata from the `configurations` prop
        let meta = null;
        if (Array.isArray(configurations) && configurations.length > 0) {
          meta = configurations.find(
            (c) =>
              c.id === configKey ||
              c.jbpConfigurationId === configKey ||
              c.configId === configKey ||
              c.configIndex === configKey ||
              c.index === configKey
          );
          if (!meta) {
            // Index-based matching fallback (if configKey is 1-based index 1, 2...)
            const idxMatch =
              configKey >= 1 && configKey <= configurations.length
                ? configKey - 1
                : map.size < configurations.length
                  ? map.size
                  : 0;
            meta = configurations[idxMatch] || null;
          }
        }

        const displayNumber = map.size + 1;
        const configName =
          sheet.configName ||
          (meta && (meta.name || meta.configName || meta.configLabel)) ||
          `Configuration ${displayNumber}`;

        map.set(configKey, {
          key: configKey,
          displayNumber,
          name: configName,
          meta: meta,
          sheets: [],
        });
      }

      map.get(configKey).sheets.push(sheet);
    });

    return Array.from(map.values());
  }, [rawSheets, configurations]);

  // Synchronize initial configuration selection
  useEffect(() => {
    if (groupedConfigurations.length > 0) {
      if (selectedConfigKey == null || !groupedConfigurations.some((g) => g.key === selectedConfigKey)) {
        setSelectedConfigKey(groupedConfigurations[0].key);
        setActiveTab(0);
      }
    }
  }, [groupedConfigurations, selectedConfigKey]);

  if (!rawSheets.length || groupedConfigurations.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No JBP matrix data available.
      </Typography>
    );
  }

  const activeConfig =
    groupedConfigurations.find((g) => g.key === selectedConfigKey) || groupedConfigurations[0];
  const activeSheets = activeConfig?.sheets || [];
  const activeSheet = activeSheets[activeTab] || activeSheets[0];

  // Synchronously change config and reset tab to 0 to prevent out-of-bounds rendering crashes
  const handleConfigChange = (e) => {
    setSelectedConfigKey(e.target.value);
    setActiveTab(0);
  };

  const flattenedRows = useMemo(() => {
    if (!activeSheet) return [];
    return flattenJbpReviewRows(activeSheet, financialYearStartMonth);
  }, [activeSheet, financialYearStartMonth]);

  const reviewHeaders = activeSheet ? resolveJbpReviewHeaders(activeSheet) : {};

  // Resolve payment frequencies for the active configuration
  const paymentIntervals =
    activeConfig?.meta?.paymentIntervals ||
    activeConfig?.meta?.paymentInterval ||
    activeSheet?.paymentIntervals ||
    activeSheet?.paymentInterval ||
    [];
  const intervalsList = Array.isArray(paymentIntervals) ? paymentIntervals : [paymentIntervals].filter(Boolean);

  return (
    <Box>
      {title && (
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          {title}
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center', mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Configuration</InputLabel>
          <Select
            label="Configuration"
            value={activeConfig?.key || ''}
            onChange={handleConfigChange}
          >
            {groupedConfigurations.map((cfg) => (
              <MenuItem key={cfg.key} value={cfg.key}>
                {cfg.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {intervalsList.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Payment Frequencies:
            </Typography>
            <Stack direction="row" spacing={1}>
              {intervalsList.map((interval) => (
                <Chip
                  key={interval}
                  label={jbpFrequencyLabel(interval)}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>
        )}
      </Box>

      {activeSheets.length > 0 && (
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          {activeSheets.map((sheet, index) => {
            // Clean tab label by stripping sequential sheet numbering prefixes
            const label = (sheet.configLabel || sheet.sheetName || '')
              .replace(/^Config\d+[-_]/i, '')
              .replace(/^[_-]+/, '');
            return <Tab key={sheet.sheetName || index} label={label || `Period ${index + 1}`} value={index} />;
          })}
        </Tabs>
      )}

      {flattenedRows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No commercial periods defined for this target interval.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto', maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {reviewHeaders.parentPeriod && <TableCell>{reviewHeaders.parentPeriod}</TableCell>}
                {reviewHeaders.subPeriod && <TableCell>{reviewHeaders.subPeriod}</TableCell>}
                {reviewHeaders.period && <TableCell>{reviewHeaders.period}</TableCell>}
                <TableCell>{reviewHeaders.slabTier}</TableCell>
                <TableCell align="right">{reviewHeaders.target}</TableCell>
                <TableCell align="right">{reviewHeaders.qualifierPercent}</TableCell>
                <TableCell>{reviewHeaders.payoutType}</TableCell>
                <TableCell align="right">{reviewHeaders.payout}</TableCell>
                <TableCell align="right">{reviewHeaders.maxPurchase}</TableCell>
                <TableCell align="right">{reviewHeaders.maxPayout}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {flattenedRows.map((row, index) => (
                <TableRow key={`${row.key || index}-${index}`}>
                  {reviewHeaders.parentPeriod && (
                    <TableCell
                      sx={{
                        fontWeight: row.parentBold ? 700 : 400,
                        color: row.parentBold ? 'text.primary' : 'text.disabled',
                      }}
                    >
                      {row.parentPeriodDisplay}
                    </TableCell>
                  )}
                  {reviewHeaders.subPeriod && <TableCell>{row.subPeriodName}</TableCell>}
                  {reviewHeaders.period && <TableCell>{row.periodName}</TableCell>}
                  <TableCell>{row.slabTier}</TableCell>
                  <TableCell align="right">{row.target}</TableCell>
                  <TableCell align="right">{row.qualifierPercent}</TableCell>
                  <TableCell>{row.payoutType}</TableCell>
                  <TableCell align="right">{row.payout}</TableCell>
                  <TableCell align="right">{row.maxPurchase}</TableCell>
                  <TableCell align="right">{row.maxPayout}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}