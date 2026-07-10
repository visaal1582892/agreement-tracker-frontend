import axiosInstance from './axiosInstance';
import { ENDPOINTS } from '../config/endpoints';

/** Generic helper that calls POST /search and returns a PagedResponse. */
const search = (url, req) => axiosInstance.post(url, req).then((r) => r.data);
const getAll  = (url)       => axiosInstance.get(url).then((r) => r.data);
const getById = (url)       => axiosInstance.get(url).then((r) => r.data);
const create  = (url, data) => axiosInstance.post(url, data).then((r) => r.data);
const update  = (url, data) => axiosInstance.put(url, data).then((r) => r.data);
const toggle  = (url)       => axiosInstance.patch(url).then((r) => r.data);

// ── Agreement Groups ────────────────────────────────────────────────────────
export const agreementGroupApi = {
  search:       (req) => search(ENDPOINTS.MASTER_AGREEMENT_GROUPS_SEARCH, req),
  list:         ()    => getAll(ENDPOINTS.MASTER_AGREEMENT_GROUPS),
  getById:      (id)  => getById(ENDPOINTS.MASTER_AGREEMENT_GROUP_BY_ID(id)),
  create:       (d)   => create(ENDPOINTS.MASTER_AGREEMENT_GROUPS, d),
  update:       (id, d) => update(ENDPOINTS.MASTER_AGREEMENT_GROUP_BY_ID(id), d),
  toggleStatus: (id)  => toggle(ENDPOINTS.MASTER_AGREEMENT_GROUP_TOGGLE(id)),
};

// ── Income Types ────────────────────────────────────────────────────────────
export const incomeTypeApi = {
  search:       (req) => search(ENDPOINTS.MASTER_INCOME_TYPES_SEARCH, req),
  list:         ()    => getAll(ENDPOINTS.MASTER_INCOME_TYPES),
  getById:      (id)  => getById(ENDPOINTS.MASTER_INCOME_TYPE_BY_ID(id)),
  create:       (d)   => create(ENDPOINTS.MASTER_INCOME_TYPES, d),
  update:       (id, d) => update(ENDPOINTS.MASTER_INCOME_TYPE_BY_ID(id), d),
  toggleStatus: (id)  => toggle(ENDPOINTS.MASTER_INCOME_TYPE_TOGGLE(id)),
};

// ── States ──────────────────────────────────────────────────────────────────
export const stateApi = {
  search:       (req) => search(ENDPOINTS.MASTER_STATES_SEARCH, req),
  list:         ()    => getAll(ENDPOINTS.MASTER_STATES),
  getById:      (id)  => getById(ENDPOINTS.MASTER_STATE_BY_ID(id)),
  create:       (d)   => create(ENDPOINTS.MASTER_STATES, d),
  update:       (id, d) => update(ENDPOINTS.MASTER_STATE_BY_ID(id), d),
  toggleStatus: (id)  => toggle(ENDPOINTS.MASTER_STATE_TOGGLE(id)),
};

// ── Price Off Locations ─────────────────────────────────────────────────────
export const priceOffLocationApi = {
  search:       (req) => search(ENDPOINTS.MASTER_PRICE_OFF_LOCATIONS_SEARCH, req),
  list:         ()    => getAll(ENDPOINTS.MASTER_PRICE_OFF_LOCATIONS),
  getById:      (id)  => getById(ENDPOINTS.MASTER_PRICE_OFF_LOCATION_BY_ID(id)),
  create:       (d)   => create(ENDPOINTS.MASTER_PRICE_OFF_LOCATIONS, d),
  update:       (id, d) => update(ENDPOINTS.MASTER_PRICE_OFF_LOCATION_BY_ID(id), d),
  toggleStatus: (id)  => toggle(ENDPOINTS.MASTER_PRICE_OFF_LOCATION_TOGGLE(id)),
};

// ── Agreement Types ─────────────────────────────────────────────────────────
export const agreementTypeApi = {
  search:       (req) => search(ENDPOINTS.MASTER_AGREEMENT_TYPES_SEARCH, req),
  list:         ()    => getAll(ENDPOINTS.MASTER_AGREEMENT_TYPES),
  getById:      (id)  => getById(ENDPOINTS.MASTER_AGREEMENT_TYPE_BY_ID(id)),
  create:       (d)   => create(ENDPOINTS.MASTER_AGREEMENT_TYPES, d),
  update:       (id, d) => update(ENDPOINTS.MASTER_AGREEMENT_TYPE_BY_ID(id), d),
  toggleStatus: (id)  => toggle(ENDPOINTS.MASTER_AGREEMENT_TYPE_TOGGLE(id)),
};

// ── Roles ───────────────────────────────────────────────────────────────────
export const roleApi = {
  search:       (req) => search(ENDPOINTS.MASTER_ROLES_SEARCH, req),
  list:         ()    => getAll(ENDPOINTS.MASTER_ROLES),
  getById:      (id)  => getById(ENDPOINTS.MASTER_ROLE_BY_ID(id)),
  create:       (d)   => create(ENDPOINTS.MASTER_ROLES, d),
  update:       (id, d) => update(ENDPOINTS.MASTER_ROLE_BY_ID(id), d),
  toggleStatus: (id)  => toggle(ENDPOINTS.MASTER_ROLE_TOGGLE(id)),
};

// ── Rights ──────────────────────────────────────────────────────────────────
export const rightApi = {
  search:       (req) => search(ENDPOINTS.MASTER_RIGHTS_SEARCH, req),
  list:         ()    => getAll(ENDPOINTS.MASTER_RIGHTS),
  getById:      (id)  => getById(ENDPOINTS.MASTER_RIGHT_BY_ID(id)),
  create:       (d)   => create(ENDPOINTS.MASTER_RIGHTS, d),
  update:       (id, d) => update(ENDPOINTS.MASTER_RIGHT_BY_ID(id), d),
  toggleStatus: (id)  => toggle(ENDPOINTS.MASTER_RIGHT_TOGGLE(id)),
};
