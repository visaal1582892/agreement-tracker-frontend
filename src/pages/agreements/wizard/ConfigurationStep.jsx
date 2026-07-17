import { useEffect, useState } from 'react';
import {
  Box, Typography, Alert,
} from '@mui/material';
import axiosInstance from '../../../api/axiosInstance';
import { ENDPOINTS } from '../../../config/endpoints';
import CollapsibleSection from '../../../components/wizard/CollapsibleSection';
import WizardSectionTitle from '../../../components/wizard/WizardSectionTitle';
import AgreementFilesSection from '../../../components/upload/AgreementFilesSection';
import Step2Products from './Step2Products';
import Step2SupplyVendors from './Step2SupplyVendors';
import AssetRentalScopeFields from './AssetRentalScopeFields';
import AssetRentalGeographyFields from './AssetRentalGeographyFields';
import PartnerLocationFields from './PartnerLocationFields';
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
const GEO_ERROR_FIELDS = ['geographyMode', 'partnerState', 'partnerCity', 'storeCount', 'quantityCap'];
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
  vendorsLocked = false,
}) {
  const [incomeTypes, setIncomeTypes] = useState([]);
  const details = agreement?.details ?? {};
  const asset = agreement?.asset ?? {};
  const vendorIds = state?.vendorIds ?? [];
  const vendors = state?.vendors ?? [];
  const productRules = state?.productRules ?? {
    manufacturers: [],
    divisionRules: [],
    productRules: [],
  };

  useEffect(() => {
    axiosInstance.get(ENDPOINTS.INCOME_TYPES).then(({ data }) => setIncomeTypes(data));
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
  const documents = details.documents ?? [];
  const hasIncomeType = Boolean(details.incomeTypeId);
  const showGeographySection = isAssetRental || isCommercialContracts || isDataFee;

  const mergedFieldErrors = { ...fieldErrors };
  const scopeHasError = sectionHasError(mergedFieldErrors, SCOPE_ERROR_FIELDS);
  const geographyHasError = sectionHasError(mergedFieldErrors, GEO_ERROR_FIELDS);
  const settlementHasError = sectionHasError(mergedFieldErrors, SETTLEMENT_ERROR_FIELDS);
  const documentsHasError = Boolean(mergedFieldErrors.documents);

  const handleDocumentsChange = (nextDocuments) => {
    onUpdateDetails({ documents: nextDocuments });
  };

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
                selectedVendors={vendors.map((vendor) => ({
                  id: vendor.vendorId,
                  vendorName: vendor.vendorName,
                }))}
                onVendorChange={(selected) => updateFields({
                  vendorIds: selected.map((vendor) => vendor.id),
                  vendors: selected.map((vendor) => ({
                    vendorId: vendor.id,
                    vendorName: vendor.vendorName,
                  })),
                })}
                error={mergedFieldErrors.supplyVendors}
                disabled={vendorsLocked}
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
              {(isCommercialContracts || isDataFee) && (
                <PartnerLocationFields
                  details={details}
                  onUpdateDetails={onUpdateDetails}
                  fieldErrors={mergedFieldErrors}
                  onClearFieldError={onClearFieldError}
                  allowAllLocations={isDataFee}
                />
              )}

              {isAssetRental && (
                <AssetRentalGeographyFields
                  asset={asset}
                  details={details}
                  onUpdateAsset={onUpdateAsset}
                  onUpdateDetails={onUpdateDetails}
                  fieldErrors={mergedFieldErrors}
                  onClearFieldError={onClearFieldError}
                />
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
            <AgreementFilesSection
              documents={documents}
              onDocumentsChange={handleDocumentsChange}
              documentTypes={DOCUMENT_TYPES}
              fieldError={mergedFieldErrors.documents}
              onClearFieldError={() => onClearFieldError?.('documents')}
            />
          </CollapsibleSection>
        </>
      )}
    </Box>
  );
}
