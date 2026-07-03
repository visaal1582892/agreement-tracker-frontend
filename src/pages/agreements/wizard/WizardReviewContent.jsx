import { useEffect, useState } from 'react';
import { Box, Typography, Chip, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import dayjs from 'dayjs';
import { useSnackbar } from 'notistack';
import CollapsibleSection from '../../../components/wizard/CollapsibleSection';
import { formatTenureFromDates } from '../../../components/forms/DateRangeFields';
import { fetchContactsCutoffs, fetchSlabs } from '../../../api/commercialApi';
import { fetchStoreMappings } from '../../../api/storeMappingApi';
import StoreMappingReviewSummary from './StoreMappingReviewSummary';
import CommercialsUploadModal from './CommercialsUploadModal';
import JbpReviewShowcase from './JbpReviewShowcase';
import { getIncomeTypeDisplayName, INCOME_TYPE_NAMES } from '../../../constants/incomeTypeNames';
import { CALCULATION_BASIS_LABELS } from '../../../constants/calculationBasis';
import {
  PAYMENT_REALIZATION_OPTIONS,
  PAYMENT_REALIZATION_TYPE,
  PAYOUT_FREQUENCY_OPTIONS,
  deriveHybridFlags,
} from '../../../constants/commercialStructure';
import { LEAD_TIME_BASIS, LEAD_TIME_BASIS_OPTIONS } from '../../../constants/leadTimeBasis';
import ScopeOperationsReview from '../../../components/review/ScopeOperationsReview';

const REVIEW_SECTION_SX = {
  mb: 0,
  bgcolor: '#fff',
  border: '1px solid',
  borderColor: 'grey.200',
  borderRadius: '12px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};

const REVIEW_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
  gap: 3,
};

const REVIEW_STACK_SX = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
};

function ReviewRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', py: 0.75 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 180, flexShrink: 0 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={500}>{value || '—'}</Typography>
    </Box>
  );
}

function resolveIncomeProfile(incomeTypeName) {
  if (incomeTypeName === INCOME_TYPE_NAMES.ASSET_RENTALS) return 'ASSET_RENTAL';
  if (incomeTypeName === INCOME_TYPE_NAMES.DATA_FEE) return 'DATA_FEE';
  if (incomeTypeName === INCOME_TYPE_NAMES.AD_HOC_ACTIVITIES) return 'AD_HOC';
  if (incomeTypeName === INCOME_TYPE_NAMES.COMMERCIAL_CONTRACTS) return 'COMMERCIAL_CONTRACTS';
  return 'STANDARD';
}

function formatCommercialValue(value, valueType) {
  if (!value) return '—';
  if (valueType === 'PERCENTAGE') return `${value}%`;
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function payoutFrequencyLabel(value) {
  return PAYOUT_FREQUENCY_OPTIONS.find((option) => option.value === value)?.label || value || '—';
}

function paymentRealizationLabel(value) {
  return PAYMENT_REALIZATION_OPTIONS.find((option) => option.value === value)?.label || value || '—';
}

function leadTimeBasisLabel(value) {
  return LEAD_TIME_BASIS_OPTIONS.find((option) => option.value === value)?.label || value || '—';
}

function resolveAssetValue(asset, versionAsset, field) {
  const local = asset?.[field];
  if (local !== undefined && local !== null && local !== '') return local;
  const remote = versionAsset?.[field];
  if (remote !== undefined && remote !== null && remote !== '') return remote;
  return '';
}

function resolveAssetPayoutMode(asset, versionAsset, versionPeriods = [], localPeriods = []) {
  if (asset?.payoutMode === 'PER_STORE') return 'PER_STORE';
  if (asset?.payoutMode === 'FLAT') return 'FLAT';
  if ((localPeriods?.length ?? 0) > 0 || (versionPeriods?.length ?? 0) > 0) return 'PER_STORE';
  if (versionAsset?.flatPayout != null && versionAsset?.flatPayout !== '') return 'FLAT';
  return 'FLAT';
}

function resolvePayoutPeriods(asset, version) {
  const localPeriods = asset?.assetPayoutPeriods ?? [];
  if (localPeriods.length > 0) {
    return localPeriods.filter((period) => period.periodMonths && period.payoutPerStore);
  }
  return version?.assetPayoutPeriods ?? [];
}

function formatPayoutPeriodSummary(periods = []) {
  if (!periods.length) return '—';
  return periods
    .map((period) => `${period.periodMonths} mo @ ${formatCommercialValue(period.payoutPerStore, 'FIXED')}`)
    .join('; ');
}

function SettlementLeadTimeRows({ details, version }) {
  const paymentType = details.paymentRealizationType ?? version?.paymentRealizationType;
  const basis = details.leadTimeBasis ?? version?.leadTimeBasis;
  const payoutDays = details.payoutBufferDays ?? version?.payoutBufferDays;
  const invoiceGenDays = details.invoiceGenerationLeadTime ?? version?.invoiceGenerationLeadTime;

  if (paymentType === PAYMENT_REALIZATION_TYPE.INVOICE_DISCOUNT) {
    return null;
  }

  if (paymentType === PAYMENT_REALIZATION_TYPE.CREDIT_NOTE) {
    return (
      <ReviewRow
        label="Payout Lead Time"
        value={payoutDays !== '' && payoutDays != null ? `${payoutDays} days` : '—'}
      />
    );
  }

  if (paymentType === PAYMENT_REALIZATION_TYPE.DIRECT_PAYMENT_INVOICE) {
    return (
      <>
        <ReviewRow label="Lead Time Basis" value={leadTimeBasisLabel(basis)} />
        {basis === LEAD_TIME_BASIS.INVOICE_DATE && (
          <>
            <ReviewRow
              label="Lead time for invoice generation"
              value={invoiceGenDays !== '' && invoiceGenDays != null ? `${invoiceGenDays} days` : '—'}
            />
            <ReviewRow
              label="Payout Lead Time"
              value={payoutDays !== '' && payoutDays != null ? `${payoutDays} days` : '—'}
            />
          </>
        )}
        {basis === LEAD_TIME_BASIS.ACTIVITY_COMPLETION_DATE && (
          <ReviewRow
            label="Payout Lead Time"
            value={payoutDays !== '' && payoutDays != null ? `${payoutDays} days` : '—'}
          />
        )}
      </>
    );
  }

  return null;
}

export default function WizardReviewContent({
  wizardState,
  version,
  serverAgreementId,
  slabs: initialSlabs,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [slabs, setSlabs] = useState(initialSlabs ?? []);
  const [loadingSlabs, setLoadingSlabs] = useState(false);
  const [cutoffRows, setCutoffRows] = useState([]);
  const [loadingCutoffs, setLoadingCutoffs] = useState(false);
  const [storeMappings, setStoreMappings] = useState(version?.storeMappings ?? []);
  const [loadingStores, setLoadingStores] = useState(false);

  const details = wizardState?.agreement?.details ?? {};
  const asset = wizardState?.agreement?.asset ?? {};
  const versionAsset = version?.asset ?? {};
  const commercials = wizardState?.agreement?.commercials ?? {};
  const productRules = wizardState?.productRules ?? {};
  const incomeTypeName = version?.incomeTypeName ?? details.incomeTypeName;
  const profile = resolveIncomeProfile(incomeTypeName);
  const hybridFlags = deriveHybridFlags(commercials.commercialStructure);
  const enableFlat = commercials.enableFlatBaseline ?? hybridFlags.enableFlatBaseline;
  const enableSlab = commercials.enableSlabIncentives ?? hybridFlags.enableSlabIncentives;
  const isQps = profile === 'AD_HOC';
  const stateNames = version?.states?.map((s) => s.stateName).join(', ')
    || (details.stateIds?.length ? `${details.stateIds.length} state(s) selected` : '—');
  const calculationBasis = details.calculationBasis ?? version?.calculationBasis;
  const assetCategory = resolveAssetValue(asset, versionAsset, 'assetCategory');
  const isActivityAsset = assetCategory === 'ACTIVITY';
  const assetPayoutMode = resolveAssetPayoutMode(
    asset,
    versionAsset,
    version?.assetPayoutPeriods,
    asset?.assetPayoutPeriods,
  );
  const payoutPeriods = resolvePayoutPeriods(asset, version);
  const isCommercialContracts = profile === 'COMMERCIAL_CONTRACTS';
  const showSlabSection = profile !== 'ASSET_RENTAL' && enableSlab && !isCommercialContracts && (loadingSlabs || slabs.length > 0);
  const showCommercialJbpSection = isCommercialContracts && enableSlab;
  const showCommercialCutoffsSection = isCommercialContracts && enableSlab;

  useEffect(() => {
    if (!serverAgreementId || !enableSlab) {
      setSlabs(initialSlabs ?? []);
      return;
    }
    if (initialSlabs) {
      setSlabs(initialSlabs);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingSlabs(true);
      try {
        const data = await fetchSlabs(serverAgreementId);
        if (!cancelled) setSlabs(data);
      } catch (err) {
        if (!cancelled) {
          enqueueSnackbar(err.response?.data?.message || 'Failed to load slabs', { variant: 'error' });
          setSlabs([]);
        }
      } finally {
        if (!cancelled) setLoadingSlabs(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [serverAgreementId, enableSlab, initialSlabs, enqueueSnackbar]);

  useEffect(() => {
    if (!isCommercialContracts || !enableSlab) {
      setCutoffRows([]);
      return;
    }
    const versionId = serverAgreementId ?? version?.id;
    if (!versionId) return;
    let cancelled = false;
    const load = async () => {
      setLoadingCutoffs(true);
      try {
        const data = await fetchContactsCutoffs(versionId);
        if (!cancelled) setCutoffRows(Array.isArray(data?.rows) ? data.rows : []);
      } catch {
        if (!cancelled) setCutoffRows([]);
      } finally {
        if (!cancelled) setLoadingCutoffs(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isCommercialContracts, enableSlab, serverAgreementId, version?.id]);

  useEffect(() => {
    if (profile !== 'ASSET_RENTAL') {
      setStoreMappings([]);
      return;
    }
    if (version?.storeMappings?.length) {
      setStoreMappings(version.storeMappings);
      return;
    }
    const versionId = serverAgreementId ?? version?.id;
    if (!versionId) return;
    let cancelled = false;
    const load = async () => {
      setLoadingStores(true);
      try {
        const data = await fetchStoreMappings(versionId);
        if (!cancelled) setStoreMappings(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setStoreMappings([]);
      } finally {
        if (!cancelled) setLoadingStores(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [profile, serverAgreementId, version?.id, version?.storeMappings]);

  return (
    <Box>
      <Box sx={REVIEW_GRID_SX}>
        <CollapsibleSection title="Partner Details" defaultExpanded sx={REVIEW_SECTION_SX}>
          <ReviewRow label="Company" value={wizardState?.companyName} />
          <ReviewRow label="Agreement Group" value={wizardState?.companyAgreementGroupName} />
        </CollapsibleSection>

        <CollapsibleSection title="Agreement Classification" defaultExpanded sx={REVIEW_SECTION_SX}>
          <ReviewRow label="Income Type" value={getIncomeTypeDisplayName(incomeTypeName)} />
          <ReviewRow label="Agreement Type" value={version?.agreementTypeName} />
        </CollapsibleSection>

        <CollapsibleSection title="Duration & Notes" defaultExpanded sx={REVIEW_SECTION_SX}>
          <ReviewRow
            label="Start Date"
            value={details.startDate ? dayjs(details.startDate).format('DD MMM YYYY') : version?.startDate ? dayjs(version.startDate).format('DD MMM YYYY') : ''}
          />
          <ReviewRow
            label="Expiry Date"
            value={details.expiryDate ? dayjs(details.expiryDate).format('DD MMM YYYY') : version?.expiryDate ? dayjs(version.expiryDate).format('DD MMM YYYY') : ''}
          />
          <ReviewRow
            label="Tenure"
            value={formatTenureFromDates(
              details.startDate ?? version?.startDate,
              details.expiryDate ?? version?.expiryDate,
            )}
          />
          {(details.notes || version?.notes) && (
            <ReviewRow label="Notes" value={details.notes || version?.notes} />
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Settlement & Payment Routing" defaultExpanded sx={REVIEW_SECTION_SX}>
          {profile !== 'ASSET_RENTAL' && (
            <ReviewRow
              label="Calculation Basis"
              value={CALCULATION_BASIS_LABELS[calculationBasis] || calculationBasis}
            />
          )}
          <ReviewRow
            label="Payment Realization"
            value={paymentRealizationLabel(details.paymentRealizationType ?? version?.paymentRealizationType)}
          />
          <SettlementLeadTimeRows details={details} version={version} />
        </CollapsibleSection>
      </Box>

      <Box sx={{ ...REVIEW_STACK_SX, mt: 3 }}>
        {profile !== 'ASSET_RENTAL' && (
          <CollapsibleSection title="Scope & Operations" defaultExpanded sx={REVIEW_SECTION_SX}>
            <ScopeOperationsReview
              vendorIds={wizardState?.vendorIds ?? []}
              productRules={productRules}
              version={version}
              adhocSubType={profile === 'AD_HOC' ? details.adhocSubType : null}
            />
          </CollapsibleSection>
        )}

        {profile === 'ASSET_RENTAL' && (
          <CollapsibleSection title="Scope & Operations" defaultExpanded sx={REVIEW_SECTION_SX}>
            <ReviewRow
              label="Asset Category"
              value={assetCategory === 'PHYSICAL_ASSET' ? 'Physical Asset' : assetCategory === 'ACTIVITY' ? 'Activity' : assetCategory}
            />
            {!isActivityAsset && (
              <ReviewRow label="Asset Type" value={resolveAssetValue(asset, versionAsset, 'assetType')} />
            )}
            <ReviewRow label="Store Count" value={resolveAssetValue(asset, versionAsset, 'storeCount')} />
            <ReviewRow
              label={assetPayoutMode === 'PER_STORE' ? 'Payout Schedule' : 'Flat Payout'}
              value={assetPayoutMode === 'PER_STORE'
                ? formatPayoutPeriodSummary(payoutPeriods)
                : formatCommercialValue(
                  resolveAssetValue(asset, versionAsset, 'flatPayout'),
                  'FIXED',
                )}
            />
            {(asset.remarks || versionAsset.remarks) && (
              <ReviewRow label="Remarks" value={asset.remarks || versionAsset.remarks} />
            )}
          </CollapsibleSection>
        )}

        {(profile === 'ASSET_RENTAL' || profile === 'COMMERCIAL_CONTRACTS' || profile === 'DATA_FEE') && (
          <CollapsibleSection title="Geography & Limits" defaultExpanded sx={REVIEW_SECTION_SX}>
            {profile === 'ASSET_RENTAL' && (
              <>
                <ReviewRow label="States" value={stateNames} />
                <Box sx={{ py: 0.75 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ width: 180, flexShrink: 0, display: 'inline-block', verticalAlign: 'top' }}>
                    Participating Stores
                  </Typography>
                  <Box component="span" sx={{ display: 'inline-block', verticalAlign: 'top' }}>
                    {loadingStores ? (
                      <Typography variant="body2" color="text.secondary">Loading stores…</Typography>
                    ) : (
                      <StoreMappingReviewSummary stores={storeMappings} />
                    )}
                  </Box>
                </Box>
              </>
            )}
            {(profile === 'COMMERCIAL_CONTRACTS' || profile === 'DATA_FEE') && (
              <ReviewRow label="States" value={stateNames} />
            )}
          </CollapsibleSection>
        )}

        <CollapsibleSection title="Supporting Documents" defaultExpanded sx={REVIEW_SECTION_SX}>
          {details.documents?.length ? (
            details.documents.map((doc, i) => (
              <Box key={`${doc.fileName}-${i}`} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                <Chip label={doc.documentType} size="small" variant="outlined" />
                <Typography variant="body2">{doc.fileName}</Typography>
              </Box>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">No documents uploaded in this session</Typography>
          )}
        </CollapsibleSection>

        {profile === 'ASSET_RENTAL' && (
          <CollapsibleSection title="Base Commercials" defaultExpanded sx={REVIEW_SECTION_SX}>
            <ReviewRow
              label="Payout Mode"
              value={assetPayoutMode === 'PER_STORE' ? 'Payout per Store' : 'Flat Payout'}
            />
            <ReviewRow
              label={assetPayoutMode === 'PER_STORE' ? 'Payout Schedule' : 'Amount'}
              value={assetPayoutMode === 'PER_STORE'
                ? formatPayoutPeriodSummary(payoutPeriods)
                : formatCommercialValue(
                  resolveAssetValue(asset, versionAsset, 'flatPayout'),
                  'FIXED',
                )}
            />
          </CollapsibleSection>
        )}

        {profile !== 'ASSET_RENTAL' && enableFlat && (
          <CollapsibleSection title="Base Commercials" defaultExpanded sx={REVIEW_SECTION_SX}>
            {isQps && (
              <Alert severity="info" sx={{ mb: 2 }}>
                QPS payout frequency is locked to <strong>One-Time</strong>.
              </Alert>
            )}
            <ReviewRow label="Flat Baseline" value="Enabled" />
            <ReviewRow
              label="Value"
              value={formatCommercialValue(
                commercials.commercialValue ?? version?.commercialValue,
                commercials.valueType || commercials.flatValueType || version?.flatValueType,
              )}
            />
            <ReviewRow
              label="Payout Frequency"
              value={payoutFrequencyLabel(commercials.flatBaselineFrequency ?? version?.flatBaselineFrequency)}
            />
          </CollapsibleSection>
        )}

        {showCommercialJbpSection && (
          <CollapsibleSection title="JBP Relational Matrix" defaultExpanded sx={REVIEW_SECTION_SX}>
            <JbpReviewShowcase agreementVersionId={serverAgreementId ?? version?.id} />
          </CollapsibleSection>
        )}

        {showCommercialCutoffsSection && (
          <CollapsibleSection
            title="Temporal Relaxations (Cutoffs)"
            defaultExpanded
            sx={REVIEW_SECTION_SX}
          >
            {loadingCutoffs ? (
              <Typography variant="body2" color="text.secondary">Loading cutoff matrix…</Typography>
            ) : cutoffRows.length > 0 ? (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Time Period</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Slab Tier</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Lower Cut-off (%)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Upper Cut-off (%)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cutoffRows.map((row) => (
                      <TableRow key={`${row.timePeriodId}-${row.slabId}`}>
                        <TableCell>{row.timePeriodName}</TableCell>
                        <TableCell>{row.slabTierLabel}</TableCell>
                        <TableCell>{row.lowerCutoff != null ? `${row.lowerCutoff}%` : '—'}</TableCell>
                        <TableCell>{row.upperCutoff != null ? `${row.upperCutoff}%` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No temporal cutoff configuration uploaded yet.
              </Typography>
            )}
          </CollapsibleSection>
        )}

        {showSlabSection && (
          <CollapsibleSection
            title="Performance Targets (Slabs)"
            defaultExpanded
            sx={REVIEW_SECTION_SX}
          >
            <ReviewRow label="Slab Incentives" value="Enabled" />
            {loadingSlabs ? (
              <Typography variant="body2" color="text.secondary">Loading slabs…</Typography>
            ) : (
              <Box sx={{ mt: 1 }}>
                <CommercialsUploadModal
                  embedded
                  readOnly
                  agreementId={serverAgreementId ?? version?.id}
                  slabs={slabs}
                  startDate={details.startDate ?? version?.startDate}
                  expiryDate={details.expiryDate ?? version?.expiryDate}
                />
              </Box>
            )}
          </CollapsibleSection>
        )}
      </Box>
    </Box>
  );
}
