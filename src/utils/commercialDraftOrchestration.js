import axiosInstance from '../api/axiosInstance';
import { ENDPOINTS } from '../config/endpoints';

/**
 * Ensures commercial mutations target a DRAFT version.
 * When the loaded agreement is still APPROVED, creates a reapproval draft first.
 */
export async function ensureDraftVersionForCommercial({
  serverAgreementId,
  sourceAgreement,
  versionSourceId,
  buildVersionedEditPayload,
}) {
  if (sourceAgreement?.approvalStatus !== 'APPROVED') {
    return {
      versionId: serverAgreementId,
      draftCreated: false,
      draftResponse: null,
    };
  }

  const sourceId = versionSourceId ?? sourceAgreement?.id;
  if (!sourceId) {
    throw new Error('No approved agreement version available to create a draft from');
  }

  const payload = buildVersionedEditPayload({ requiresReapproval: true });
  const { data } = await axiosInstance.post(
    ENDPOINTS.AGREEMENT_VERSION_CREATE_EDIT(sourceId),
    payload,
  );

  return {
    versionId: data.id,
    draftCreated: true,
    draftResponse: data,
  };
}
