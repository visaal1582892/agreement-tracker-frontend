sed -i 's/searchManufacturers: (searchKey) =>/getManufacturersByIds: (ids) => axiosInstance.get(`${ENDPOINTS.INTEGRATION_MANUFACTURERS}\/by-ids`, { params: { ids: ids.join('\',\'') } }),\n\n  searchManufacturers: (searchKey) =>/g' src/api/integrationApi.js

sed -i 's/getDivisions: ({ manufacturerIds/getDivisionsByIds: ({ manufacturerIds, ids }) => axiosInstance.get(`${ENDPOINTS.INTEGRATION_DIVISIONS}\/by-ids`, { params: { manufacturerIds: manufacturerIds.join('\',\''), ids: ids.join('\',\'') } }),\n\n  getDivisions: ({ manufacturerIds/g' src/api/integrationApi.js

sed -i 's/searchProducts: ({/getProductsByIds: (ids) => axiosInstance.post(ENDPOINTS.INTEGRATION_PRODUCTS_BULK_VALIDATE, { productIds: ids }),\n\n  searchProducts: ({/g' src/api/integrationApi.js
