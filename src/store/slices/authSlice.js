import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import axios from 'axios';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';

function normalizeUser(payload) {
  return {
    id: payload.userId ?? payload.id,
    username: payload.username,
    fullName: payload.fullName,
    email: payload.email,
    roles: payload.roles ?? [],
    rights: payload.rights ?? [],
  };
}

export const login = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const { data } = await axios.post(ENDPOINTS.LOGIN, credentials);
    localStorage.setItem('token', data.token);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

export const refreshSession = createAsyncThunk('auth/refreshSession', async (_, { rejectWithValue }) => {
  try {
    const { data } = await axiosInstance.get(ENDPOINTS.AUTH_ME);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Session refresh failed');
  }
});

const initialUser = (() => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: initialUser,
    token: localStorage.getItem('token') || null,
    loading: false,
    error: null,
  },
  reducers: {
    logout(state) {
      state.user = null;
      state.token = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    clearError(state) {
      state.error = null;
    },
    setUserRights(state, { payload }) {
      if (state.user) {
        state.user.rights = payload ?? [];
        localStorage.setItem('user', JSON.stringify(state.user));
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.token = payload.token;
        state.user = normalizeUser(payload);
        localStorage.setItem('user', JSON.stringify(state.user));
      })
      .addCase(login.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })
      .addCase(refreshSession.fulfilled, (state, { payload }) => {
        state.user = normalizeUser(payload);
        localStorage.setItem('user', JSON.stringify(state.user));
      });
  },
});

export const { logout, clearError, setUserRights } = authSlice.actions;

const EMPTY_RIGHTS = [];

export const selectCurrentUser = (state) => state.auth.user;
export const selectUserRights = createSelector(
  [(state) => state.auth.user?.rights],
  (rights) => rights ?? EMPTY_RIGHTS,
);
export const selectIsAuthenticated = (state) => !!state.auth.token;
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;
export const selectHasRole = (role) => (state) => state.auth.user?.roles?.includes(role);
export const selectHasRight = (right) => (state) => state.auth.user?.rights?.includes(right) ?? false;
export const selectHasAnyRight = (rights) => (state) =>
  (rights ?? []).some((r) => state.auth.user?.rights?.includes(r));

export default authSlice.reducer;
