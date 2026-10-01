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
    excludeProductIds = [],
  }) =>
    axiosInstance.post(ENDPOINTS.INTEGRATION_PRODUCTS, {
      searchKey,
      manufacturerIds,
      divisionIds,
      ...(page != null && size != null ? { page, size, pinnedProductIds, excludeProductIds } : {}),
    }),

  /** Live final applicable-product count (mirrors save-time compute). */
  countProductScope: ({ manufacturers = [], divisionRules = [], productRules = [] }) =>
    axiosInstance.post(ENDPOINTS.AGREEMENT_PRODUCT_SCOPE_COUNT, {
      manufacturers,
      divisionRules,
      productRules,
    }),

  /** Fetch stored computed products for an agreement version. */
  getComputedProducts: (agreementVersionId, { page = 0, size = 25, productId, productName, divisionName, manufacturerName, sort, direction } = {}) =>
    axiosInstance.get(ENDPOINTS.AGREEMENT_COMPUTED_PRODUCTS(agreementVersionId), {
      params: { page, size, productId, productName, divisionName, manufacturerName, sort, direction },
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

  /**
   * Returns all countries from the POS DB.
   * Backend returns { countryCode, countryName, subName } — normalised to { code, name, subName }.
   */
  /**
   * Returns all countries from the POS DB matching optional searchKey.
   */
  searchCountries: (searchKey) => {
    const q = typeof searchKey === 'string' ? searchKey.trim() : '';
    return axiosInstance
      .get(ENDPOINTS.INTEGRATION_LOCATION_COUNTRIES, {
        params: q ? { searchKey: q } : {},
      })
      .then(({ data }) => ({
        data: Array.isArray(data)
          ? data.map((r) => ({
              code: r.countryCode || r.CountryCode || r.country_code || r.subName || r.SubName,
              name: r.countryName || r.CountryName || r.country_name || r.name,
              subName: r.subName || r.SubName,
              countrySubName: r.countrySubName,
            }))
          : [],
      }));
  },

  /**
   * Returns states for country code(s) matching optional searchKey.
   * Flexible argument signatures supported:
   *   searchStates(searchKey, countryCodes)
   *   searchStates(countryCodes, searchKey)
   *   searchStates(searchKey)
   */
  searchStates: (arg1, arg2) => {
    let searchKey = '';
    let countryCodes = null;

    if (Array.isArray(arg1)) {
      countryCodes = arg1;
      searchKey = typeof arg2 === 'string' ? arg2 : '';
    } else if (Array.isArray(arg2)) {
      searchKey = typeof arg1 === 'string' ? arg1 : '';
      countryCodes = arg2;
    } else if (typeof arg1 === 'string' && typeof arg2 === 'string') {
      if (arg1.length <= 3 && arg2.length > 3) {
        countryCodes = arg1;
        searchKey = arg2;
      } else {
        searchKey = arg1;
        countryCodes = arg2;
      }
    } else if (typeof arg1 === 'string') {
      searchKey = arg1;
      countryCodes = arg2;
    }

    const rawCodes = Array.isArray(countryCodes)
      ? countryCodes.join(',')
      : (typeof countryCodes === 'string' ? countryCodes : '');

    const params = {
      ...(rawCodes ? { countryCodes: rawCodes } : {}),
      ...(searchKey ? { searchKey: searchKey.trim() } : {}),
    };

    return axiosInstance
      .get(ENDPOINTS.INTEGRATION_LOCATION_STATES, { params })
      .then(({ data }) => ({
        data: Array.isArray(data)
          ? data.map((r) => ({
              code: r.stateCode || r.StateCode || r.state_code || r.subName || r.SubName,
              name: r.stateName || r.StateName || r.state_name || r.name,
              countryCode: r.countryCode || r.CountryCode || r.country_code,
              subName: r.subName || r.SubName,
              countrySubName: r.countrySubName,
              stateSubName: r.stateSubName,
            }))
          : [],
      }));
  },

  /**
   * Returns cities for state code(s) matching optional searchKey.
   * Flexible argument signatures supported:
   *   searchCities(searchKey, stateCodes)
   *   searchCities(stateCodes, searchKey)
   *   searchCities(searchKey)
   */
  searchCities: (arg1, arg2) => {
    let searchKey = '';
    let stateCodes = null;

    if (Array.isArray(arg1)) {
      stateCodes = arg1;
      searchKey = typeof arg2 === 'string' ? arg2 : '';
    } else if (Array.isArray(arg2)) {
      searchKey = typeof arg1 === 'string' ? arg1 : '';
      stateCodes = arg2;
    } else if (typeof arg1 === 'string' && typeof arg2 === 'string') {
      if (arg1.length <= 3 && arg2.length > 3) {
        stateCodes = arg1;
        searchKey = arg2;
      } else {
        searchKey = arg1;
        stateCodes = arg2;
      }
    } else if (typeof arg1 === 'string') {
      searchKey = arg1;
      stateCodes = arg2;
    }

    const rawCodes = Array.isArray(stateCodes)
      ? stateCodes.join(',')
      : (typeof stateCodes === 'string' ? stateCodes : '');

    const params = {
      ...(rawCodes ? { stateCodes: rawCodes } : {}),
      ...(searchKey ? { searchKey: searchKey.trim() } : {}),
    };

    return axiosInstance
      .get(ENDPOINTS.INTEGRATION_LOCATION_CITIES, { params })
      .then(({ data }) => ({
        data: Array.isArray(data)
          ? data.map((r) => ({
              code: r.cityCode || r.CityCode || r.city_code || r.subName || r.SubName,
              name: r.cityName || r.CityName || r.city_name || r.name,
              stateCode: r.stateCode || r.StateCode || r.state_code,
              stateName: r.stateName || r.StateName || r.state_name,
              countryCode: r.countryCode || r.CountryCode || r.country_code,
              subName: r.citySubName || r.CitySubName || r.subName,
              countrySubName: r.countrySubName,
              stateSubName: r.stateSubName,
              citySubName: r.citySubName,
            }))
          : [],
      }));
  },
};

