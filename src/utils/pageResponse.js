/**
 * Normalize Spring Page responses across shapes:
 * - PagedResponse: { content, totalElements, totalPages, page, size }
 * - Spring VIA_DTO:  { content, page: { number, totalElements, totalPages, size } }
 */
export function normalizePageResponse(payload) {
  if (!payload) {
    return { content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 };
  }

  const nestedMeta = payload.page && typeof payload.page === 'object' ? payload.page : null;
  const meta = nestedMeta ?? payload;

  return {
    content: payload.content ?? [],
    totalElements: meta.totalElements ?? 0,
    totalPages: meta.totalPages ?? 0,
    number: meta.number ?? (typeof payload.page === 'number' ? payload.page : 0),
    size: meta.size ?? 10,
  };
}
