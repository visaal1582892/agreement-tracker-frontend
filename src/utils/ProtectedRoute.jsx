import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectIsAuthenticated,
  selectUserRights,
  refreshSession,
  logout,
} from '../store/slices/authSlice';
import { ROUTES } from '../config/routes';
import { defaultRouteForRights, hasAnyRequiredRight } from '../config/rights';

export function ProtectedRoute() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const rights = useSelector(selectUserRights);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (rights.length > 0) return;

    dispatch(refreshSession())
      .unwrap()
      .catch(() => dispatch(logout()));
  }, [dispatch, isAuthenticated, rights.length]);

  return isAuthenticated ? <Outlet /> : <Navigate to={ROUTES.LOGIN} replace />;
}

/**
 * Guards routes by user rights from login (CAS-ready).
 * Pass `rights` as an array; user needs any one of them.
 */
export function RightRoute({ rights = [], redirectTo }) {
  const userRights = useSelector(selectUserRights);
  const allowed = hasAnyRequiredRight(userRights, rights);
  const fallback = redirectTo ?? defaultRouteForRights(userRights);
  return allowed ? <Outlet /> : <Navigate to={fallback} replace />;
}

/** @deprecated Use RightRoute with MASTER_VIEW / MASTER_MANAGE instead */
export function AdminRoute() {
  return <RightRoute rights={['MASTER_VIEW', 'MASTER_MANAGE']} />;
}
