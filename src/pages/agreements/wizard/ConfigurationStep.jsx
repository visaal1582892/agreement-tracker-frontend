import { useEffect, useRef, useState } from 'react';
import {
  Autocomplete, Box, Typography, Grid, TextField, Button, Chip, FormControl, Select, MenuItem,
  FormHelperText, IconButton, alpha, Alert,
} from '@mui/material';
import { UploadFile, Delete } from '@mui/icons-material';
import axiosInstance from '../../../api/axiosInstance';
import { ENDPOINTS } from '../../../config/endpoints';
import { BRAND } from '../../../config/theme';
import CollapsibleSection from '../../../components/wizard/CollapsibleSection';
import WizardSectionTitle from '../../../components/wizard/WizardSectionTitle';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';
import Step2Products from './Step2Products';
import Step2SupplyVendors from './Step2SupplyVendors';
import AssetRentalScopeFields from './AssetRentalScopeFields';
import AssetRentalGeographyFields from './AssetRentalGeographyFields';
import AdHocActivityFields from './AdHocActivityFields';
import SettlementRoutingFields from './SettlementRoutingFields';
import {
  isAdHocIncomeType,
  isAssetRentalIncomeType,
  isCommercialContractsIncomeType,
  isDataFeeIncomeType,
} from '../../../utils/incomeTypeUtils';

const DOCUMENT_TYPES = ['AGREEMENT', 'SUPPORTING_DOC', 'EMAIL', 'OTHER'];

const SCOPE_ERROR_FIELDS = ['supplyVendors', 'products', 'assetCategory', 'assetType'];
const GEO_ERROR_FIELDS = ['states', 'storeCount', 'quantityCap'];
const SETTLEMENT_ERROR_FIELDS = ['paymentRealization', 'calculationBasis', 'invoiceVendor'];

function sectionHasError(fieldErrors, fields) {
  return fields.some((field) => fieldErrors[field]);
}

export default function ConfigurationStep({
  state,
  agreement,
  onUpdateDetails,
  onUpdateAsset,
  onUpdateCommercials,
  updateProductRules,
  updateFields,
  fieldErrors = {},
  onClearFieldError,
}) {
  const [incomeTypes, setIncomeTypes] = useState([]);
  const [stateOptions, setStateOptions] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const details = agreement?.details ?? {};
  const asset = agreement?.asset ?? {};
  const vendorIds = state?.vendorIds ?? [];
  const productRules = state?.productRules ?? {
    manufacturers: [],
    divisionRules: [],
    productRules: [],
  };

  useEffect(() => {
    axiosInstance.get(ENDPOINTS.INCOME_TYPES).then(({ data }) => setIncomeTypes(data));
    axiosInstance.get(ENDPOINTS.STATES).then(({ data }) => setStateOptions(Array.isArray(data) ? data : []));
  }, []);

  const isAssetRental = isAssetRentalIncomeType(
    incomeTypes,
    details.incomeTypeId,
    details.incomeTypeName,
  );
  const isAdHoc = isAdHocIncomeType(
    incomeTypes,
    details.incomeTypeId,
    details.incomeTypeName,
  );
  const isDataFee = isDataFeeIncomeType(
    incomeTypes,
    details.incomeTypeId,
    details.incomeTypeName,
  );
  const isCommercialContracts = isCommercialContractsIncomeType(
    incomeTypes,
    details.incomeTypeId,
    details.incomeTypeName,
  );
  const selectedStateIds = details.stateIds ?? [];
  const selectedStates = stateOptions.filter((stateOption) => selectedStateIds.includes(stateOption.id));
  const documents = details.documents ?? [];
  const hasIncomeType = Boolean(details.incomeTypeId);
  const showGeographySection = isAssetRental || isCommercialContracts || isDataFee;

  useEffect(() => {
    if (!isDataFee || !stateOptions.length || selectedStateIds.length > 0) return;
    onUpdateDetails({ stateIds: stateOptions.map((option) => option.id) });
  }, [isDataFee, stateOptions, selectedStateIds.length, onUpdateDetails]);

  const addDocument = (file) => {
    if (!file) return;
    const doc = {
      file,
      fileName: file.name,
      documentType: 'SUPPORTING_DOC',
      preview: URL.createObjectURL(file),
    };
    onUpdateDetails({ documents: [...documents, doc] });
    onClearFieldError?.('documents');
  };

  const removeDoc = (idx) => {
    onUpdateDetails({ documents: documents.filter((_, i) => i !== idx) });
  };

  const mergedFieldErrors = { ...fieldErrors };
  const scopeHasError = sectionHasError(mergedFieldErrors, SCOPE_ERROR_FIELDS);
  const geographyHasError = sectionHasError(mergedFieldErrors, GEO_ERROR_FIELDS);
  const settlementHasError = sectionHasError(mergedFieldErrors, SETTLEMENT_ERROR_FIELDS);
  const documentsHasError = Boolean(mergedFieldErrors.documents);

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <WizardSectionTitle
        title="Configuration"
        info="Scope, geography, settlement routing, and supporting documents."
        mb={2}
      />

      {state.agreementName && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Agreement name: <strong>{state.agreementName}</strong>
        </Typography>
      )}

      {!hasIncomeType && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Select income type, agreement type, and dates in Step 1 before configuring.
        </Alert>
      )}

      {hasIncomeType && (
        <>
          <CollapsibleSection
            title="Scope & Operations"
            description={
              isAssetRental
                ? 'Asset category, type, and remarks for this rental.'
                : 'Supply vendors, manufacturers, divisions, and product scope.'
            }
            forceExpand={scopeHasError}
            hasError={scopeHasError}
          >
            {!isAssetRental && (
              <Step2SupplyVendors
                vendorIds={vendorIds}
                onVendorChange={(ids) => updateFields({ vendorIds: ids ?? [] })}
                error={mergedFieldErrors.supplyVendors}
              />
            )}

            {isAssetRental && (
              <AssetRentalScopeFields
                asset={asset}
                onUpdateAsset={onUpdateAsset}
                fieldErrors={mergedFieldErrors}
              />
            )}

            {isAdHoc && (
              <Box sx={{ mt: isAssetRental ? 0 : 3 }}>
                <AdHocActivityFields
                  state={state}
                  details={details}
                  updateProductRules={updateProductRules}
                  onUpdateDetails={onUpdateDetails}
                  fieldErrors={mergedFieldErrors}
                />
              </Box>
            )}

            {!isAssetRental && !isAdHoc && (
              <Box sx={{ mt: 3 }}>
                <Step2Products
                  state={state}
                  updateProductRules={updateProductRules}
                  error={mergedFieldErrors.products}
                />
              </Box>
            )}
          </CollapsibleSection>

          {showGeographySection && (
            <CollapsibleSection
              title="Geography & Limits"
              description={
                isAssetRental
                  ? 'Regional scope and participating store count.'
                  : 'Regional scope, store counts, and campaign limits.'
              }
              forceExpand={geographyHasError}
              hasError={geographyHasError}
            >
              {isAssetRental && (
                <AssetRentalGeographyFields
                  asset={asset}
                  stateOptions={stateOptions}
                  selectedStateIds={selectedStateIds}
                  onUpdateAsset={onUpdateAsset}
                  onUpdateDetails={onUpdateDetails}
                  fieldErrors={mergedFieldErrors}
                />
              )}

              {isCommercialContracts && (
                <WizardFieldAnchor field="states" error={mergedFieldErrors.states}>
                  <Autocomplete
                  multiple
                  options={stateOptions}
                  value={selectedStates}
                  getOptionLabel={(option) => option.stateName}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  onChange={(_, newValue) => onUpdateDetails({ stateIds: newValue.map((s) => s.id) })}
                  renderInput={(params) => (
                    <TextField {...params} label="Region / States *" size="small" placeholder="Select states" />
                  )}
                />
                </WizardFieldAnchor>
              )}

              {isDataFee && (
                <WizardFieldAnchor field="states" error={mergedFieldErrors.states}>
                  <Autocomplete
                  multiple
                  options={stateOptions}
                  value={selectedStates}
                  getOptionLabel={(option) => option.stateName}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  onChange={(_, newValue) => onUpdateDetails({ stateIds: newValue.map((s) => s.id) })}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Region / States *"
                      size="small"
                      placeholder="All states selected by default — narrow scope if needed"
                    />
                  )}
                />
                </WizardFieldAnchor>
              )}

            </CollapsibleSection>
          )}

          <CollapsibleSection
            title="Settlement & Payment Routing"
            description="Calculation basis, payment realization, payout lead time, and invoice vendor routing. Payout lead time is days after invoice before payout is released."
            forceExpand={settlementHasError}
            hasError={settlementHasError}
          >
            <SettlementRoutingFields
              hideSectionTitle
              vendorIds={vendorIds}
              invoiceVendorId={details.invoiceVendorId}
              payoutBufferDays={details.payoutBufferDays}
              leadTimeBasis={details.leadTimeBasis}
              invoiceGenerationLeadTime={details.invoiceGenerationLeadTime}
              calculationBasis={details.calculationBasis}
              paymentRealizationType={details.paymentRealizationType}
              incomeTypeId={details.incomeTypeId}
              incomeTypeName={details.incomeTypeName}
              onUpdateDetails={onUpdateDetails}
              fieldErrors={mergedFieldErrors}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="Supporting Documents"
            description="Upload contract and supporting files. At least one document is required."
            forceExpand={documentsHasError}
            hasError={documentsHasError}
          >
            <WizardFieldAnchor field="documents" error={mergedFieldErrors.documents}>
            <Box
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addDocument(e.dataTransfer.files[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                border: `2px dashed ${mergedFieldErrors.documents ? BRAND.red : BRAND.borderLight}`,
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
                onChange={(e) => {
                  addDocument(e.target.files[0]);
                  e.target.value = '';
                }}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.eml"
              />
            </Box>

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
                          const nextDocs = [...documents];
                          nextDocs[i] = { ...nextDocs[i], documentType: e.target.value };
                          onUpdateDetails({ documents: nextDocs });
                        }}
                      >
                        {DOCUMENT_TYPES.map((type) => (
                          <MenuItem key={type} value={type}>{type.replace('_', ' ')}</MenuItem>
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
            </WizardFieldAnchor>
          </CollapsibleSection>
        </>
      )}
    </Box>
  );
}
