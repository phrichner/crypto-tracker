import { TransactionTag } from '../types';

// P3: Unified TAG library for all transaction types
// All tags available across the application with persistence for custom tags

/**
 * Get all available tags including both preset and custom tags
 * Custom tags are stored in localStorage and persisted across sessions
 */
export function getAllTags(): TransactionTag[] {
  const presetTags: TransactionTag[] = [
    'DCA',
    'Strategic',
    'FOMO',
    'Rebalance',
    'Research',
    'Emergency',
    'Profit-Taking'
  ];

  // Get custom tags from localStorage
  const customTagsJson = localStorage.getItem('customTags');
  const customTags: string[] = customTagsJson ? JSON.parse(customTagsJson) : [];

  return [...presetTags, ...customTags];
}

/**
 * Add a new custom tag to the library
 * Persists to localStorage for use across all transaction types
 */
export function addCustomTag(tag: string): void {
  const trimmedTag = tag.trim();
  if (!trimmedTag) return;

  // Get existing custom tags
  const customTagsJson = localStorage.getItem('customTags');
  const customTags: string[] = customTagsJson ? JSON.parse(customTagsJson) : [];

  // Check if tag already exists (case-insensitive)
  const tagExists = getAllTags().some(
    t => t.toLowerCase() === trimmedTag.toLowerCase()
  );

  if (!tagExists) {
    customTags.push(trimmedTag);
    localStorage.setItem('customTags', JSON.stringify(customTags));
  }
}

/**
 * Remove a custom tag from the library
 * Only custom tags can be removed, preset tags are permanent
 */
export function removeCustomTag(tag: string): void {
  const customTagsJson = localStorage.getItem('customTags');
  const customTags: string[] = customTagsJson ? JSON.parse(customTagsJson) : [];

  const updatedTags = customTags.filter(t => t !== tag);
  localStorage.setItem('customTags', JSON.stringify(updatedTags));
}

/**
 * Check if a tag is a preset (non-removable) tag
 */
export function isPresetTag(tag: string): boolean {
  const presetTags = ['DCA', 'Strategic', 'FOMO', 'Rebalance', 'Research', 'Emergency', 'Profit-Taking'];
  return presetTags.includes(tag);
}

/**
 * Get recommended tags for a specific transaction type
 * Returns a subset of all available tags that are most relevant
 */
export function getRecommendedTags(transactionType: 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'INCOME'): TransactionTag[] {
  const allTags = getAllTags();

  // Define recommended tags per transaction type
  const recommendations: Record<string, string[]> = {
    BUY: ['DCA', 'Strategic', 'FOMO', 'Rebalance', 'Research'],
    SELL: ['Profit-Taking', 'Rebalance', 'Emergency', 'Strategic'],
    DEPOSIT: ['DCA', 'Strategic', 'FOMO', 'Research'],
    WITHDRAWAL: ['Emergency', 'Profit-Taking', 'Rebalance', 'Strategic'],
    TRANSFER: ['Strategic', 'Rebalance', 'Research'],
    INCOME: ['Research', 'DCA', 'Strategic']
  };

  const recommended = recommendations[transactionType] || [];

  // Return recommended preset tags first, then all custom tags, then remaining preset tags
  const presetRecommended = recommended.filter(tag => isPresetTag(tag));
  const customTags = allTags.filter(tag => !isPresetTag(tag));
  const presetOthers = allTags.filter(tag => isPresetTag(tag) && !recommended.includes(tag));

  return [...presetRecommended, ...customTags, ...presetOthers];
}
