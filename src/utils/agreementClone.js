/**
 * Build wizard pre-fill payload from agreement API response.
 * Keeps company, vendors, productRules only — no ids/dates/commercials/status/notes/docs.
 */
export function buildClonedWizardData(agreement) {
  if (!agreement) return null;

  return {
    agreementName: '',
    companyId: agreement.companyId,
    companyName: agreement.companyName,
    companyAgreementGroupId: agreement.companyAgreementGroupId,
    companyAgreementGroupName: agreement.companyAgreementGroupName,
    vendorIds: (agreement.vendors || []).map((v) => v.vendorId),
    productRules: {
      manufacturers: agreement.manufacturerIds || [],
      divisionRules: (agreement.divisionRules || []).map((r) => ({
        id: r.id,
        ruleType: r.ruleType,
      })),
      productRules: (agreement.productRules || []).map((r) => ({
        id: r.id,
        ruleType: r.ruleType,
      })),
    },
  };
}

export async function fetchAgreementForClone(axiosInstance, endpoints, agreementVersionId) {
  const { data } = await axiosInstance.get(endpoints.AGREEMENT_VERSION_BY_ID(agreementVersionId));
  return buildClonedWizardData(data);
}

export async function cloneAgreementOnServer(axiosInstance, endpoints, agreementVersionId) {
  const { data } = await axiosInstance.post(endpoints.AGREEMENT_VERSION_CLONE(agreementVersionId));
  return data;
}
