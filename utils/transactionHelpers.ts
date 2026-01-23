/**
 * Transaction Helper Utilities
 *
 * Provides functions for flattening, searching, filtering, and sorting transactions
 * across all assets in a portfolio. Used by the Transaction History feature.
 */

import { Asset, Transaction, TransactionType, Currency, Portfolio } from '../types';

/**
 * Flattened transaction with asset context
 * Combines transaction data with its parent asset information for display
 */
export interface FlattenedTransaction {
  // Transaction data
  transaction: Transaction;

  // Parent asset context
  assetId: string;
  assetTicker: string;
  assetName: string;
  assetCurrency: Currency;
  assetType: string;
  currentPrice: number;

  // Portfolio context
  portfolioId: string;
  portfolioName: string;

  // Linked transaction info (for BUY/SELL pairs)
  linkedTransaction?: {
    transaction: Transaction;
    assetTicker: string;
    assetName: string;
  };

  // Computed fields for display
  displayValue: number; // Total value in asset's currency
}

/**
 * Filter criteria for transactions
 */
export interface TransactionFilterCriteria {
  searchQuery: string;
  transactionTypes: TransactionType[];
  assetTickers: string[];
  portfolioIds: string[];
  tags: string[];
  dateFrom: string | null;
  dateTo: string | null;
  amountMin: number | null;
  amountMax: number | null;
  currencies: Currency[];
}

/**
 * Sort configuration
 */
export type SortField = 'date' | 'type' | 'asset' | 'quantity' | 'price' | 'total' | 'tag';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

/**
 * Default filter criteria (no filters applied)
 */
export const DEFAULT_FILTER_CRITERIA: TransactionFilterCriteria = {
  searchQuery: '',
  transactionTypes: [],
  assetTickers: [],
  portfolioIds: [],
  tags: [],
  dateFrom: null,
  dateTo: null,
  amountMin: null,
  amountMax: null,
  currencies: [],
};

/**
 * Default sort configuration (newest first)
 */
export const DEFAULT_SORT_CONFIG: SortConfig = {
  field: 'date',
  direction: 'desc',
};

/**
 * Flatten all transactions from multiple portfolios into a single array
 * Each transaction includes its parent asset and portfolio context
 */
export function flattenTransactions(
  portfolios: Portfolio[],
  portfolioFilter?: string[] // Optional: only include specific portfolios
): FlattenedTransaction[] {
  const flattened: FlattenedTransaction[] = [];

  const portfoliosToProcess = portfolioFilter && portfolioFilter.length > 0
    ? portfolios.filter(p => portfolioFilter.includes(p.id))
    : portfolios;

  for (const portfolio of portfoliosToProcess) {
    for (const asset of portfolio.assets) {
      for (const transaction of asset.transactions) {
        // Find linked transaction if this is part of a BUY/SELL pair
        let linkedTransaction: FlattenedTransaction['linkedTransaction'] | undefined;

        if (transaction.linkedBuySellTransactionId) {
          // Search for the linked transaction in all assets
          for (const searchAsset of portfolio.assets) {
            const linkedTx = searchAsset.transactions.find(
              tx => tx.id === transaction.linkedBuySellTransactionId
            );
            if (linkedTx) {
              linkedTransaction = {
                transaction: linkedTx,
                assetTicker: searchAsset.ticker,
                assetName: searchAsset.name || searchAsset.ticker,
              };
              break;
            }
          }
        }

        flattened.push({
          transaction,
          assetId: asset.id,
          assetTicker: asset.ticker,
          assetName: asset.name || asset.ticker,
          assetCurrency: asset.currency || 'USD',
          assetType: asset.assetType || 'CRYPTO',
          currentPrice: asset.currentPrice,
          portfolioId: portfolio.id,
          portfolioName: portfolio.name,
          linkedTransaction,
          displayValue: transaction.totalCost,
        });
      }
    }
  }

  return flattened;
}

/**
 * Search transactions by text query
 * Searches across: asset ticker, asset name, tags, notes, income source, deposit source
 */
export function searchTransactions(
  transactions: FlattenedTransaction[],
  query: string
): FlattenedTransaction[] {
  if (!query.trim()) {
    return transactions;
  }

  const lowerQuery = query.toLowerCase().trim();

  return transactions.filter(item => {
    const tx = item.transaction;

    // Search in asset ticker and name
    if (item.assetTicker.toLowerCase().includes(lowerQuery)) return true;
    if (item.assetName.toLowerCase().includes(lowerQuery)) return true;

    // Search in portfolio name
    if (item.portfolioName.toLowerCase().includes(lowerQuery)) return true;

    // Search in tag
    if (tx.tag && tx.tag.toLowerCase().includes(lowerQuery)) return true;

    // Search in transaction type
    if (tx.type.toLowerCase().includes(lowerQuery)) return true;

    // Search in amount (convert to string)
    if (tx.quantity.toString().includes(lowerQuery)) return true;
    if (tx.totalCost.toString().includes(lowerQuery)) return true;

    // Search in transaction-specific fields
    if (tx.depositSource && tx.depositSource.toLowerCase().includes(lowerQuery)) return true;
    if (tx.withdrawalDestination && tx.withdrawalDestination.toLowerCase().includes(lowerQuery)) return true;
    if (tx.incomeSource && tx.incomeSource.toLowerCase().includes(lowerQuery)) return true;
    if (tx.incomeType && tx.incomeType.toLowerCase().includes(lowerQuery)) return true;

    // Search in linked transaction info
    if (tx.sourceTicker && tx.sourceTicker.toLowerCase().includes(lowerQuery)) return true;
    if (tx.proceedsCurrency && tx.proceedsCurrency.toLowerCase().includes(lowerQuery)) return true;

    return false;
  });
}

/**
 * Filter transactions by criteria
 */
export function filterTransactions(
  transactions: FlattenedTransaction[],
  criteria: TransactionFilterCriteria
): FlattenedTransaction[] {
  return transactions.filter(item => {
    const tx = item.transaction;

    // Filter by transaction type
    if (criteria.transactionTypes.length > 0) {
      if (!criteria.transactionTypes.includes(tx.type)) {
        return false;
      }
    }

    // Filter by asset ticker
    if (criteria.assetTickers.length > 0) {
      if (!criteria.assetTickers.includes(item.assetTicker)) {
        return false;
      }
    }

    // Filter by portfolio
    if (criteria.portfolioIds.length > 0) {
      if (!criteria.portfolioIds.includes(item.portfolioId)) {
        return false;
      }
    }

    // Filter by tag
    if (criteria.tags.length > 0) {
      if (!tx.tag || !criteria.tags.includes(tx.tag)) {
        return false;
      }
    }

    // Filter by date range
    if (criteria.dateFrom) {
      const txDate = new Date(tx.date);
      const fromDate = new Date(criteria.dateFrom);
      if (txDate < fromDate) {
        return false;
      }
    }

    if (criteria.dateTo) {
      const txDate = new Date(tx.date);
      const toDate = new Date(criteria.dateTo);
      // Set toDate to end of day for inclusive filtering
      toDate.setHours(23, 59, 59, 999);
      if (txDate > toDate) {
        return false;
      }
    }

    // Filter by amount range
    if (criteria.amountMin !== null) {
      if (tx.totalCost < criteria.amountMin) {
        return false;
      }
    }

    if (criteria.amountMax !== null) {
      if (tx.totalCost > criteria.amountMax) {
        return false;
      }
    }

    // Filter by currency
    if (criteria.currencies.length > 0) {
      if (!criteria.currencies.includes(item.assetCurrency)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sort transactions by field and direction
 */
export function sortTransactions(
  transactions: FlattenedTransaction[],
  sortConfig: SortConfig
): FlattenedTransaction[] {
  const sorted = [...transactions];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortConfig.field) {
      case 'date':
        comparison = new Date(a.transaction.date).getTime() - new Date(b.transaction.date).getTime();
        break;

      case 'type':
        comparison = a.transaction.type.localeCompare(b.transaction.type);
        break;

      case 'asset':
        comparison = a.assetTicker.localeCompare(b.assetTicker);
        break;

      case 'quantity':
        comparison = a.transaction.quantity - b.transaction.quantity;
        break;

      case 'price':
        comparison = a.transaction.pricePerCoin - b.transaction.pricePerCoin;
        break;

      case 'total':
        comparison = a.transaction.totalCost - b.transaction.totalCost;
        break;

      case 'tag':
        const tagA = a.transaction.tag || '';
        const tagB = b.transaction.tag || '';
        comparison = tagA.localeCompare(tagB);
        break;

      default:
        comparison = 0;
    }

    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Get unique values from transactions for filter dropdowns
 */
export function getUniqueFilterValues(transactions: FlattenedTransaction[]) {
  const assets = new Map<string, { ticker: string; name: string }>();
  const portfolios = new Map<string, { id: string; name: string }>();
  const tags = new Set<string>();
  const currencies = new Set<Currency>();

  for (const item of transactions) {
    // Collect unique assets
    if (!assets.has(item.assetTicker)) {
      assets.set(item.assetTicker, {
        ticker: item.assetTicker,
        name: item.assetName,
      });
    }

    // Collect unique portfolios
    if (!portfolios.has(item.portfolioId)) {
      portfolios.set(item.portfolioId, {
        id: item.portfolioId,
        name: item.portfolioName,
      });
    }

    // Collect unique tags
    if (item.transaction.tag) {
      tags.add(item.transaction.tag);
    }

    // Collect unique currencies
    currencies.add(item.assetCurrency);
  }

  return {
    assets: Array.from(assets.values()).sort((a, b) => a.ticker.localeCompare(b.ticker)),
    portfolios: Array.from(portfolios.values()).sort((a, b) => a.name.localeCompare(b.name)),
    tags: Array.from(tags).sort(),
    currencies: Array.from(currencies).sort(),
  };
}

/**
 * Group linked transactions (BUY/SELL pairs) together
 * Returns transactions with linked pairs merged into single entries when showCombined is true
 */
export function groupLinkedTransactions(
  transactions: FlattenedTransaction[],
  showCombined: boolean
): FlattenedTransaction[] {
  if (!showCombined) {
    // Return all transactions as-is (expanded view)
    return transactions;
  }

  // Track which transactions we've already included as part of a pair
  const processedIds = new Set<string>();
  const result: FlattenedTransaction[] = [];

  for (const item of transactions) {
    const tx = item.transaction;

    // Skip if already processed as part of a pair
    if (processedIds.has(tx.id)) {
      continue;
    }

    // Check if this is part of a linked pair (only need linkedBuySellTransactionId)
    if (tx.linkedBuySellTransactionId) {
      // Mark both transactions as processed
      processedIds.add(tx.id);
      processedIds.add(tx.linkedBuySellTransactionId);

      // For combined view, we want to show the BUY transaction (the "destination")
      // This shows "Buy X with Y" as a single row
      if (tx.type === 'BUY') {
        result.push(item);
      }
      // If this is the SELL side, find and add the linked BUY transaction instead
      else if (tx.type === 'SELL') {
        const linkedBuy = transactions.find(
          t => t.transaction.id === tx.linkedBuySellTransactionId
        );
        if (linkedBuy) {
          // Add the BUY transaction (which has the combined display info)
          result.push(linkedBuy);
        } else {
          // BUY doesn't exist (e.g., filtered out), show the SELL instead
          result.push(item);
        }
      }
    } else {
      // Not part of a pair, include as-is
      result.push(item);
    }
  }

  return result;
}

/**
 * Get transaction type display info
 */
export function getTransactionTypeInfo(type: TransactionType): {
  label: string;
  colorClass: string;
  bgClass: string;
} {
  switch (type) {
    case 'BUY':
      return {
        label: 'Buy',
        colorClass: 'text-blue-400',
        bgClass: 'bg-blue-500/20 border-blue-500/30',
      };
    case 'SELL':
      return {
        label: 'Sell',
        colorClass: 'text-rose-400',
        bgClass: 'bg-rose-500/20 border-rose-500/30',
      };
    case 'DEPOSIT':
      return {
        label: 'Deposit',
        colorClass: 'text-emerald-400',
        bgClass: 'bg-emerald-500/20 border-emerald-500/30',
      };
    case 'WITHDRAWAL':
      return {
        label: 'Withdraw',
        colorClass: 'text-amber-400',
        bgClass: 'bg-amber-500/20 border-amber-500/30',
      };
    case 'TRANSFER':
      return {
        label: 'Transfer',
        colorClass: 'text-purple-400',
        bgClass: 'bg-purple-500/20 border-purple-500/30',
      };
    case 'INCOME':
      return {
        label: 'Income',
        colorClass: 'text-cyan-400',
        bgClass: 'bg-cyan-500/20 border-cyan-500/30',
      };
    default:
      return {
        label: type,
        colorClass: 'text-slate-400',
        bgClass: 'bg-slate-500/20 border-slate-500/30',
      };
  }
}

/**
 * Format transaction for combined display (BUY with asset)
 */
export function formatCombinedTransaction(item: FlattenedTransaction): string {
  const tx = item.transaction;

  if (tx.type === 'BUY' && tx.sourceTicker && tx.sourceQuantity) {
    return `Buy ${tx.quantity.toLocaleString()} ${item.assetTicker} with ${tx.sourceQuantity.toLocaleString()} ${tx.sourceTicker}`;
  }

  if (tx.type === 'SELL' && tx.proceedsCurrency) {
    return `Sell ${tx.quantity.toLocaleString()} ${item.assetTicker} for ${tx.proceedsCurrency}`;
  }

  return `${tx.type} ${tx.quantity.toLocaleString()} ${item.assetTicker}`;
}

/**
 * Check if filters are active (any non-default values)
 */
export function hasActiveFilters(criteria: TransactionFilterCriteria): boolean {
  return (
    criteria.searchQuery.trim() !== '' ||
    criteria.transactionTypes.length > 0 ||
    criteria.assetTickers.length > 0 ||
    criteria.portfolioIds.length > 0 ||
    criteria.tags.length > 0 ||
    criteria.dateFrom !== null ||
    criteria.dateTo !== null ||
    criteria.amountMin !== null ||
    criteria.amountMax !== null ||
    criteria.currencies.length > 0
  );
}
