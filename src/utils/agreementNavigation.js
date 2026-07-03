/**
 * Draft missing agreement name — route to edit wizard, not read-only detail.
 */
export function isIncompleteDraft(agreement) {
  const missingType = !agreement?.agreementTypeId;
  const missingStartDate = !agreement?.startDate;
  return missingType || missingStartDate;
}

export function buildAgreementEditPath(agreementId, { step } = {}) {
  if (agreementId == null || agreementId === '') return null;
  const base = `/agreements/${agreementId}/edit`;
  if (step != null && step !== '') {
    return `${base}?step=${step}`;
  }
  return base;
}

export function buildAgreementDetailPath(agreementId) {
  if (agreementId == null || agreementId === '') return null;
  return `/agreements/${agreementId}`;
}

export function buildGroupDetailPath(groupId) {
  if (groupId == null || groupId === '') return null;
  return `/agreements/groups/${groupId}`;
}

export function buildGroupWizardPath(groupId, activeAgreementId, { step } = {}) {
  if (groupId == null || groupId === '' || activeAgreementId == null || activeAgreementId === '') {
    return null;
  }
  const params = new URLSearchParams();
  params.set('groupId', String(groupId));
  params.set('activeAgreementId', String(activeAgreementId));
  if (step != null && step !== '') {
    params.set('step', String(step));
  }
  return `/agreements/wizard?${params.toString()}`;
}

export function buildDraftEditPath(row, { step, mode = 'group' } = {}) {
  if (row?.approvalStatus !== 'DRAFT') return null;

  if (mode === 'single' && row.latestVersionId) {
    return buildAgreementEditPath(row.latestVersionId, { step });
  }

  if (!row.companyAgreementGroupId) return null;
  return buildGroupWizardPath(row.companyAgreementGroupId, row.id, { step });
}

/**
 * Row click / primary navigation from agreements list.
 * DRAFT + group mode → group wizard with all draft tabs.
 * DRAFT + single mode → single-agreement edit wizard.
 * Other statuses → read-only agreement detail page.
 */
export function navigateToAgreement(row, navigate, { mode = 'group' } = {}) {
  if (!row?.id) return;

  if (row.approvalStatus === 'DRAFT') {
    const path = buildDraftEditPath(row, { mode });
    if (path) navigate(path);
    return;
  }

  const path = buildAgreementDetailPath(row.id);
  if (path) navigate(path);
}

export function navigateToGroup(row, navigate) {
  const path = buildGroupDetailPath(row?.id);
  if (path) navigate(path);
}
