import { useState } from 'react';
import {
  Box, TextField, Typography, CircularProgress, Alert, alpha, Collapse,
} from '@mui/material';
import { PlaylistAdd, Check } from '@mui/icons-material';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';
import { BRAND } from '../../config/theme';

export default function BulkVendorInput({ selectedVendors, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setExpanded(false);
    setPasteText('');
    setError('');
  };

  const handleBulkResolve = async () => {
    setLoading(true);
    setError('');
    try {
      const ids = pasteText.split(',').map((s) => s.trim()).filter(Boolean);
      const { data } = await axiosInstance.get(ENDPOINTS.VENDORS, {
        params: { ids: ids.join(',') },
      });
      const resolved = data.filter((v) => ids.includes(v.vendorCode) || ids.includes(String(v.id)));
      const merged = [...selectedVendors];
      resolved.forEach((v) => {
        if (!merged.some((m) => m.id === v.id)) merged.push(v);
      });
      onChange(merged);
      handleClose();
    } catch {
      setError('Could not resolve vendor codes. Check and retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ mt: 1.25 }}>
      <Box
        component="button"
        type="button"
        onClick={() => setExpanded((v) => !v)}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.75,
          border: 'none', background: 'none', cursor: 'pointer',
          fontSize: '0.78rem', fontWeight: 600, color: BRAND.red,
          px: 0.5, py: 0.25, borderRadius: 1,
          transition: 'background 0.15s ease',
          '&:hover': { bgcolor: alpha(BRAND.red, 0.06) },
        }}
      >
        <PlaylistAdd sx={{ fontSize: 15 }} />
        {expanded ? 'Hide paste field' : 'Paste vendor codes'}
      </Box>

      <Collapse in={expanded}>
        <Box sx={{
          mt: 1.25,
          p: 2,
          borderRadius: 2.5,
          border: `1px solid ${alpha(BRAND.red, 0.12)}`,
          bgcolor: alpha(BRAND.red, 0.02),
        }}>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748B', mb: 1 }}>
            Comma-separated codes — e.g. V001, V002, V003
          </Typography>
          <TextField
            multiline
            rows={2}
            fullWidth
            autoFocus
            placeholder="V001, V002, V003"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#fff',
                borderRadius: 2,
                fontSize: '0.85rem',
              },
            }}
          />
          {error && <Alert severity="error" sx={{ mt: 1.25, borderRadius: 2 }}>{error}</Alert>}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.25, gap: 1 }}>
            <Box
              component="button"
              type="button"
              onClick={handleClose}
              sx={{
                border: 'none', background: 'none', cursor: 'pointer',
                fontSize: '0.78rem', fontWeight: 500, color: '#64748B', px: 1.5, py: 0.75,
              }}
            >
              Cancel
            </Box>
            <Box
              component="button"
              type="button"
              onClick={handleBulkResolve}
              disabled={!pasteText.trim() || loading}
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.75,
                border: 'none', cursor: 'pointer',
                fontSize: '0.78rem', fontWeight: 700, color: '#fff',
                px: 2, py: 0.75, borderRadius: 2,
                background: BRAND.redGradient,
                opacity: (!pasteText.trim() || loading) ? 0.5 : 1,
                '&:disabled': { cursor: 'not-allowed' },
              }}
            >
              {loading ? <CircularProgress size={14} color="inherit" /> : <Check sx={{ fontSize: 14 }} />}
              Add vendors
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}
