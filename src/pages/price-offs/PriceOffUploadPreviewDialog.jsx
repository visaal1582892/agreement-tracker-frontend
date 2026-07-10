import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { formatPercent } from '../../api/priceOffsApi';
import { BRAND } from '../../config/theme';
import { calculateFinalMarginFraction } from '../../utils/priceOffCalculations';

export default function PriceOffUploadPreviewDialog({
  open,
  preview,
  committing,
  onClose,
  onCommit,
}) {
  if (!preview) return null;

  const errorMessages = (preview.rows ?? [])
    .filter((row) => !row.valid)
    .flatMap((row) => (row.errors ?? []).map((err) => `Row ${row.rowNumber}: ${err}`));

  return (
    <Dialog open={open} onClose={committing ? undefined : onClose} maxWidth="xl" fullWidth>
      <DialogTitle>Upload Preview</DialogTitle>
      <DialogContent dividers>
        {!preview.canCommit && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {preview.errorRows} of {preview.totalRows} row(s) failed validation.
            Fix the highlighted rows (re-upload a clean sheet) before committing.
          </Alert>
        )}
        {preview.canCommit && (
          <Alert severity="success" sx={{ mb: 2 }}>
            All {preview.validRows} row(s) valid. Review and commit to save as DRAFT.
          </Alert>
        )}
        {errorMessages.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {errorMessages.slice(0, 20).map((msg) => (
                <li key={msg}><Typography variant="body2">{msg}</Typography></li>
              ))}
              {errorMessages.length > 20 && (
                <li><Typography variant="body2">…and {errorMessages.length - 20} more</Typography></li>
              )}
            </Box>
          </Alert>
        )}

        <Box sx={{ overflow: 'auto', maxHeight: '60vh', border: `1px solid ${BRAND.borderLight}`, borderRadius: 1 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Row</TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Manufacturer</TableCell>
                <TableCell>L3 Category</TableCell>
                <TableCell>Start</TableCell>
                <TableCell>End</TableCell>
                <TableCell>CP</TableCell>
                <TableCell>MRP</TableCell>
                <TableCell>Final Margin</TableCell>
                <TableCell>Errors</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(preview.rows ?? []).map((row) => (
                <TableRow
                  key={row.rowNumber}
                  sx={{
                    bgcolor: row.valid ? 'transparent' : alpha(BRAND.red, 0.08),
                  }}
                >
                  <TableCell>{row.rowNumber}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{row.productName || '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.productId || '—'}</Typography>
                  </TableCell>
                  <TableCell>{row.manufacturerName || '—'}</TableCell>
                  <TableCell>{row.l3Category || '—'}</TableCell>
                  <TableCell>{row.startDate || '—'}</TableCell>
                  <TableCell>{row.endDate || '—'}</TableCell>
                  <TableCell>{row.cp ?? '—'}</TableCell>
                  <TableCell>{row.mrp ?? '—'}</TableCell>
                  <TableCell>
                    {formatPercent(calculateFinalMarginFraction({
                      discountType: row.discountType,
                      discountTypeLabel: row.discountTypeLabel,
                      cp: row.cp,
                      mrp: row.mrp,
                      medplusContribution: row.medplusContribution,
                    }) ?? row.finalMarginPercent)}
                  </TableCell>
                  <TableCell>
                    {(row.errors ?? []).length
                      ? (row.errors ?? []).join('; ')
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={committing}>Cancel</Button>
        <Button
          variant="contained"
          onClick={onCommit}
          disabled={!preview.canCommit || committing}
        >
          {committing ? 'Saving…' : `Commit ${preview.validRows} Draft(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
