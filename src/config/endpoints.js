const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export const API_BASE = BASE;

export const ENDPOINTS = {
  // Auth
  LOGIN: `${BASE}/auth/login`,
  AUTH_ME: `${BASE}/auth/me`,

  // Users
  USERS: `${BASE}/users`,
  USER_BY_ID: (id) => `${BASE}/users/${id}`,
  USER_ME: `${BASE}/users/me`,
  USER_SEARCH: `${BASE}/users/search`,
  USER_LOOKUP: `${BASE}/users/lookup`,
  USER_ROLES: (id) => `${BASE}/users/${id}/roles`,

  // Parent agreements (ex-groups)
  AGREEMENTS: `${BASE}/agreements`,
  AGREEMENT_BY_ID: (id) => `${BASE}/agreements/${id}`,
  AGREEMENT_DELETE: (id) => `${BASE}/agreements/${id}`,
  AGREEMENT_VERSIONS: (agreementId) => `${BASE}/agreements/${agreementId}/versions`,
  AGREEMENT_NEW_VERSION: (agreementId) => `${BASE}/agreements/${agreementId}/new-version`,
  AGREEMENT_IN_PROGRESS: (agreementId) => `${BASE}/agreements/${agreementId}/in-progress`,
  AGREEMENT_RENEW: (agreementId) => `${BASE}/agreements/${agreementId}/renew`,
  AGREEMENT_BULK_TRANSFER: `${BASE}/agreements/bulk-transfer`,

  // Agreement versions (ex-agreements)
  AGREEMENT_VERSION_BY_ID: (id) => `${BASE}/agreement-versions/${id}`,
  AGREEMENT_VERSION_UPDATE: (id) => `${BASE}/agreement-versions/${id}`,
  AGREEMENT_VERSION_SUBMIT: (id) => `${BASE}/agreement-versions/${id}/submit`,
  AGREEMENT_VERSION_TRANSFER: (id) => `${BASE}/agreement-versions/${id}/transfer`,
  AGREEMENT_VERSION_REQUEST_TRANSFER: (id) => `${BASE}/agreement-versions/${id}/requests/transfer`,
  AGREEMENT_VERSION_REQUEST_TERMINATE: (id) => `${BASE}/agreement-versions/${id}/requests/terminate`,
  AGREEMENT_REQUEST_RESOLVE: (requestId) => `${BASE}/agreement-versions/requests/${requestId}/resolve`,
  AGREEMENT_PENDING_ACTION_REQUESTS: `${BASE}/agreement-versions/requests/pending`,
  AGREEMENT_VERSION_APPROVE: (id) => `${BASE}/agreement-versions/${id}/approve`,
  AGREEMENT_VERSION_REJECT: (id) => `${BASE}/agreement-versions/${id}/reject`,
  AGREEMENT_VERSION_TERMINATE: (id) => `${BASE}/agreement-versions/${id}/terminate`,
  REMINDERS_UNREAD: `${BASE}/reminders/unread`,
  REMINDER_MARK_READ: (id) => `${BASE}/reminders/${id}/read`,
  AGREEMENT_VERSION_TIMELINE: (id) => `${BASE}/agreement-versions/${id}/timeline`,
  AGREEMENT_VERSION_CREATE_EDIT: (id) => `${BASE}/agreement-versions/${id}/versions`,
  AGREEMENT_VERSION_CLONE: (id) => `${BASE}/agreement-versions/${id}/clone`,
  AGREEMENT_VERSION_SLABS: (id) => `${BASE}/agreement-versions/${id}/slabs`,
  AGREEMENT_VERSION_SLAB: (agreementVersionId, slabId) =>
    `${BASE}/agreement-versions/${agreementVersionId}/slabs/${slabId}`,
  AGREEMENT_VERSION_PENDING_APPROVALS: `${BASE}/agreement-versions/pending-approvals`,
  COMMERCIAL_TEMPLATE: (id) => `${BASE}/agreement-versions/${id}/commercials/template`,
  COMMERCIAL_UPLOAD: (id) => `${BASE}/agreement-versions/${id}/commercials/upload`,
  COMMERCIAL_TARGETS_PREVIEW: (id) => `${BASE}/agreement-versions/${id}/commercials/targets/preview`,
  COMMERCIAL_TARGETS: (id) => `${BASE}/agreement-versions/${id}/commercials/targets`,
  COMMERCIAL_TYPE_SWITCH: (id) => `${BASE}/agreement-versions/${id}/commercials/type-switch`,
  CONTACTS_CUTOFF_TEMPLATE: (id) => `${BASE}/agreement-versions/${id}/contacts-template`,
  CONTACTS_CUTOFF_UPLOAD: (id) => `${BASE}/agreement-versions/${id}/contacts-upload`,
  CONTACTS_CUTOFFS: (id) => `${BASE}/agreement-versions/${id}/contacts-cutoffs`,
  CONTACTS_CUTOFF_COMMIT: (id) => `${BASE}/agreement-versions/${id}/commit-cutoffs`,
  COMMERCIAL_STRUCTURE_PURGE: (id) => `${BASE}/agreement-versions/${id}/commercial-structure-data`,
  JBP_TEMPLATE: (id) => `${BASE}/agreement-versions/${id}/jbp-template`,
  JBP_UPLOAD: (id) => `${BASE}/agreement-versions/${id}/jbp-upload`,
  JBP_COMMIT: (id) => `${BASE}/agreement-versions/${id}/commit-jbp`,
  JBP_STRUCTURE: (id) => `${BASE}/agreement-versions/${id}/jbp-structure`,
  JBP_TIME_PERIODS: (id) => `${BASE}/agreement-versions/${id}/jbp-time-periods`,
  STORE_MAPPING_TEMPLATE: (id) => `${BASE}/agreement-versions/${id}/stores/template`,
  STORE_MAPPING_UPLOAD: (id) => `${BASE}/agreement-versions/${id}/stores/upload`,
  STORE_MAPPINGS: (id) => `${BASE}/agreement-versions/${id}/stores`,

  // Company agreement groups
  COMPANY_AGREEMENT_GROUPS: (companyId) => `${BASE}/companies/${companyId}/agreement-groups`,
  COMPANY_AGREEMENT_GROUPS_ALL: `${BASE}/company-agreement-groups`,
  COMPANY_AGREEMENT_GROUP_BY_ID: (groupId) => `${BASE}/company-agreement-groups/${groupId}`,
  COMPANY_AGREEMENT_GROUP_DELETION_STATUS: (groupId) =>
    `${BASE}/company-agreement-groups/${groupId}/deletion-status`,
  COMPANY_AGREEMENT_GROUP_DELETION_REQUEST: (groupId) =>
    `${BASE}/company-agreement-groups/${groupId}/deletion-requests`,
  COMPANY_AGREEMENT_GROUP_SUBMIT: (groupId) =>
    `${BASE}/company-agreement-groups/${groupId}/submit-for-approval`,

  // Dashboard
  DASHBOARD_STATS: `${BASE}/dashboard/stats`,
  DASHBOARD_EXPIRING: `${BASE}/dashboard/expiring`,

  // Master Data — simple dropdowns (backward compat with wizard)
  COMPANIES: `${BASE}/master/companies`,
  INCOME_TYPES: `${BASE}/master/income-types`,
  AGREEMENT_TYPES: `${BASE}/master/agreement-types`,
  STATES: `${BASE}/master/states`,
  VENDORS: `${BASE}/master/vendors`,
  MANUFACTURERS: `${BASE}/master/manufacturers`,
  DIVISIONS: (mfrId) => `${BASE}/master/manufacturers/${mfrId}/divisions`,
  PRODUCTS: `${BASE}/master/products`,

  // Master Data — full CRUD + paginated search
  MASTER_COMPANIES: `${BASE}/master/companies`,
  MASTER_COMPANIES_SEARCH: `${BASE}/master/companies/search`,
  MASTER_COMPANY_BY_ID: (id) => `${BASE}/master/companies/${id}`,
  MASTER_COMPANY_TOGGLE: (id) => `${BASE}/master/companies/${id}/toggle-status`,

  MASTER_VENDORS: `${BASE}/master/vendors`,
  MASTER_VENDORS_SEARCH: `${BASE}/master/vendors/search`,
  MASTER_VENDOR_BY_ID: (id) => `${BASE}/master/vendors/${id}`,
  MASTER_VENDOR_TOGGLE: (id) => `${BASE}/master/vendors/${id}/toggle-status`,

  MASTER_MANUFACTURERS: `${BASE}/master/manufacturers`,
  MASTER_MANUFACTURERS_SEARCH: `${BASE}/master/manufacturers/search`,
  MASTER_MANUFACTURER_BY_ID: (id) => `${BASE}/master/manufacturers/${id}`,
  MASTER_MANUFACTURER_TOGGLE: (id) => `${BASE}/master/manufacturers/${id}/toggle-status`,

  MASTER_DIVISIONS: `${BASE}/master/divisions`,
  MASTER_DIVISIONS_SEARCH: `${BASE}/master/divisions/search`,
  MASTER_DIVISION_BY_ID: (id) => `${BASE}/master/divisions/${id}`,
  MASTER_DIVISION_TOGGLE: (id) => `${BASE}/master/divisions/${id}/toggle-status`,

  MASTER_PRODUCTS: `${BASE}/master/products`,
  MASTER_PRODUCTS_SEARCH: `${BASE}/master/products/search`,
  MASTER_PRODUCT_BY_ID: (id) => `${BASE}/master/products/${id}`,
  MASTER_PRODUCT_TOGGLE: (id) => `${BASE}/master/products/${id}/toggle-status`,

  MASTER_INCOME_TYPES: `${BASE}/master/income-types`,
  MASTER_INCOME_TYPES_SEARCH: `${BASE}/master/income-types/search`,
  MASTER_INCOME_TYPE_BY_ID: (id) => `${BASE}/master/income-types/${id}`,
  MASTER_INCOME_TYPE_TOGGLE: (id) => `${BASE}/master/income-types/${id}/toggle-status`,

  MASTER_STATES: `${BASE}/master/states`,
  MASTER_STATES_SEARCH: `${BASE}/master/states/search`,
  MASTER_STATE_BY_ID: (id) => `${BASE}/master/states/${id}`,
  MASTER_STATE_TOGGLE: (id) => `${BASE}/master/states/${id}/toggle-status`,

  MASTER_AGREEMENT_TYPES: `${BASE}/master/agreement-types`,
  MASTER_AGREEMENT_TYPES_SEARCH: `${BASE}/master/agreement-types/search`,
  MASTER_AGREEMENT_TYPE_BY_ID: (id) => `${BASE}/master/agreement-types/${id}`,
  MASTER_AGREEMENT_TYPE_TOGGLE: (id) => `${BASE}/master/agreement-types/${id}/toggle-status`,

  MASTER_ROLES: `${BASE}/master/roles`,
  MASTER_ROLES_SEARCH: `${BASE}/master/roles/search`,
  MASTER_ROLE_BY_ID: (id) => `${BASE}/master/roles/${id}`,
  MASTER_ROLE_TOGGLE: (id) => `${BASE}/master/roles/${id}/toggle-status`,

  MASTER_RIGHTS: `${BASE}/master/rights`,
  MASTER_RIGHTS_SEARCH: `${BASE}/master/rights/search`,
  MASTER_RIGHT_BY_ID: (id) => `${BASE}/master/rights/${id}`,
  MASTER_RIGHT_TOGGLE: (id) => `${BASE}/master/rights/${id}/toggle-status`,

  PRICE_OFFS: `${BASE}/price-offs`,
  PRICE_OFFS_FILTER_OPTIONS: `${BASE}/price-offs/filter-options`,
  PRICE_OFFS_TEMPLATE: `${BASE}/price-offs/template`,
  PRICE_OFFS_UPLOAD: `${BASE}/price-offs/upload`,
  PRICE_OFF_BY_ID: (id) => `${BASE}/price-offs/${id}`,
  PRICE_OFF_CAMPAIGN_ID: (id) => `${BASE}/price-offs/${id}/campaign-id`,
  PRICE_OFFS_BULK_CAMPAIGN_ID: `${BASE}/price-offs/bulk-campaign-id`,
  PRICE_OFFS_BULK_SUBMIT: `${BASE}/price-offs/bulk-submit`,
  PRICE_OFFS_BULK_DELETE: `${BASE}/price-offs/bulk`,
  PRICE_OFFS_BULK_APPROVE: `${BASE}/price-offs/bulk-approve`,
  PRICE_OFFS_BULK_REJECT: `${BASE}/price-offs/bulk-reject`,
  PRICE_OFF_APPROVE: (id) => `${BASE}/price-offs/${id}/approve`,
  PRICE_OFF_REJECT: (id) => `${BASE}/price-offs/${id}/reject`,
};
