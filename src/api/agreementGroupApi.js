import axiosInstance from './axiosInstance';
import { ENDPOINTS } from '../config/endpoints';
import { normalizePageResponse } from '../utils/pageResponse';

export async function submitAgreementGroupForApproval(groupId) {
  const { data } = await axiosInstance.post(ENDPOINTS.COMPANY_AGREEMENT_GROUP_SUBMIT(groupId));
  return data;
}

export async function fetchGroupDraftAgreements(groupId, scope = 'MY') {
  const { data } = await axiosInstance.get(ENDPOINTS.AGREEMENTS, {
    params: {
      companyAgreementGroupId: groupId,
      status: 'DRAFT',
      scope,
      size: 100,
      page: 0,
      sort: 'createdAt,asc',
    },
  });
  return normalizePageResponse(data).content;
}
