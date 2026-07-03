import { RIGHTS } from '../config/rights';

/** List API scope aligned with backend: MY unless user has AGREEMENT_VIEW_ALL. */
export function resolveAgreementListScope(hasRight) {
  return hasRight(RIGHTS.AGREEMENT_VIEW_ALL) ? 'ALL' : 'MY';
}

export function isAgreementOwner(user, agreement) {
  if (!user?.id || !agreement) return false;
  const ownerId = agreement.ownerId ?? agreement.ownerUserId;
  return ownerId === user.id;
}

/** Strict DB approval status only — undefined/null is never draft. */
export function isDraftAgreement(agreement) {
  return agreement?.approvalStatus === 'DRAFT';
}

/** Versions that are past records — show historical banner. */
export const HISTORICAL_STATUSES = ['SUPERSEDED', 'REJECTED', 'EXPIRED'];

/** Versions where edit/submit actions are blocked (excludes REJECTED — owner may revise). */
export const READ_ONLY_STATUSES = ['SUPERSEDED', 'EXPIRED', 'TERMINATED'];

export function isHistoricalAgreement(agreement) {
  return HISTORICAL_STATUSES.includes(agreement?.computedStatus);
}

export function isReadOnlyAgreement(agreement) {
  return READ_ONLY_STATUSES.includes(agreement?.computedStatus);
}

function blockedByReadOnly(isReadOnlyView) {
  return Boolean(isReadOnlyView);
}

/** Owner + AGREEMENT_EDIT + approvalStatus === DRAFT. */
export function canSubmit(ctx, agreement, { isReadOnlyView = false } = {}) {
  if (!agreement?.approvalStatus || blockedByReadOnly(isReadOnlyView)) return false;
  return (
    agreement.approvalStatus === 'DRAFT'
    && isAgreementOwner(ctx.user, agreement)
    && ctx.hasRight(RIGHTS.AGREEMENT_EDIT)
  );
}

/** Owner + AGREEMENT_EDIT + approvalStatus === DRAFT. */
export function canEditDraft(ctx, agreement, { isReadOnlyView = false } = {}) {
  if (!agreement?.approvalStatus || blockedByReadOnly(isReadOnlyView)) return false;
  return (
    agreement.approvalStatus === 'DRAFT'
    && isAgreementOwner(ctx.user, agreement)
    && ctx.hasRight(RIGHTS.AGREEMENT_EDIT)
  );
}

/** Owner + AGREEMENT_EDIT + approvalStatus === APPROVED + not terminated. */
export function canEditApproved(ctx, agreement, { isReadOnlyView = false } = {}) {
  if (!agreement?.approvalStatus || blockedByReadOnly(isReadOnlyView)) return false;
  if (agreement.computedStatus === 'TERMINATED' || agreement.terminationDate) return false;
  return (
    agreement.approvalStatus === 'APPROVED'
    && isAgreementOwner(ctx.user, agreement)
    && ctx.hasRight(RIGHTS.AGREEMENT_EDIT)
  );
}

/** Owner + AGREEMENT_EDIT + approved current version eligible for renewal. */
export function canRenew(ctx, agreement, { isReadOnlyView = false } = {}) {
  if (!agreement?.approvalStatus || blockedByReadOnly(isReadOnlyView)) return false;
  if (agreement.computedStatus === 'TERMINATED' || agreement.terminationDate) return false;
  return (
    agreement.approvalStatus === 'APPROVED'
    && isAgreementOwner(ctx.user, agreement)
    && ctx.hasRight(RIGHTS.AGREEMENT_EDIT)
  );
}

/** Owner + AGREEMENT_EDIT + approvalStatus === REJECTED. */
export function canRevise(ctx, agreement, { isReadOnlyView = false } = {}) {
  if (!agreement?.approvalStatus || blockedByReadOnly(isReadOnlyView)) return false;
  return (
    agreement.approvalStatus === 'REJECTED'
    && isAgreementOwner(ctx.user, agreement)
    && ctx.hasRight(RIGHTS.AGREEMENT_EDIT)
  );
}

/** AGREEMENT_APPROVE + approvalStatus === PENDING_APPROVAL + not owner + no pending operational request. */
export function canApprove(ctx, agreement) {
  if (!agreement?.approvalStatus) return false;
  if (agreement.pendingActionRequest) return false;
  return (
    agreement.approvalStatus === 'PENDING_APPROVAL'
    && ctx.hasRight(RIGHTS.AGREEMENT_APPROVE)
    && !isAgreementOwner(ctx.user, agreement)
  );
}

export function canReject(ctx, agreement) {
  return canApprove(ctx, agreement);
}

/** AGREEMENT_EDIT + approvalStatus === APPROVED + not terminated + no pending action request. */
export function canTerminate(ctx, agreement, { isReadOnlyView = false } = {}) {
  if (!agreement?.approvalStatus || blockedByReadOnly(isReadOnlyView)) return false;
  if (agreement.pendingActionRequest) return false;
  return (
    agreement.approvalStatus === 'APPROVED'
    && ctx.hasRight(RIGHTS.AGREEMENT_EDIT)
    && !agreement.terminationDate
  );
}

/** AGREEMENT_CREATE + approvalStatus !== DRAFT. */
export function canClone(ctx, agreement) {
  if (!agreement?.approvalStatus || isDraftAgreement(agreement)) return false;
  return ctx.hasRight(RIGHTS.AGREEMENT_CREATE);
}

/** (owner or ADMIN_USERS) + not DRAFT + allowed status + no pending action request. */
export function canTransfer(ctx, agreement) {
  if (!agreement?.approvalStatus || !agreement?.id && !agreement?.latestVersionId) return false;
  if (isDraftAgreement(agreement)) return false;
  if (agreement.pendingActionRequest) return false;

  const blockedStatuses = ['SUPERSEDED', 'REJECTED', 'EXPIRED', 'TERMINATED'];
  if (blockedStatuses.includes(agreement.computedStatus)) return false;

  const allowedStatuses = ['ACTIVE', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS'];
  if (agreement.computedStatus && !allowedStatuses.includes(agreement.computedStatus)) {
    return false;
  }

  return (
    isAgreementOwner(ctx.user, agreement)
    || ctx.hasRight(RIGHTS.ADMIN_USERS)
  );
}

export function canView(ctx) {
  return ctx.hasRight(RIGHTS.AGREEMENT_VIEW) || ctx.hasRight(RIGHTS.AGREEMENT_VIEW_ALL);
}

export function getDetailPageActions(ctx, agreement, { isReadOnlyView = false } = {}) {
  const options = { isReadOnlyView };
  const draft = isDraftAgreement(agreement);
  return {
    editDraft: canEditDraft(ctx, agreement, options),
    submit: canSubmit(ctx, agreement, options),
    approve: canApprove(ctx, agreement, options),
    reject: canReject(ctx, agreement, options),
    editApproved: canEditApproved(ctx, agreement, options),
    renew: canRenew(ctx, agreement, options),
    revise: canRevise(ctx, agreement, options),
    terminate: canTerminate(ctx, agreement, options),
    clone: !draft && canClone(ctx, agreement),
    transfer: !draft && canTransfer(ctx, agreement),
  };
}

export function getListRowActions(ctx, agreement) {
  return {
    view: canView(ctx),
    editDraft: canEditDraft(ctx, agreement),
    editApproved: canEditApproved(ctx, agreement),
    revise: canRevise(ctx, agreement),
    submit: canSubmit(ctx, agreement),
    approveReject: canApprove(ctx, agreement),
    clone: canClone(ctx, agreement),
    transfer: canTransfer(ctx, agreement),
  };
}

export function canPerformAction(ctx, action, agreement, options = {}) {
  const map = {
    submit: canSubmit,
    editDraft: canEditDraft,
    editApproved: canEditApproved,
    renew: canRenew,
    revise: canRevise,
    approve: canApprove,
    reject: canReject,
    terminate: canTerminate,
    clone: canClone,
    transfer: canTransfer,
    view: canView,
  };
  const fn = map[action];
  if (!fn) return false;
  if (action === 'view') return fn(ctx);
  if (action === 'clone' || action === 'transfer') return fn(ctx, agreement);
  return fn(ctx, agreement, options);
}
