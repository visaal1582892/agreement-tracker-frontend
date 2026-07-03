import { useSelector } from 'react-redux';
import {
  selectCurrentUser,
  selectIsAuthenticated,
  selectHasRole,
  selectHasRight,
  selectUserRights,
} from '../store/slices/authSlice';

export function useAuth() {
  const user = useSelector(selectCurrentUser);
  const rights = useSelector(selectUserRights);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isAdmin = useSelector(selectHasRole('ADMIN'));
  const isApprover = useSelector(selectHasRole('APPROVER'));
  const isAccountManager = useSelector(selectHasRole('ACCOUNT_MANAGER'));
  const isLeadership = useSelector(selectHasRole('LEADERSHIP'));

  const hasRole = (role) => user?.roles?.includes(role) ?? false;
  const hasRight = (right) => rights.includes(right);
  const hasAnyRight = (required) => (required ?? []).some((r) => rights.includes(r));
  const hasAllRights = (required) => (required ?? []).every((r) => rights.includes(r));

  return {
    user,
    rights,
    isAuthenticated,
    isAdmin,
    isApprover,
    isAccountManager,
    isLeadership,
    hasRole,
    hasRight,
    hasAnyRight,
    hasAllRights,
  };
}
