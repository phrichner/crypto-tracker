/**
 * Pagination Hook
 *
 * Manages pagination state for lists of items.
 * Provides current page, page size, and navigation functions.
 */

import { useState, useMemo, useCallback } from 'react';

export type PageSize = 25 | 50 | 100;

export interface PaginationState {
  currentPage: number;
  pageSize: PageSize;
  totalItems: number;
}

export interface PaginationControls {
  // Current state
  currentPage: number;
  pageSize: PageSize;
  totalItems: number;
  totalPages: number;

  // Computed values
  startIndex: number;
  endIndex: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;

  // Page info for display
  displayStart: number; // 1-indexed for display
  displayEnd: number;

  // Actions
  goToPage: (page: number) => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  setPageSize: (size: PageSize) => void;
  reset: () => void;
}

interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: PageSize;
}

/**
 * Custom hook for managing pagination
 */
export function usePagination(
  totalItems: number,
  options: UsePaginationOptions = {}
): PaginationControls {
  const { initialPage = 1, initialPageSize = 50 } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState<PageSize>(initialPageSize);

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalItems / pageSize));
  }, [totalItems, pageSize]);

  // Ensure current page is valid when total pages changes
  const validCurrentPage = useMemo(() => {
    return Math.min(Math.max(1, currentPage), totalPages);
  }, [currentPage, totalPages]);

  // Update current page if it became invalid
  if (validCurrentPage !== currentPage) {
    setCurrentPage(validCurrentPage);
  }

  // Calculate indices (0-indexed for array slicing)
  const startIndex = useMemo(() => {
    return (validCurrentPage - 1) * pageSize;
  }, [validCurrentPage, pageSize]);

  const endIndex = useMemo(() => {
    return Math.min(startIndex + pageSize, totalItems);
  }, [startIndex, pageSize, totalItems]);

  // Display values (1-indexed for user display)
  const displayStart = totalItems > 0 ? startIndex + 1 : 0;
  const displayEnd = endIndex;

  // Navigation flags
  const hasNextPage = validCurrentPage < totalPages;
  const hasPreviousPage = validCurrentPage > 1;

  // Navigation functions
  const goToPage = useCallback((page: number) => {
    const validPage = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(validPage);
  }, [totalPages]);

  const goToNextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasNextPage]);

  const goToPreviousPage = useCallback(() => {
    if (hasPreviousPage) {
      setCurrentPage(prev => prev - 1);
    }
  }, [hasPreviousPage]);

  const goToFirstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const goToLastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

  const setPageSize = useCallback((size: PageSize) => {
    setPageSizeState(size);
    // Reset to first page when changing page size
    setCurrentPage(1);
  }, []);

  const reset = useCallback(() => {
    setCurrentPage(initialPage);
    setPageSizeState(initialPageSize);
  }, [initialPage, initialPageSize]);

  return {
    currentPage: validCurrentPage,
    pageSize,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    hasNextPage,
    hasPreviousPage,
    displayStart,
    displayEnd,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    setPageSize,
    reset,
  };
}

/**
 * Helper function to paginate an array
 */
export function paginateArray<T>(
  items: T[],
  startIndex: number,
  endIndex: number
): T[] {
  return items.slice(startIndex, endIndex);
}

/**
 * Generate page numbers for pagination UI
 * Returns an array of page numbers and ellipsis markers
 */
export function getPageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 7
): (number | 'ellipsis')[] {
  if (totalPages <= maxVisible) {
    // Show all pages if total is less than max
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];

  // Always show first page
  pages.push(1);

  // Calculate range around current page
  const sidePages = Math.floor((maxVisible - 3) / 2); // -3 for first, last, and current
  let rangeStart = Math.max(2, currentPage - sidePages);
  let rangeEnd = Math.min(totalPages - 1, currentPage + sidePages);

  // Adjust range if at the edges
  if (currentPage <= sidePages + 2) {
    rangeEnd = Math.min(totalPages - 1, maxVisible - 2);
  }
  if (currentPage >= totalPages - sidePages - 1) {
    rangeStart = Math.max(2, totalPages - maxVisible + 3);
  }

  // Add ellipsis before range if needed
  if (rangeStart > 2) {
    pages.push('ellipsis');
  }

  // Add range
  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  // Add ellipsis after range if needed
  if (rangeEnd < totalPages - 1) {
    pages.push('ellipsis');
  }

  // Always show last page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}
