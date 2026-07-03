import axiosInstance from './axiosInstance';
import { ENDPOINTS } from '../config/endpoints';

/** Generic helper that calls POST /search and returns a PagedResponse. */
const search = (url, req) => axiosInstance.post(url, req).then((r) => r.data);
const getAll  = (url)       => axiosInstance.get(url).then((r) => r.data);
const getById = (url)       => axiosInstance.get(url).then((r) => r.data);
const create  = (url, data) => axiosInstance.post(url, data).then((r) => r.data);
const update  = (url, data) => axiosInstance.put(url, data).then((r) => r.data);
const toggle  = (url)       => axiosInstance.patch(url).then((r) => r.data);

// ── Company Master ──────────────────────────────────────────────────────────
export const companyApi = {
  search:       (req) => search(ENDPOINTS.MASTER_COMPANIES_SEARCH, req),
  list:         ()    => getAll(ENDPOINTS.MASTER_COMPANIES),
  getById:      (id)  => getById(ENDPOINTS.MASTER_COMPANY_BY_ID(id)),
  create:       (d)   => create(ENDPOINTS.MASTER_COMPANIES, d),
  update:       (id, d) => update(ENDPOINTS.MASTER_COMPANY_BY_ID(id), d),
  toggleStatus: (id)  => toggle(ENDPOINTS.MASTER_COMPANY_TOGGLE(id)),
};

// ── Vendor Master ───────────────────────────────────────────────────────────
export const vendorApi = {
  search:       (req) => search(ENDPOINTS.MASTER_VENDORS_SEARCH, req),
  list:         ()    => getAll(ENDPOINTS.MASTER_VENDORS),
  getById:      (id)  => getById(ENDPOINTS.MASTER_VENDOR_BY_ID(id)),
  create:       (d)   => create(ENDPOINTS.MASTER_VENDORS, d),
  update:       (id, d) => update(ENDPOINTS.MASTER_VENDOR_BY_ID(id), d),
  toggleStatus: (id)  => toggle(ENDPOINTS.MASTER_VENDOR_TOGGLE(id)),
};

// ── Manufacturer Master ─────────────────────────────────────────────────────
export const manufacturerApi = {
  search:       (req) => search(ENDPOINTS.MASTER_MANUFACTURERS_SEARCH, req),
  list:         ()    => getAll(ENDPOINTS.MASTER_MANUFACTURERS),
  getById:      (id)  => getById(ENDPOINTS.MASTER_MANUFACTURER_BY_ID(id)),
  create:       (d)   => create(ENDPOINTS.MASTER_MANUFACTURERS, d),
  update:       (id, d) => update(ENDPOINTS.MASTER_MANUFACTURER_BY_ID(id), d),
  toggleStatus: (id)  => toggle(ENDPOINTS.MASTER_MANUFACTURER_TOGGLE(id)),
};

// ── Division Master ─────────────────────────────────────────────────────────
export const divisionApi = {
  search:       (req) => search(ENDPOINTS.MASTER_DIVISIONS_SEARCH, req),
  list:         ()    => getAll(ENDPOINTS.MASTER_DIVISIONS),
  listByManufacturer: (manufacturerId) => getAll(ENDPOINTS.DIVISIONS(manufacturerId)),
  getById:      (id)  => getById(ENDPOINTS.MASTER_DIVISION_BY_ID(id)),
  create:       (d)   => create(ENDPOINTS.MASTER_DIVISIONS, d),
  update:       (id, d) => update(ENDPOINTS.MASTER_DIVISION_BY_ID(id), d),
  toggleStatus: (id)  => toggle(ENDPOINTS.MASTER_DIVISION_TOGGLE(id)),
};

// ── Product Master ──────────────────────────────────────────────────────────
export const productApi = {
  search:       (req) => search(ENDPOINTS.MASTER_PRODUCTS_SEARCH, req),
  getById:      (id)  => getById(ENDPOINTS.MASTER_PRODUCT_BY_ID(id)),
  create:       (d)   => create(ENDPOINTS.MASTER_PRODUCTS, d),
  update:       (id, d) => update(ENDPOINTS.MASTER_PRODUCT_BY_ID(id), d),
  toggleStatus: (id)  => toggle(ENDPOINTS.MASTER_PRODUCT_TOGGLE(id)),
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
