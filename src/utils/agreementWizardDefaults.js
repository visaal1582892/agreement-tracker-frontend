import { BLANK_ASSET } from './incomeTypePayloadUtils';
import { GEOGRAPHY_MODE } from '../constants/geographyMode';
import { isDataFeeIncomeType } from './incomeTypeUtils';

export function createBlankAgreement() {
  return {
    id: `agr-${Date.now()}`,
    details: {
      incomeTypeId: null,
      incomeTypeName: null,
      agreementTypeId: null,
      startDate: null,
      expiryDate: null,
      notes: '',
      geographyMode: 'MIXED',
      partnerStates: [],
      partnerCities: [],
      documents: [],
      adhocSubType: null,
      quantityCap: '',
      invoiceVendorId: null,
      payoutBufferDays: '',
      leadTimeBasis: null,
      invoiceGenerationLeadTime: '',
      calculationBasis: 'VENDOR_INVOICE',
      paymentRealizationType: 'DIRECT_PAYMENT_INVOICE',
    },
    asset: {
      assetCategory: 'PHYSICAL_ASSET',
      assetType: '',
      storeCount: '',
      payoutMode: 'FLAT',
      flatPayout: '',
      payoutPerStore: '',
      assetPayoutPeriods: [],
      remarks: '',
    },
    commercials: {
      commercialStructure: 'FLAT',
      commercialValue: '',
      valueType: 'FIXED',
      flatValueType: 'FIXED',
      flatBaselineFrequency: 'MONTHLY',
      enableFlatBaseline: true,
      enableSlabIncentives: false,
      calculationFormula: '',
      selectedFrequencies: [],
      slabType: 'PURCHASE',
      slabCapUnit: 'RUPEES',
      jbpCommitted: false,
      financialYearStartMonth: 4,
    },
  };
}

export function buildStateAfterClassificationReset(prev) {
  const blank = createBlankAgreement();
  const preservedDetails = prev.agreement?.details ?? {};
  return {
    ...prev,
    agreementName: '',
    vendorIds: [],
    vendors: [],
    productRules: {
      manufacturers: [],
      divisionRules: [],
      productRules: [],
    },
    commercialData: {
      jbp: null,
      jbpBlueprint: null,
      storeMappings: null,
      jbpParseErrors: [],
      storeParseErrors: [],
    },
    agreement: {
      id: prev.agreement?.id ?? blank.id,
      details: {
        ...blank.details,
        incomeTypeId: preservedDetails.incomeTypeId ?? null,
        incomeTypeName: preservedDetails.incomeTypeName ?? null,
        agreementTypeId: preservedDetails.agreementTypeId ?? null,
        startDate: preservedDetails.startDate ?? null,
        expiryDate: preservedDetails.expiryDate ?? null,
        notes: preservedDetails.notes ?? '',
        geographyMode: isDataFeeIncomeType(
          [],
          preservedDetails.incomeTypeId,
          preservedDetails.incomeTypeName,
        )
          ? GEOGRAPHY_MODE.ALL
          : GEOGRAPHY_MODE.MIXED,
        partnerStates: [],
        partnerCities: [],
        documents: [],
        adhocSubType: null,
        quantityCap: '',
        invoiceVendorId: null,
        payoutBufferDays: '',
        calculationBasis: 'VENDOR_INVOICE',
        paymentRealizationType: 'DIRECT_PAYMENT_INVOICE',
      },
      asset: { ...BLANK_ASSET },
      commercials: { ...blank.commercials },
    },
  };
}
