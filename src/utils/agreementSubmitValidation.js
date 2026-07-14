/**
 * Validates wizard state before submit-for-approval.
 * Save-as-draft bypasses this entirely.
 */
export function validateAgreementForSubmit(state, enqueueSnackbar) {
  if (!state.agreementGroupId && !state.newAgreementGroupName?.trim()) {
    enqueueSnackbar('Cannot submit: Agreement group is missing.', { variant: 'warning' });
    return false;
  }
  if (!state.vendorIds?.length) {
    enqueueSnackbar('Cannot submit: At least one Vendor is required.', { variant: 'warning' });
    return false;
  }
  if (!state.productRules?.manufacturers?.length) {
    enqueueSnackbar('Cannot submit: At least one Manufacturer is required.', { variant: 'warning' });
    return false;
  }
  const hasExplicitProductRules = (state.productRules?.productRules?.length ?? 0) > 0;
  const hasComputedProducts = (state.productRules?.computedProductPreview?.length ?? 0) > 0;
  if (!hasExplicitProductRules && !hasComputedProducts) {
    enqueueSnackbar('Cannot submit: At least one Product is required.', { variant: 'warning' });
    return false;
  }
  if (!state.agreement) {
    enqueueSnackbar('Cannot submit: Agreement details are missing.', { variant: 'warning' });
    return false;
  }

  const { details, commercials } = state.agreement;

  if (!details.incomeTypeId) {
    enqueueSnackbar('Cannot submit: Income Type is missing.', { variant: 'warning' });
    return false;
  }
  if (!details.agreementTypeId) {
    enqueueSnackbar('Cannot submit: Agreement Type is missing.', { variant: 'warning' });
    return false;
  }
  if (!details.startDate) {
    enqueueSnackbar('Cannot submit: Start Date is missing.', { variant: 'warning' });
    return false;
  }
  if (!details.expiryDate) {
    enqueueSnackbar('Cannot submit: Expiry Date is missing.', { variant: 'warning' });
    return false;
  }
  if (!commercials.commercialStructure) {
    enqueueSnackbar('Cannot submit: Commercial Structure is missing.', { variant: 'warning' });
    return false;
  }
  if (commercials.commercialStructure === 'FLAT' && !commercials.commercialValue) {
    enqueueSnackbar('Cannot submit: Commercial Value is missing for FLAT structure.', { variant: 'warning' });
    return false;
  }
  const documents = details.documents ?? [];
  const uploadsInProgress = documents.some((doc) => doc.uploadStatus === 'uploading');
  const uploadedDocuments = documents.filter((doc) => doc.fileUrl && doc.uploadStatus !== 'error');
  if (uploadsInProgress) {
    enqueueSnackbar('Cannot submit: Document uploads are still in progress.', { variant: 'warning' });
    return false;
  }
  if (!uploadedDocuments.length) {
    enqueueSnackbar('Cannot submit: At least one document must be uploaded.', { variant: 'warning' });
    return false;
  }

  return true;
}
