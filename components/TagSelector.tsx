import React, { useState } from 'react';
import { TransactionTag } from '../types';
import { Tag as TagIcon, Plus } from 'lucide-react';
import { getRecommendedTags, addCustomTag, isPresetTag } from '../constants/tags';

interface TagSelectorProps {
  value: TransactionTag;
  onChange: (tag: TransactionTag) => void;
  transactionType: 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'INCOME';
  label?: string;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
  value,
  onChange,
  transactionType,
  label = 'Tag'
}) => {
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');

  const availableTags = getRecommendedTags(transactionType);

  const handleAddCustomTag = () => {
    if (customTagInput.trim()) {
      addCustomTag(customTagInput.trim());
      onChange(customTagInput.trim() as TransactionTag);
      setCustomTagInput('');
      setShowCustomTagInput(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">
        <TagIcon className="inline mr-2" size={16} />
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => {
          const selectedValue = e.target.value;
          if (selectedValue === '__ADD_CUSTOM__') {
            setShowCustomTagInput(true);
          } else {
            onChange(selectedValue as TransactionTag);
            setShowCustomTagInput(false);
          }
        }}
        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      >
        {availableTags.map(t => (
          <option key={t} value={t}>
            {t} {!isPresetTag(t) && '(Custom)'}
          </option>
        ))}
        <option value="__ADD_CUSTOM__">+ Add Custom Tag...</option>
      </select>

      {showCustomTagInput && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={customTagInput}
            onChange={(e) => setCustomTagInput(e.target.value)}
            placeholder="Enter custom tag name..."
            maxLength={20}
            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomTag();
              }
            }}
            autoFocus
          />
          <button
            type="button"
            onClick={handleAddCustomTag}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
          >
            <Plus size={14} />
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCustomTagInput(false);
              setCustomTagInput('');
            }}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};
