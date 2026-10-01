/** Rights codes — must stay in sync with backend {@code RightCode} enum. */
import { ROUTES } from './routes';

export const RIGHTS = {
  DASHBOARD_VIEW: 'DASHBOARD_VIEW',
  DRAFT_VIEW_MY: 'DRAFT_VIEW_MY',
  DRAFT_VIEW_ALL: 'DRAFT_VIEW_ALL',
  DRAFT_EDIT_MY: 'DRAFT_EDIT_MY',
  DRAFT_EDIT_ALL: 'DRAFT_EDIT_ALL',
  DRAFT_DELETE_MY: 'DRAFT_DELETE_MY',
  DRAFT_DELETE_ALL: 'DRAFT_DELETE_ALL',
  AGREEMENT_VIEW_MY: 'AGREEMENT_VIEW_MY',
  AGREEMENT_VIEW_ALL: 'AGREEMENT_VIEW_ALL',
  AGREEMENT_EDIT_MY: 'AGREEMENT_EDIT_MY',
  AGREEMENT_EDIT_ALL: 'AGREEMENT_EDIT_ALL',
  AGREEMENT_SUBMIT_MY: 'AGREEMENT_SUBMIT_MY',
  AGREEMENT_SUBMIT_ALL: 'AGREEMENT_SUBMIT_ALL',
  AGREEMENT_RENEW_MY: 'AGREEMENT_RENEW_MY',
  AGREEMENT_RENEW_ALL: 'AGREEMENT_RENEW_ALL',
  AGREEMENT_REVISE_MY: 'AGREEMENT_REVISE_MY',
  AGREEMENT_REVISE_ALL: 'AGREEMENT_REVISE_ALL',
  AGREEMENT_TERMINATE_MY: 'AGREEMENT_TERMINATE_MY',
  AGREEMENT_TERMINATE_ALL: 'AGREEMENT_TERMINATE_ALL',
  AGREEMENT_IN_PROGRESS_MY: 'AGREEMENT_IN_PROGRESS_MY',
  AGREEMENT_IN_PROGRESS_ALL: 'AGREEMENT_IN_PROGRESS_ALL',
  AGREEMENT_CREATE: 'AGREEMENT_CREATE',
  AGREEMENT_APPROVE: 'AGREEMENT_APPROVE',
  AGREEMENT_REJECT: 'AGREEMENT_REJECT',
  AGREEMENT_CLONE: 'AGREEMENT_CLONE',
  AGREEMENT_TRANSFER: 'AGREEMENT_TRANSFER',
  MASTER_VIEW: 'MASTER_VIEW',
  MASTER_MANAGE: 'MASTER_MANAGE',
  ADMIN_USERS: 'ADMIN_USERS',
  PRICE_OFF_VIEW: 'PRICE_OFF_VIEW',
  PRICE_OFF_MANAGE: 'PRICE_OFF_MANAGE',
  PRICE_OFF_APPROVE: 'PRICE_OFF_APPROVE',
  COMMERCIAL_PAYOUT_CALCULATE: 'COMMERCIAL_PAYOUT_CALCULATE',
};

/** Minimum right(s) required to access a route (any match grants access). */
export const ROUTE_RIGHTS = {
  '/': [RIGHTS.DASHBOARD_VIEW],
  '/agreements': [RIGHTS.AGREEMENT_VIEW_MY, RIGHTS.AGREEMENT_VIEW_ALL, RIGHTS.DRAFT_VIEW_MY, RIGHTS.DRAFT_VIEW_ALL],
  '/agreements/drafts': [RIGHTS.DRAFT_VIEW_MY, RIGHTS.DRAFT_VIEW_ALL],
  '/agreements/groups': [RIGHTS.AGREEMENT_VIEW_MY, RIGHTS.AGREEMENT_VIEW_ALL, RIGHTS.DRAFT_VIEW_MY, RIGHTS.DRAFT_VIEW_ALL],
  '/agreements/new': [RIGHTS.AGREEMENT_CREATE],
  '/agreements/wizard': [RIGHTS.AGREEMENT_CREATE, RIGHTS.DRAFT_EDIT_MY, RIGHTS.DRAFT_EDIT_ALL, RIGHTS.AGREEMENT_EDIT_MY, RIGHTS.AGREEMENT_EDIT_ALL],
  '/approvals': [RIGHTS.AGREEMENT_APPROVE],
  '/commercial-payouts': [RIGHTS.COMMERCIAL_PAYOUT_CALCULATE],
  '/price-offs': [RIGHTS.PRICE_OFF_MANAGE],
  '/price-offs/approvals': [RIGHTS.PRICE_OFF_APPROVE],
  '/admin/users': [RIGHTS.ADMIN_USERS],
  '/master': [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE],
  '/master/companies': [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE],
  '/master/vendors': [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE],
  '/master/manufacturers': [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE],
  '/master/divisions': [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE],
  '/master/products': [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE],
  '/master/income-types': [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE],
  '/master/agreement-types': [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE],
  '/master/price-off-locations': [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE],
  '/master/agreement-groups': [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE],
  '/master/users': [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE],
  '/master/role-rights': [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE],
  '/master/roles': [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE],
  '/master/rights': [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE],
};

export function rightsForPath(pathname) {
  if (ROUTE_RIGHTS[pathname]) return ROUTE_RIGHTS[pathname];
  if (/^\/agreements\/groups\/\d+/.test(pathname)) {
    return [RIGHTS.AGREEMENT_VIEW_MY, RIGHTS.AGREEMENT_VIEW_ALL, RIGHTS.DRAFT_VIEW_MY, RIGHTS.DRAFT_VIEW_ALL];
  }
  if (pathname === '/agreements/wizard' || /^\/agreements\/\d+\/edit/.test(pathname)) {
    return [RIGHTS.AGREEMENT_CREATE, RIGHTS.DRAFT_EDIT_MY, RIGHTS.DRAFT_EDIT_ALL, RIGHTS.AGREEMENT_EDIT_MY, RIGHTS.AGREEMENT_EDIT_ALL];
  }
  if (/^\/agreements\/\d+/.test(pathname)) {
    return [RIGHTS.AGREEMENT_VIEW_MY, RIGHTS.AGREEMENT_VIEW_ALL, RIGHTS.DRAFT_VIEW_MY, RIGHTS.DRAFT_VIEW_ALL];
  }
  const prefix = Object.keys(ROUTE_RIGHTS)
    .filter((p) => p !== '/')
    .sort((a, b) => b.length - a.length)
    .find((p) => pathname.startsWith(p));
  return prefix ? ROUTE_RIGHTS[prefix] : [];
}

export function hasAnyRequiredRight(userRights, requiredRights) {
  if (!requiredRights?.length) return true;
  const granted = userRights ?? [];
  return requiredRights.some((r) => granted.includes(r));
}

/** First route the user is allowed to access (post-login landing page). */
export function defaultRouteForRights(userRights) {
  const candidates = [
    ROUTES.DASHBOARD,
    ROUTES.AGREEMENTS_GROUPS,
    ROUTES.AGREEMENTS_LIST,
    ROUTES.APPROVALS,
    ROUTES.PRICE_OFFS,
    ROUTES.PRICE_OFFS_APPROVALS,
    ROUTES.MASTER,
  ];
  return candidates.find((path) => hasAnyRequiredRight(userRights, ROUTE_RIGHTS[path])) ?? ROUTES.DASHBOARD;
}
