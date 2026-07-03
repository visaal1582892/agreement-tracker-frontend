import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';
import { normalizePageResponse } from '../../utils/pageResponse';

export const fetchAgreements = createAsyncThunk(
  'agreements/fetchAll',
  async ({ page = 0, size = 20, scope = 'MY', sortBy, sortDir, ...params } = {}, { rejectWithValue }) => {
    try {
      const query = { page, size, scope, ...params };
      if (sortBy) {
        query.sort = `${sortBy},${sortDir || 'asc'}`;
      }
      const { data } = await axiosInstance.get(ENDPOINTS.AGREEMENTS, { params: query });
      return normalizePageResponse(data);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch agreements');
    }
  }
);

/** @deprecated use fetchAgreements */
export const fetchAgreementGroups = fetchAgreements;

export const submitAgreementForApproval = createAsyncThunk(
  'agreements/submit',
  async ({ agreementId, comments }, { rejectWithValue }) => {
    try {
      const body = comments?.trim() ? { comments: comments.trim() } : {};
      const { data } = await axiosInstance.put(ENDPOINTS.AGREEMENT_VERSION_SUBMIT(agreementId), body);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to submit agreement');
    }
  }
);

export const approveAgreement = createAsyncThunk(
  'agreements/approve',
  async ({ agreementId, remarks = 'Approved' }, { rejectWithValue }) => {
    try {
      const { data } = await axiosInstance.post(ENDPOINTS.AGREEMENT_VERSION_APPROVE(agreementId), { remarks });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Approval failed');
    }
  }
);

export const rejectAgreement = createAsyncThunk(
  'agreements/reject',
  async ({ agreementId, remarks }, { rejectWithValue }) => {
    try {
      const { data } = await axiosInstance.post(ENDPOINTS.AGREEMENT_VERSION_REJECT(agreementId), { remarks });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Rejection failed');
    }
  }
);

export const fetchPendingApprovals = createAsyncThunk(
  'agreements/fetchPending',
  async ({ page = 0, size = 10, search = '' } = {}, { rejectWithValue }) => {
    try {
      const params = { page, size };
      if (search?.trim()) params.search = search.trim();
      const { data } = await axiosInstance.get(ENDPOINTS.AGREEMENT_VERSION_PENDING_APPROVALS, { params });
      return normalizePageResponse(data);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch pending approvals');
    }
  }
);

export const fetchPendingActionRequests = createAsyncThunk(
  'agreements/fetchPendingActionRequests',
  async ({ page = 0, size = 10, search = '' } = {}, { rejectWithValue }) => {
    try {
      const params = { page, size };
      if (search?.trim()) params.search = search.trim();
      const { data } = await axiosInstance.get(ENDPOINTS.AGREEMENT_PENDING_ACTION_REQUESTS, { params });
      return normalizePageResponse(data);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch operational requests');
    }
  }
);

export const resolveActionRequest = createAsyncThunk(
  'agreements/resolveActionRequest',
  async ({ requestId, approved, approverComments = '' }, { rejectWithValue }) => {
    try {
      const { data } = await axiosInstance.put(ENDPOINTS.AGREEMENT_REQUEST_RESOLVE(requestId), {
        approved,
        approverComments: approverComments || undefined,
      });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to resolve request');
    }
  }
);

function applyVersionToAgreements(state, version) {
  if (!version?.agreementId) return;

  const idx = state.agreements.findIndex((a) => a.id === version.agreementId);
  if (idx === -1) return;

  const agreement = state.agreements[idx];
  state.agreements[idx] = {
    ...agreement,
    computedStatus: version.computedStatus ?? agreement.computedStatus,
    approvalStatus: version.approvalStatus ?? agreement.approvalStatus,
    latestVersionId: version.id,
    currentVersionNumber: version.versionNumber ?? agreement.currentVersionNumber,
    currentVersionId: version.approvalStatus === 'APPROVED'
      ? version.id
      : agreement.currentVersionId,
    startDate: version.startDate ?? agreement.startDate,
    expiryDate: version.expiryDate ?? agreement.expiryDate,
    incomeTypeName: version.incomeTypeName ?? agreement.incomeTypeName,
  };
}

function removeFromPendingApprovals(state, version) {
  if (!version) return;

  const before = state.pendingApprovals.length;
  state.pendingApprovals = state.pendingApprovals.filter(
    (a) => a.id !== version.id && a.agreementId !== version.agreementId,
  );
  const removed = before - state.pendingApprovals.length;
  if (removed > 0 && state.pendingTotal > 0) {
    state.pendingTotal -= removed;
  }
}

const agreementSlice = createSlice({
  name: 'agreements',
  initialState: {
    agreements: [],
    /** @deprecated use agreements */
    groups: [],
    totalElements: 0,
    totalPages: 0,
    currentPage: 0,
    pendingApprovals: [],
    pendingTotal: 0,
    pendingTotalPages: 0,
    pendingPage: 0,
    pendingPageSize: 10,
    pendingActionRequests: [],
    pendingActionRequestsTotal: 0,
    pendingActionRequestsTotalPages: 0,
    pendingActionRequestsPage: 0,
    pendingActionRequestsPageSize: 10,
    loading: false,
    error: null,
  },
  reducers: {
    clearAgreementError(state) {
      state.error = null;
    },
    updateAgreementStatusLocal(state, { payload }) {
      const { agreementId, agreementVersionId, newStatus } = payload;
      const idx = state.agreements.findIndex(
        (a) => a.id === agreementId || a.latestVersionId === agreementVersionId,
      );
      if (idx !== -1 && newStatus) {
        state.agreements[idx].computedStatus = newStatus;
      }
    },
    updateAgreementFromVersionResponse(state, { payload: version }) {
      applyVersionToAgreements(state, version);
      if (version?.approvalStatus !== 'PENDING_APPROVAL') {
        removeFromPendingApprovals(state, version);
      }
    },
    /** @deprecated use updateAgreementFromVersionResponse */
    updateAgreementGroupFromResponse(state, action) {
      agreementSlice.caseReducers.updateAgreementFromVersionResponse(state, action);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAgreements.pending, (state) => { state.loading = true; })
      .addCase(fetchAgreements.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.agreements = payload.content;
        state.groups = payload.content;
        state.totalElements = payload.totalElements;
        state.totalPages = payload.totalPages;
        state.currentPage = payload.number;
      })
      .addCase(fetchAgreements.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })
      .addCase(submitAgreementForApproval.fulfilled, (state, { payload }) => {
        applyVersionToAgreements(state, payload);
      })
      .addCase(approveAgreement.fulfilled, (state, { payload }) => {
        applyVersionToAgreements(state, payload);
        removeFromPendingApprovals(state, payload);
      })
      .addCase(rejectAgreement.fulfilled, (state, { payload }) => {
        applyVersionToAgreements(state, payload);
        removeFromPendingApprovals(state, payload);
      })
      .addCase(fetchPendingApprovals.pending, (state) => { state.loading = true; })
      .addCase(fetchPendingApprovals.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.pendingApprovals = payload.content ?? [];
        state.pendingTotal = payload.totalElements ?? 0;
        state.pendingTotalPages = payload.totalPages ?? 0;
        state.pendingPage = payload.number ?? 0;
        state.pendingPageSize = payload.size ?? state.pendingPageSize;
      })
      .addCase(fetchPendingApprovals.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })
      .addCase(fetchPendingActionRequests.pending, (state) => { state.loading = true; })
      .addCase(fetchPendingActionRequests.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.pendingActionRequests = payload.content ?? [];
        state.pendingActionRequestsTotal = payload.totalElements ?? 0;
        state.pendingActionRequestsTotalPages = payload.totalPages ?? 0;
        state.pendingActionRequestsPage = payload.number ?? 0;
        state.pendingActionRequestsPageSize = payload.size ?? state.pendingActionRequestsPageSize;
      })
      .addCase(fetchPendingActionRequests.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })
      .addCase(resolveActionRequest.fulfilled, (state, { payload }) => {
        state.pendingActionRequests = state.pendingActionRequests.filter((r) => r.id !== payload.id);
        if (state.pendingActionRequestsTotal > 0) {
          state.pendingActionRequestsTotal -= 1;
        }
      });
  },
});

export const {
  clearAgreementError,
  updateAgreementStatusLocal,
  updateAgreementFromVersionResponse,
  updateAgreementGroupFromResponse,
} = agreementSlice.actions;
export default agreementSlice.reducer;
