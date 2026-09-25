'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from './button';

/**
 * Pagination côté client : les listes (flottes, machines) sont chargées en
 * entier depuis Headscale, qui ne pagine pas. On ne rend que la page courante
 * pour qu'une centaine de flottes ou quelques milliers de machines restent
 * lisibles et fluides.
 */
export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  return {
    items: items.slice(current * pageSize, (current + 1) * pageSize),
    page: current,
    pageCount,
    pageSize,
    total: items.length,
    setPage,
  };
}

export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  setPage,
  label,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  setPage: (page: number) => void;
  label: (range: { from: number; to: number; total: number }) => string;
}) {
  if (pageCount <= 1) return null;
  const onPageChange = setPage;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-between gap-2 pt-3 text-sm text-muted-foreground">
      <span className="tabular-nums">{label({ from, to, total })}</span>
      <div className="flex gap-1">
        <Button
          size="icon"
          variant="outline"
          className="size-8"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          aria-label="Page précédente"
        >
          <ChevronLeft />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="size-8"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(page + 1)}
          aria-label="Page suivante"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
