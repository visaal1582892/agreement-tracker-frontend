import axiosInstance from '../api/axiosInstance';
import { ENDPOINTS } from '../config/endpoints';

export const userAdminApi = {
  list: (page = 0, size = 20) =>
    axiosInstance.get(ENDPOINTS.USERS, { params: { page, size } }).then((res) => res.data),

  create: (payload) =>
    axiosInstance.post(ENDPOINTS.USERS, payload).then((res) => res.data),

  update: (id, payload) =>
    axiosInstance.put(ENDPOINTS.USER_BY_ID(id), payload).then((res) => res.data),

  deactivate: (id) =>
    axiosInstance.delete(ENDPOINTS.USER_BY_ID(id)),

  resetPassword: (id) =>
    axiosInstance.post(ENDPOINTS.USER_RESET_PASSWORD(id)),

  changePassword: (payload) =>
    axiosInstance.post(ENDPOINTS.USER_CHANGE_PASSWORD, payload),
};
