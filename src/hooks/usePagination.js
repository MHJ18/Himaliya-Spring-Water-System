import { useMemo, useState, useCallback } from 'react';

export function usePagination(items, pageSize = 8) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil((items?.length || 0) / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return (items || []).slice(start, start + pageSize);
  }, [items, page, pageSize]);
  const goToPage = useCallback(
    (p) => setPage(Math.min(Math.max(1, p), totalPages)),
    [totalPages]
  );
  const resetPage = useCallback(() => setPage(1), []);
  return { page, totalPages, paginatedItems, goToPage, resetPage };
}
