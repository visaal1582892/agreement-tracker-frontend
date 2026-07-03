import { useMemo } from 'react';
import { useAuth } from './useAuth';
import {
  canPerformAction,
  getDetailPageActions,
  getListRowActions,
} from '../utils/authUtils';

export function useAgreementPermissions() {
  const auth = useAuth();
  const ctx = useMemo(
    () => ({ user: auth.user, hasRight: auth.hasRight }),
    [auth.user, auth.hasRight],
  );

  return useMemo(() => ({
    ctx,
    canPerformAction: (action, agreement, options) => canPerformAction(ctx, action, agreement, options),
    getDetailPageActions: (agreement, options) => getDetailPageActions(ctx, agreement, options),
    getListRowActions: (agreement) => getListRowActions(ctx, agreement),
  }), [ctx]);
}
