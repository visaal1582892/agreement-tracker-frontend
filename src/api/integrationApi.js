import axiosInstance from './axiosInstance';
import { ENDPOINTS } from '../config/endpoints';

export function unwrapPaginatedResponse(data) {
  if (data && Array.isArray(data.content)) {
    return {
      content: data.content,
      totalElements: data.totalElements ?? data.content.length,
    };
  }
  if (Array.isArray(data)) {
    return { content: data, totalElements: data.length };
  }
  return { content: [], totalElements: 0 };
}

export const integrationApi = {
  searchManufacturers: (searchKey) =>
    axiosInstance.get(ENDPOINTS.INTEGRATION_MANUFACTURERS, { params: { searchKey } }),

  getManufacturersByIds: (ids) =>
    axiosInstance.get(ENDPOINTS.INTEGRATION_MANUFACTURERS_BY_IDS, {
      params: { ids: Array.isArray(ids) ? ids.join(',') : ids },
    }),

  getDivisions: ({ manufacturerIds, searchKey = '', page, size, pinnedDivisionIds = [] }) =>
    axiosInstance.post(ENDPOINTS.INTEGRATION_DIVISIONS, {
      manufacturerIds,
      ...(page != null && size != null ? { searchKey, page, size, pinnedDivisionIds } : {}),
    }),

  searchProducts: ({
    searchKey = '',
    manufacturerIds = [],
    divisionIds = [],
    page,
    size,
    pinnedProductIds = [],
  }) =>
    axiosInstance.post(ENDPOINTS.INTEGRATION_PRODUCTS, {
      searchKey,
      manufacturerIds,
      divisionIds,
      ...(page != null && size != null ? { page, size, pinnedProductIds } : {}),
    }),

  /** Live final applicable-product count (mirrors save-time compute). */
  countProductScope: ({ manufacturers = [], divisionRules = [], productRules = [] }) =>
    axiosInstance.post(ENDPOINTS.AGREEMENT_PRODUCT_SCOPE_COUNT, {
      manufacturers,
      divisionRules,
      productRules,
    }),

  searchVendors: (searchKey, stateCodes) =>
    axiosInstance.get(ENDPOINTS.INTEGRATION_VENDORS, {
      params: {
        searchKey,
        ...(stateCodes?.length ? { stateCodes: stateCodes.join(',') } : {}),
      },
    }),

  getVendorsByIds: (ids) =>
    axiosInstance.get(ENDPOINTS.INTEGRATION_VENDORS_BY_IDS, {
      params: { ids: ids.join(',') },
    }),

  searchStates: (q, countryCode = 'IN') =>
    axiosInstance.get(ENDPOINTS.INTEGRATION_LOCATION_STATES, {
      params: { q, countryCode },
    }),

  searchCities: (stateCode, q = '') =>
    axiosInstance.get(ENDPOINTS.INTEGRATION_LOCATION_CITIES, {
      params: {
        stateCode,
        ...(q != null && String(q).trim() !== '' ? { q: String(q).trim() } : {}),
      },
    }),
};
