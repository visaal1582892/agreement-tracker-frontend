import { useEffect, useRef, useState } from 'react';
import {
  Autocomplete, Box, Typography, Grid, FormControl, InputLabel, Select, MenuItem,
  TextField, Button, Chip, FormHelperText, IconButton, alpha, Paper,
} from '@mui/material';
import { UploadFile, Delete } from '@mui/icons-material';
import axiosInstance from '../../../api/axiosInstance';
import { ENDPOINTS } from '../../../config/endpoints';
import { BRAND } from '../../../config/theme';
import DateRangeFields from '../../../components/forms/DateRangeFields';

const DOCUMENT_TYPES = ['AGREEMENT', 'SUPPORTING_DOC', 'EMAIL', 'OTHER'];

const notesFieldSx = {
  '& .MuiOutlinedInput-root': {
    '& fieldset': { borderColor: BRAND.borderLight },
    '&:hover fieldset': { borderColor: '#94A3B8' },
    '&.Mui-focused fieldset': { borderColor: BRAND.red, borderWidth: 2 },
  },
};

export default function AgreementDetailsStep({
  state,
  agreement,
  onUpdateDetails,
  documentError,
  onClearDocumentError,
}) {
  const [incomeTypes, setIncomeTypes] = useState([]);
  const [agreementTypes, setAgreementTypes] = useState([]);
  const [stateOptions, setStateOptions] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const details = agreement.details;

  useEffect(() => {
    axiosInstance.get(ENDPOINTS.INCOME_TYPES).then(({ data }) => setIncomeTypes(data));
    axiosInstance.get(ENDPOINTS.AGREEMENT_TYPES).then(({ data }) => setAgreementTypes(data));
    axiosInstance.get(ENDPOINTS.STATES).then(({ data }) => setStateOptions(Array.isArray(data) ? data : []));
  }, []);

  const addDocument = (file) => {
    if (!file) return;
    const doc = {
      file,
      fileName: file.name,
      documentType: 'SUPPORTING_DOC',
      preview: URL.createObjectURL(file),
    };
    onUpdateDetails({ documents: [...(details.documents || []), doc] });
    onClearDocumentError?.();
  };

  const handleFileAdd = (e) => {
    addDocument(e.target.files[0]);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addDocument(e.dataTransfer.files[0]);
  };

  const removeDoc = (idx) => {
    onUpdateDetails({ documents: details.documents.filter((_, i) => i !== idx) });
  };

  const selectedStateIds = details.stateIds ?? [];
  const selectedStates = stateOptions.filter((s) => selectedStateIds.includes(s.id));
  const documents = details.documents || [];

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" fontWeight={600} mb={0.5}>Agreement Details</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Fill in contract details and upload supporting documents.
      </Typography>

      {state.agreementName && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Agreement name: <strong>{state.agreementName}</strong> (auto-generated when income type and dates are saved)
        </Typography>
      )}

      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 2.5,
          border: `1px solid ${BRAND.borderLight}`,
          bgcolor: BRAND.white,
        }}
      >
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth size="small">
              <InputLabel required>Income Type</InputLabel>
              <Select
                value={details.incomeTypeId || ''}
                label="Income Type *"
                onChange={(e) => onUpdateDetails({ incomeTypeId: e.target.value })}
              >
                {incomeTypes.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth size="small">
              <InputLabel required>Agreement Type</InputLabel>
              <Select
                value={details.agreementTypeId || ''}
                label="Agreement Type *"
                onChange={(e) => onUpdateDetails({ agreementTypeId: e.target.value })}
              >
                {agreementTypes.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={12}>
            <Autocomplete
              multiple
              options={stateOptions}
              value={selectedStates}
              getOptionLabel={(option) => option.stateName}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_, newValue) => onUpdateDetails({ stateIds: newValue.map((s) => s.id) })}
              renderInput={(params) => (
                <TextField {...params} label="States" size="small" placeholder="Select states" />
              )}
            />
          </Grid>

          <Grid size={12}>
            <DateRangeFields
              startDate={details.startDate}
              expiryDate={details.expiryDate}
              onChange={(fields) => onUpdateDetails(fields)}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              label="Notes (optional)"
              multiline
              rows={2}
              fullWidth
              size="small"
              value={details.notes || ''}
              onChange={(e) => onUpdateDetails({ notes: e.target.value })}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
              sx={notesFieldSx}
            />
          </Grid>

          <Grid size={12}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              Documents *
            </Typography>
            <Box
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                border: `2px dashed ${documentError ? BRAND.red : BRAND.borderLight}`,
                borderRadius: '10px',
                bgcolor: dragOver ? alpha(BRAND.red, 0.04) : BRAND.bgGray,
                p: 2.5,
                textAlign: 'center',
                mb: 1.5,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, border-color 0.15s ease',
                '&:hover': { bgcolor: alpha(BRAND.red, 0.03), borderColor: '#94A3B8' },
              }}
            >
              <UploadFile sx={{ fontSize: 36, color: BRAND.textSecondary, mb: 0.5 }} />
              <Typography variant="body2" color="text.secondary" mb={1}>
                Drag & drop or click to upload
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                Browse Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={handleFileAdd}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.eml"
              />
            </Box>

            {documentError && (
              <FormHelperText error sx={{ mb: 1 }}>{documentError}</FormHelperText>
            )}

            {documents.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {documents.map((doc, i) => (
                  <Box
                    key={`${doc.fileName}-${i}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      border: `1px solid ${BRAND.borderLight}`,
                      borderRadius: '8px',
                      px: 1.5,
                      py: 1,
                      bgcolor: BRAND.white,
                    }}
                  >
                    <Chip label={doc.fileName} size="small" sx={{ flex: 1, justifyContent: 'flex-start', maxWidth: '100%' }} />
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <Select
                        value={doc.documentType}
                        onChange={(e) => {
                          const docs = [...documents];
                          docs[i] = { ...docs[i], documentType: e.target.value };
                          onUpdateDetails({ documents: docs });
                        }}
                      >
                        {DOCUMENT_TYPES.map((t) => (
                          <MenuItem key={t} value={t}>{t.replace('_', ' ')}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <IconButton size="small" color="error" onClick={() => removeDoc(i)} aria-label="Remove document">
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
