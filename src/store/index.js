import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import agreementReducer from './slices/agreementSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    agreements: agreementReducer,
  },
});

export default store;
