import { Box, Alert } from '@mui/material';
import CollapsibleSection from '../../../components/wizard/CollapsibleSection';
import WizardSectionTitle from '../../../components/wizard/WizardSectionTitle';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';
import AssetPayoutFields from './AssetPayoutFields';
import CommercialAgreementsJbpSection from './CommercialAgreementsJbpSection';
import DataFeeCommercialFields from './DataFeeCommercialFields';
import HybridCommercialFields from './HybridCommercialFields';
import StoreMappingImporter from './StoreMappingImporter';
import { hasPersistedContractDetails } from '../../../utils/agreementWizardUtils';
import {
  isAdHocIncomeType,
  isAssetRentalIncomeType,
  isCommercialContractsIncomeType,
  isDataFeeIncomeType,
} from '../../../utils/incomeTypeUtils';

export default function CommercialStructureStep({
  agreement,
  onUpdateCommercials,
  onUpdateAsset,
  serverAgreementId,
  sourceAgreement,
  onCommercialsAdvance,
  fieldErrors = {},
}) {
  const persisted = hasPersistedContractDetails(sourceAgreement);
  const incomeTypeId = agreement.details?.incomeTypeId ?? sourceAgreement?.incomeTypeId;
  const incomeTypeName = agreement.details?.incomeTypeName ?? sourceAgreement?.incomeTypeName;
  const isAssetRental = isAssetRentalIncomeType([], incomeTypeId, incomeTypeName);
  const isCommercialContracts = isCommercialContractsIncomeType([], incomeTypeId, incomeTypeName);
  const isAdHoc = isAdHocIncomeType([], incomeTypeId, incomeTypeName);
  const isDataFee = isDataFeeIncomeType([], incomeTypeId, incomeTypeName);
  const storeScopeHasError = Boolean(fieldErrors.storeMappings);
  const commercialHasError = Boolean(
    fieldErrors.flatPayout
      || fieldErrors.assetPayoutPeriods
      || fieldErrors.payoutPerStore
      || fieldErrors.jbpStructure
      || fieldErrors.commercialValue
      || fieldErrors.flatBaselineFrequency
      || fieldErrors.commercialComponent,
  );

  const handleJbpCommitted = (committed) => {
    onUpdateCommercials?.({ jbpCommitted: committed });
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <WizardSectionTitle
        title="Commercial Structure"
        info={
          isAssetRental
            ? 'Map participating stores, then configure payout structure.'
            : isCommercialContracts
              ? 'Configure Joint Business Plan targets via the multi-configuration workbook engine.'
              : 'Configure flat baseline and performance slab targets.'
        }
        mb={0}
      />

      {!persisted && (
        <Alert severity="warning">
          Contract dates must be saved in Step 1 before configuring commercials.
        </Alert>
      )}

      {persisted && isAssetRental && (
        <>
          <CollapsibleSection
            title="Participating Store Scope (Excel Mapping)"
            description="Download template, upload store codes, and review mapped outlets."
            forceExpand={storeScopeHasError}
            hasError={storeScopeHasError}
          >
            <StoreMappingImporter
              agreementVersionId={serverAgreementId}
              fieldError={fieldErrors.storeMappings}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="Base Commercials"
            description="Flat payout or per-store payout schedule."
            forceExpand={commercialHasError}
            hasError={commercialHasError}
          >
            <AssetPayoutFields
              asset={agreement.asset}
              onUpdateAsset={onUpdateAsset}
              hideSectionTitle
              fieldErrors={fieldErrors}
            />
          </CollapsibleSection>
        </>
      )}

      {persisted && isCommercialContracts && (
        <WizardFieldAnchor field="jbpStructure" error={fieldErrors.jbpStructure || fieldErrors.commercialValue || fieldErrors.flatBaselineFrequency}>
          <CommercialAgreementsJbpSection
            agreementVersionId={serverAgreementId}
            commercials={agreement.commercials ?? {}}
            onUpdateCommercials={onUpdateCommercials}
            fieldError={fieldErrors.jbpStructure || fieldErrors.commercialValue || fieldErrors.flatBaselineFrequency}
            fieldErrors={fieldErrors}
            onJbpCommitted={handleJbpCommitted}
            onCommercialsAdvance={onCommercialsAdvance}
            initialJbpCommitted={Boolean(agreement.commercials?.jbpCommitted ?? sourceAgreement?.jbpCommitted)}
          />
        </WizardFieldAnchor>
      )}

      {persisted && isAdHoc && (
        <CollapsibleSection
          title="Base Commercials"
          description="Flat payout or slab-based incentive. QPS locks payout frequency to One-Time."
          forceExpand={commercialHasError}
          hasError={commercialHasError}
        >
          <HybridCommercialFields
            commercials={agreement.commercials ?? {}}
            onUpdate={onUpdateCommercials}
            serverAgreementId={serverAgreementId}
            sourceAgreement={sourceAgreement}
            incomeTypeId={incomeTypeId}
            incomeTypeName={incomeTypeName}
            lockOneTimeFrequency
            fieldErrors={fieldErrors}
          />
        </CollapsibleSection>
      )}

      {persisted && isDataFee && (
        <CollapsibleSection
          title="Base Commercials"
          description="Flat baseline payout and frequency."
          forceExpand={commercialHasError}
          hasError={commercialHasError}
        >
          <DataFeeCommercialFields
            commercials={agreement.commercials ?? {}}
            onUpdate={onUpdateCommercials}
          />
        </CollapsibleSection>
      )}
    </Box>
  );
}
