/**
 * Transaction Filters Hook
 *
 * Manages filter state for the Transaction History feature.
 * Provides filter criteria, setters, and session storage persistence.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { TransactionType, Currency, Portfolio } from '../types';
import {
  TransactionFilterCriteria,
  SortConfig,
  DEFAULT_FILTER_CRITERIA,
  DEFAULT_SORT_CONFIG,
  FlattenedTransaction,
  flattenTransactions,
  searchTransactions,
  filterTransactions,
  sortTransactions,
  groupLinkedTransactions,
  hasActiveFilters,
  getUniqueFilterValues,
} from '../utils/transactionHelpers';
import { useSearchInput } from './useDebounce';
import { usePagination, paginateArray, PageSize } from './usePagination';

// Session storage key for filter persistence
const STORAGE_KEY = 'transaction_history_filters';

/**
 * Load filters from session storage
 */
function loadFiltersFromStorage(): Partial<TransactionFilterCriteria> {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load filters from session storage:', e);
  }
  return {};
}

/**
 * Save filters to session storage
 */
function saveFiltersToStorage(filters: TransactionFilterCriteria): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch (e) {
    console.warn('Failed to save filters to session storage:', e);
  }
}

/**
 * Clear filters from session storage
 */
function clearFiltersFromStorage(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear filters from session storage:', e);
  }
}

export interface UseTransactionFiltersResult {
  // Search
  searchInputValue: string;
  searchDebouncedValue: string;
  setSearchValue: (value: string) => void;
  clearSearch: () => void;
  isSearchDebouncing: boolean;

  // Filter criteria
  filters: TransactionFilterCriteria;
  setTransactionTypes: (types: TransactionType[]) => void;
  setAssetTickers: (tickers: string[]) => void;
  setPortfolioIds: (ids: string[]) => void;
  setTags: (tags: string[]) => void;
  setDateFrom: (date: string | null) => void;
  setDateTo: (date: string | null) => void;
  setAmountMin: (amount: number | null) => void;
  setAmountMax: (amount: number | null) => void;
  setCurrencies: (currencies: Currency[]) => void;

  // Sort
  sortConfig: SortConfig;
  setSortConfig: (config: SortConfig) => void;
  toggleSort: (field: SortConfig['field']) => void;

  // Linked transaction toggle
  showCombinedView: boolean;
  setShowCombinedView: (show: boolean) => void;

  // Bulk selection
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  isAllSelected: boolean;

  // Filter state helpers
  hasActiveFilters: boolean;
  resetAllFilters: () => void;

  // Available filter options (derived from data)
  filterOptions: {
    assets: { ticker: string; name: string }[];
    portfolios: { id: string; name: string }[];
    tags: string[];
    currencies: Currency[];
  };

  // Processed results
  allTransactions: FlattenedTransaction[];
  filteredTransactions: FlattenedTransaction[];
  paginatedTransactions: FlattenedTransaction[];
  totalCount: number;
  filteredCount: number;

  // Pagination controls
  pagination: ReturnType<typeof usePagination>;
}

/**
 * Main hook for transaction filtering, sorting, and pagination
 */
export function useTransactionFilters(
  portfolios: Portfolio[]
): UseTransactionFiltersResult {
  // Load initial filters from session storage
  const storedFilters = useMemo(() => loadFiltersFromStorage(), []);

  // Search input with debouncing
  const {
    inputValue: searchInputValue,
    debouncedValue: searchDebouncedValue,
    handleChange: setSearchValue,
    clear: clearSearch,
    isDebouncing: isSearchDebouncing,
  } = useSearchInput(storedFilters.searchQuery || '', 300);

  // Filter criteria state
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>(
    storedFilters.transactionTypes || []
  );
  const [assetTickers, setAssetTickers] = useState<string[]>(
    storedFilters.assetTickers || []
  );
  const [portfolioIds, setPortfolioIds] = useState<string[]>(
    storedFilters.portfolioIds || []
  );
  const [tags, setTags] = useState<string[]>(
    storedFilters.tags || []
  );
  const [dateFrom, setDateFrom] = useState<string | null>(
    storedFilters.dateFrom || null
  );
  const [dateTo, setDateTo] = useState<string | null>(
    storedFilters.dateTo || null
  );
  const [amountMin, setAmountMin] = useState<number | null>(
    storedFilters.amountMin || null
  );
  const [amountMax, setAmountMax] = useState<number | null>(
    storedFilters.amountMax || null
  );
  const [currencies, setCurrencies] = useState<Currency[]>(
    storedFilters.currencies || []
  );

  // Sort state
  const [sortConfig, setSortConfig] = useState<SortConfig>(DEFAULT_SORT_CONFIG);

  // Linked transaction view toggle
  const [showCombinedView, setShowCombinedView] = useState(true);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Build filter criteria object
  const filters: TransactionFilterCriteria = useMemo(() => ({
    searchQuery: searchDebouncedValue,
    transactionTypes,
    assetTickers,
    portfolioIds,
    tags,
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
    currencies,
  }), [
    searchDebouncedValue,
    transactionTypes,
    assetTickers,
    portfolioIds,
    tags,
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
    currencies,
  ]);

  // Save filters to session storage when they change
  useEffect(() => {
    saveFiltersToStorage(filters);
  }, [filters]);

  // Flatten all transactions from portfolios
  const allTransactions = useMemo(() => {
    return flattenTransactions(portfolios);
  }, [portfolios]);

  // Get unique filter options from all transactions
  const filterOptions = useMemo(() => {
    return getUniqueFilterValues(allTransactions);
  }, [allTransactions]);

  // Apply filters and search
  const filteredTransactions = useMemo(() => {
    let result = allTransactions;

    // Apply search
    if (filters.searchQuery) {
      result = searchTransactions(result, filters.searchQuery);
    }

    // Apply filters
    result = filterTransactions(result, filters);

    // Group linked transactions if combined view
    result = groupLinkedTransactions(result, showCombinedView);

    // Apply sorting
    result = sortTransactions(result, sortConfig);

    return result;
  }, [allTransactions, filters, showCombinedView, sortConfig]);

  // Pagination
  const pagination = usePagination(filteredTransactions.length, {
    initialPage: 1,
    initialPageSize: 50,
  });

  // Get paginated results
  const paginatedTransactions = useMemo(() => {
    return paginateArray(
      filteredTransactions,
      pagination.startIndex,
      pagination.endIndex
    );
  }, [filteredTransactions, pagination.startIndex, pagination.endIndex]);

  // Reset pagination when filters change
  useEffect(() => {
    pagination.goToFirstPage();
  }, [filters, showCombinedView, sortConfig]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters, showCombinedView, sortConfig, pagination.currentPage]);

  // Toggle sort direction or change sort field
  const toggleSort = useCallback((field: SortConfig['field']) => {
    setSortConfig(prev => {
      if (prev.field === field) {
        // Toggle direction
        return {
          field,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      // New field, default to descending for date, ascending for others
      return {
        field,
        direction: field === 'date' ? 'desc' : 'asc',
      };
    });
  }, []);

  // Bulk selection helpers
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = paginatedTransactions.map(t => t.transaction.id);
    setSelectedIds(new Set(allIds));
  }, [paginatedTransactions]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = useMemo(() => {
    if (paginatedTransactions.length === 0) return false;
    return paginatedTransactions.every(t => selectedIds.has(t.transaction.id));
  }, [paginatedTransactions, selectedIds]);

  // Reset all filters
  const resetAllFilters = useCallback(() => {
    clearSearch();
    setTransactionTypes([]);
    setAssetTickers([]);
    setPortfolioIds([]);
    setTags([]);
    setDateFrom(null);
    setDateTo(null);
    setAmountMin(null);
    setAmountMax(null);
    setCurrencies([]);
    setSortConfig(DEFAULT_SORT_CONFIG);
    clearFiltersFromStorage();
    setSelectedIds(new Set());
  }, [clearSearch]);

  // Check if any filters are active
  const filtersActive = useMemo(() => {
    return hasActiveFilters(filters);
  }, [filters]);

  return {
    // Search
    searchInputValue,
    searchDebouncedValue,
    setSearchValue,
    clearSearch,
    isSearchDebouncing,

    // Filter criteria
    filters,
    setTransactionTypes,
    setAssetTickers,
    setPortfolioIds,
    setTags,
    setDateFrom,
    setDateTo,
    setAmountMin,
    setAmountMax,
    setCurrencies,

    // Sort
    sortConfig,
    setSortConfig,
    toggleSort,

    // Linked transaction toggle
    showCombinedView,
    setShowCombinedView,

    // Bulk selection
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    isAllSelected,

    // Filter state helpers
    hasActiveFilters: filtersActive,
    resetAllFilters,

    // Available filter options
    filterOptions,

    // Processed results
    allTransactions,
    filteredTransactions,
    paginatedTransactions,
    totalCount: allTransactions.length,
    filteredCount: filteredTransactions.length,

    // Pagination
    pagination,
  };
}
