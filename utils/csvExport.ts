/**
 * CSV Export Utility
 *
 * Provides functions for generating and downloading CSV files from transaction data.
 * Uses native browser APIs (Blob, URL) without external dependencies.
 */

import { FlattenedTransaction } from './transactionHelpers';

/**
 * Escape a value for CSV format
 * Handles: commas, quotes, newlines
 */
function escapeCSVValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // Check if escaping is needed
  const needsEscaping = stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r');

  if (needsEscaping) {
    // Escape double quotes by doubling them, then wrap in quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Generate CSV content from flattened transactions
 */
export function generateTransactionCSV(transactions: FlattenedTransaction[]): string {
  // Define CSV headers
  const headers = [
    'Date',
    'Time',
    'Type',
    'Portfolio',
    'Asset Ticker',
    'Asset Name',
    'Asset Type',
    'Quantity',
    'Price Per Unit',
    'Total Value',
    'Currency',
    'Tag',
    // BUY specific
    'Source Asset',
    'Source Quantity',
    // SELL specific
    'Proceeds Currency',
    'Proceeds Amount',
    // DEPOSIT specific
    'Deposit Source',
    'Cost Basis',
    // WITHDRAWAL specific
    'Withdrawal Destination',
    // TRANSFER specific
    'Destination Portfolio ID',
    // INCOME specific
    'Income Type',
    'Income Source',
    // Metadata
    'Transaction ID',
    'Linked Transaction ID',
    'Transaction Pair ID',
    'Created At',
    'Last Edited',
  ];

  const rows: string[] = [headers.map(escapeCSVValue).join(',')];

  for (const item of transactions) {
    const tx = item.transaction;

    // Parse date and time
    const dateObj = new Date(tx.date);
    const dateStr = tx.date; // Keep original date string
    const timeStr = tx.createdAt
      ? new Date(tx.createdAt).toLocaleTimeString('en-US', { hour12: false })
      : '';

    const row = [
      dateStr,
      timeStr,
      tx.type,
      item.portfolioName,
      item.assetTicker,
      item.assetName,
      item.assetType,
      tx.quantity,
      tx.pricePerCoin,
      tx.totalCost,
      item.assetCurrency,
      tx.tag || '',
      // BUY specific
      tx.sourceTicker || '',
      tx.sourceQuantity || '',
      // SELL specific
      tx.proceedsCurrency || '',
      tx.proceeds || '',
      // DEPOSIT specific
      tx.depositSource || '',
      tx.costBasis || '',
      // WITHDRAWAL specific
      tx.withdrawalDestination || '',
      // TRANSFER specific
      tx.destinationPortfolioId || '',
      // INCOME specific
      tx.incomeType || '',
      tx.incomeSource || '',
      // Metadata
      tx.id,
      tx.linkedBuySellTransactionId || '',
      tx.transactionPairId || '',
      tx.createdAt || '',
      tx.lastEdited || '',
    ];

    rows.push(row.map(escapeCSVValue).join(','));
  }

  return rows.join('\n');
}

/**
 * Generate a filename for the CSV export
 */
export function generateExportFilename(prefix: string = 'transactions'): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  return `${prefix}_export_${dateStr}.csv`;
}

/**
 * Download CSV content as a file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // Create a Blob with the CSV content
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create a download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  // Append to body, click, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Export transactions to CSV and trigger download
 * Main entry point for CSV export functionality
 */
export function exportTransactionsToCSV(
  transactions: FlattenedTransaction[],
  filenamePrefix: string = 'transactions'
): void {
  if (transactions.length === 0) {
    console.warn('No transactions to export');
    return;
  }

  const csvContent = generateTransactionCSV(transactions);
  const filename = generateExportFilename(filenamePrefix);

  downloadCSV(csvContent, filename);

  console.log(`Exported ${transactions.length} transactions to ${filename}`);
}

/**
 * Generate a summary row for the CSV (optional footer)
 */
export function generateCSVSummary(transactions: FlattenedTransaction[]): string {
  const totalTransactions = transactions.length;
  const totalValue = transactions.reduce((sum, t) => sum + t.transaction.totalCost, 0);

  const byType = transactions.reduce((acc, t) => {
    acc[t.transaction.type] = (acc[t.transaction.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const summaryLines = [
    '',
    `Total Transactions: ${totalTransactions}`,
    `Total Value: ${totalValue.toLocaleString()}`,
    '',
    'Breakdown by Type:',
    ...Object.entries(byType).map(([type, count]) => `  ${type}: ${count}`),
  ];

  return summaryLines.join('\n');
}
