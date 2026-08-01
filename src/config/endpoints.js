const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7070/api';

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
  USER_CHANGE_PASSWORD: `${BASE}/users/change-password`,
  USER_RESET_PASSWORD: (id) => `${BASE}/users/${id}/reset-password`,

  // Parent agreements (ex-groups)
  AGREEMENTS: `${BASE}/agreements`,
  AGREEMENT_BY_ID: (id) => `${BASE}/agreements/${id}`,
  AGREEMENT_DELETE: (id) => `${BASE}/agreements/${id}`,
  AGREEMENT_VERSIONS: (agreementId) => `${BASE}/agreements/${agreementId}/versions`,
  AGREEMENT_NEW_VERSION: (agreementId) => `${BASE}/agreements/${agreementId}/new-version`,
  AGREEMENT_IN_PROGRESS: (agreementId) => `${BASE}/agreements/${agreementId}/in-progress`,
  AGREEMENT_EDIT_SUBMIT: (agreementId) => `${BASE}/agreements/${agreementId}/edit-submit`,
  AGREEMENT_RENEW_SUBMIT: (agreementId) => `${BASE}/agreements/${agreementId}/renew-submit`,
  AGREEMENT_PARSE_JBP: `${BASE}/agreements/parse-jbp`,
  AGREEMENT_JBP_TEMPLATE_EXPORT: `${BASE}/agreements/jbp-template-export`,
  AGREEMENT_JBP_PREVIEW_PERIODS: `${BASE}/agreements/jbp-preview/time-periods`,
  AGREEMENT_JBP_PREVIEW_TEMPLATE: `${BASE}/agreements/jbp-preview/template`,
  AGREEMENT_PARSE_STORES: `${BASE}/agreements/parse-stores`,
  AGREEMENT_PARSE_STORES_TEMPLATE: `${BASE}/agreements/parse-stores/template`,
  AGREEMENT_BULK_TRANSFER: `${BASE}/agreements/bulk-transfer`,
  AGREEMENT_PRODUCT_SCOPE_COUNT: `${BASE}/agreements/product-scope/count`,

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
  COMMERCIAL_PAYOUTS: (id) => `${BASE}/agreement-versions/${id}/commercial-payouts`,
  PURCHASE_AGGREGATION: (id) => `${BASE}/agreement-versions/${id}/purchase-aggregation`,
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

  // Agreement groups
  AGREEMENT_GROUPS: `${BASE}/agreement-groups`,
  AGREEMENT_GROUP_BY_ID: (groupId) => `${BASE}/agreement-groups/${groupId}`,
  AGREEMENT_GROUP_DELETION_STATUS: (groupId) =>
    `${BASE}/agreement-groups/${groupId}/deletion-status`,
  AGREEMENT_GROUP_DELETION_REQUEST: (groupId) =>
    `${BASE}/agreement-groups/${groupId}/deletion-requests`,
  AGREEMENT_GROUP_SUBMIT: (groupId) =>
    `${BASE}/agreement-groups/${groupId}/submit-for-approval`,

  // Dashboard
  DASHBOARD_STATS: `${BASE}/dashboard/stats`,
  DASHBOARD_EXPIRING: `${BASE}/dashboard/expiring`,

  // Master Data — simple dropdowns (backward compat with wizard)
  INCOME_TYPES: `${BASE}/master/income-types`,
  AGREEMENT_TYPES: `${BASE}/master/agreement-types`,
  STATES: `${BASE}/master/states`,

  INTEGRATION_MANUFACTURERS: `${BASE}/integration/manufacturers`,
  INTEGRATION_MANUFACTURERS_BY_IDS: `${BASE}/integration/manufacturers/by-ids`,
  INTEGRATION_DIVISIONS: `${BASE}/integration/divisions`,
  INTEGRATION_PRODUCTS: `${BASE}/integration/products`,
  INTEGRATION_VENDORS: `${BASE}/integration/vendors`,
  INTEGRATION_VENDORS_BY_IDS: `${BASE}/integration/vendors/by-ids`,
  INTEGRATION_LOCATION_STATES: `${BASE}/integration/locations/states`,
  INTEGRATION_LOCATION_CITIES: `${BASE}/integration/locations/cities`,

  // Master Data — full CRUD + paginated search
  MASTER_AGREEMENT_GROUPS: `${BASE}/master/agreement-groups`,
  MASTER_AGREEMENT_GROUPS_SEARCH: `${BASE}/master/agreement-groups/search`,
  MASTER_AGREEMENT_GROUP_BY_ID: (id) => `${BASE}/master/agreement-groups/${id}`,
  MASTER_AGREEMENT_GROUP_TOGGLE: (id) => `${BASE}/master/agreement-groups/${id}/toggle-status`,

  MASTER_INCOME_TYPES: `${BASE}/master/income-types`,
  MASTER_INCOME_TYPES_SEARCH: `${BASE}/master/income-types/search`,
  MASTER_INCOME_TYPE_BY_ID: (id) => `${BASE}/master/income-types/${id}`,
  MASTER_INCOME_TYPE_TOGGLE: (id) => `${BASE}/master/income-types/${id}/toggle-status`,

  MASTER_STATES: `${BASE}/master/states`,
  MASTER_STATES_SEARCH: `${BASE}/master/states/search`,
  MASTER_STATE_BY_ID: (id) => `${BASE}/master/states/${id}`,
  MASTER_STATE_TOGGLE: (id) => `${BASE}/master/states/${id}/toggle-status`,

  MASTER_PRICE_OFF_LOCATIONS: `${BASE}/master/price-off-locations`,
  MASTER_PRICE_OFF_LOCATIONS_SEARCH: `${BASE}/master/price-off-locations/search`,
  MASTER_PRICE_OFF_LOCATION_BY_ID: (id) => `${BASE}/master/price-off-locations/${id}`,
  MASTER_PRICE_OFF_LOCATION_TOGGLE: (id) => `${BASE}/master/price-off-locations/${id}/toggle-status`,

  MASTER_AGREEMENT_TYPES: `${BASE}/master/agreement-types`,
  MASTER_AGREEMENT_TYPES_SEARCH: `${BASE}/master/agreement-types/search`,
  MASTER_AGREEMENT_TYPE_BY_ID: (id) => `${BASE}/master/agreement-types/${id}`,
  MASTER_AGREEMENT_TYPE_TOGGLE: (id) => `${BASE}/master/agreement-types/${id}/toggle-status`,

  MASTER_CHANNELS: `${BASE}/master/channels`,
  MASTER_CHANNELS_SEARCH: `${BASE}/master/channels/search`,
  MASTER_CHANNEL_BY_ID: (id) => `${BASE}/master/channels/${id}`,
  MASTER_CHANNEL_TOGGLE: (id) => `${BASE}/master/channels/${id}/toggle-status`,

  MASTER_ROLES: `${BASE}/master/roles`,
  MASTER_ROLES_SEARCH: `${BASE}/master/roles/search`,
  MASTER_ROLE_BY_ID: (id) => `${BASE}/master/roles/${id}`,
  MASTER_ROLE_TOGGLE: (id) => `${BASE}/master/roles/${id}/toggle-status`,

  MASTER_RIGHTS: `${BASE}/master/rights`,
  MASTER_RIGHTS_SEARCH: `${BASE}/master/rights/search`,
  MASTER_RIGHT_BY_ID: (id) => `${BASE}/master/rights/${id}`,
  MASTER_RIGHT_TOGGLE: (id) => `${BASE}/master/rights/${id}/toggle-status`,

  MASTER_ROLE_RIGHTS: `${BASE}/master/role-rights`,
  MASTER_ROLE_RIGHTS_BY_ROLE: (roleId) => `${BASE}/master/role-rights/${roleId}`,

  PRICE_OFFS: `${BASE}/price-offs`,
  PRICE_OFFS_LOCATIONS: `${BASE}/price-offs/locations`,
  PRICE_OFFS_FILTER_OPTIONS: `${BASE}/price-offs/filter-options`,
  PRICE_OFFS_TEMPLATE: `${BASE}/price-offs/template`,
  PRICE_OFFS_UPLOAD: `${BASE}/price-offs/upload`,
  PRICE_OFFS_PREVIEW: `${BASE}/price-offs/preview`,
  PRICE_OFFS_COMMIT: `${BASE}/price-offs/commit`,
  INTEGRATION_PRODUCTS_BULK_VALIDATE: `${BASE}/integration/products/bulk-validate`,
  PRICE_OFF_BY_ID: (id) => `${BASE}/price-offs/${id}`,
  PRICE_OFF_CAMPAIGN_ID: (id) => `${BASE}/price-offs/${id}/campaign-id`,
  PRICE_OFFS_BULK_CAMPAIGN_ID: `${BASE}/price-offs/bulk-campaign-id`,
  PRICE_OFFS_BULK_SUBMIT: `${BASE}/price-offs/bulk-submit`,
  PRICE_OFFS_BULK_DELETE: `${BASE}/price-offs/bulk`,
  PRICE_OFFS_BULK_APPROVE: `${BASE}/price-offs/bulk-approve`,
  PRICE_OFFS_BULK_REJECT: `${BASE}/price-offs/bulk-reject`,
  PRICE_OFF_APPROVE: (id) => `${BASE}/price-offs/${id}/approve`,
  PRICE_OFF_REJECT: (id) => `${BASE}/price-offs/${id}/reject`,

  // File upload proxy
  UPLOAD_ASSET: `${BASE}/upload/asset`,
  UPLOAD_PROXY_DOWNLOAD: `${BASE}/upload/proxy-download`,
};
