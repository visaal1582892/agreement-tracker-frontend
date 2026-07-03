import { useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  flattenJbpReviewRows,
  resolveJbpReviewHeaders,
} from '../../../utils/jbpMatrixUtils';

export default function JbpMatrixReviewTable({
  stagedWorkbook,
  title = 'JBP Relational Matrix',
}) {
  const [activeTab, setActiveTab] = useState(0);
  const sheets = stagedWorkbook?.sheets ?? [];
  const activeSheet = sheets[activeTab];
  const reviewHeaders = resolveJbpReviewHeaders(activeSheet);

  const flattenedRows = useMemo(
    () => flattenJbpReviewRows(activeSheet),
    [activeSheet],
  );

  if (!sheets.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No JBP matrix data available.
      </Typography>
    );
  }

  return (
    <Box>
      {title && (
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          {title}
        </Typography>
      )}

      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {sheets.map((sheet, index) => (
          <Tab key={sheet.sheetName} label={sheet.configLabel || sheet.sheetName} value={index} />
        ))}
      </Tabs>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              {reviewHeaders.parentPeriod && <TableCell>{reviewHeaders.parentPeriod}</TableCell>}
              {reviewHeaders.subPeriod && <TableCell>{reviewHeaders.subPeriod}</TableCell>}
              {reviewHeaders.period && <TableCell>{reviewHeaders.period}</TableCell>}
              <TableCell>{reviewHeaders.slabTier}</TableCell>
              <TableCell>{reviewHeaders.targetType}</TableCell>
              <TableCell align="right">{reviewHeaders.target}</TableCell>
              <TableCell align="right">{reviewHeaders.qualifierPercent}</TableCell>
              <TableCell>{reviewHeaders.payoutType}</TableCell>
              <TableCell align="right">{reviewHeaders.payout}</TableCell>
              <TableCell align="right">{reviewHeaders.maxPurchase}</TableCell>
              <TableCell align="right">{reviewHeaders.maxPayout}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {flattenedRows.map((row) => (
              <TableRow key={row.key}>
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
                <TableCell
                  sx={row.targetTypeLocked ? { color: 'text.secondary', fontStyle: 'italic' } : undefined}
                >
                  {row.targetType}
                  {row.targetTypeLocked ? ' (locked)' : ''}
                </TableCell>
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
    </Box>
  );
}
