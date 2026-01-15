import React, { useState } from 'react';
import { TransactionTag, IncomeType, Currency } from '../types';
import { Calendar, Info, Gift, Building2, DollarSign } from 'lucide-react';
import { TagSelector } from './TagSelector';

interface IncomeFormProps {
  onIncome: (ticker: string, quantity: number, date: string, incomeType: IncomeType, incomeSource: string, tag?: TransactionTag, costBasis?: number, costBasisCurrency?: Currency) => Promise<void>;
  onClose: () => void;
}
const CURRENCIES: Currency[] = ['USD', 'CHF', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];

const INCOME_TYPES: Array<{ value: IncomeType; label: string; description: string }> = [
  { value: 'dividend', label: 'Dividend', description: 'Cash or stock dividends from holdings' },
  { value: 'staking', label: 'Staking Rewards', description: 'Rewards from staking crypto' },
  { value: 'airdrop', label: 'Airdrop', description: 'Free tokens from airdrops' },
  { value: 'interest', label: 'Interest', description: 'Interest earned from lending/savings' },
];

export const IncomeForm: React.FC<IncomeFormProps> = ({ onIncome, onClose }) => {
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [incomeType, setIncomeType] = useState<IncomeType>('staking');
  const [incomeSource, setIncomeSource] = useState('');
  const [tag, setTag] = useState<TransactionTag>('Research');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const qtyNum = parseFloat(quantity) || 0;
  const costNum = parseFloat(costBasis) || 0;
  const hasNegativeValues = qtyNum < 0 || costNum < 0;

  // Suggest source based on income type
  const getSuggestedSource = (type: IncomeType): string => {
    switch (type) {
      case 'dividend':
        return ticker ? `${ticker} Dividend Payment` : 'Dividend Payment';
      case 'staking':
        return ticker ? `${ticker} Staking` : 'Coinbase Staking';
      case 'airdrop':
        return ticker ? `${ticker} Airdrop` : 'Airdrop';
      case 'interest':
        return ticker ? `${ticker} Interest` : 'Savings Interest';
      default:
        return '';
    }
  };

  const handleIncomeTypeChange = (type: IncomeType) => {
    setIncomeType(type);
    // Always update source text to match the new income type
    setIncomeSource(getSuggestedSource(type));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ticker.trim() || qtyNum <= 0 || !incomeSource.trim()) {
      alert('Please fill in all required fields with valid values');
      return;
    }

    setIsSubmitting(true);
    try {
      // Pass cost basis if provided, otherwise undefined (will default to 0 in handler)
      await onIncome(ticker.trim().toUpperCase(), qtyNum, date, incomeType, incomeSource.trim(), tag, costNum > 0 ? costNum : undefined, currency);
      onClose();
    } catch (error) {
      console.error('Income failed:', error);
      alert('Failed to create income transaction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Negative Value Warning */}
      {hasNegativeValues && (
        <div className="bg-rose-900/30 border border-rose-700/50 rounded-lg p-4 flex items-start gap-3">
          <Info className="text-rose-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-rose-200">
            <p className="font-medium mb-1">⚠️ Negative values not allowed</p>
            <p className="text-rose-300/80">
              Quantity and cost basis must be positive numbers. Please correct your input.
            </p>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-purple-900/30 border border-purple-700/50 rounded-lg p-4 flex items-start gap-3">
        <Info className="text-purple-400 flex-shrink-0 mt-0.5" size={20} />
        <div className="text-sm text-purple-200">
          <p className="font-medium mb-1">What is Income?</p>
          <p className="text-purple-300/80">
            Record assets received as income (dividends, staking rewards, airdrops, interest).
            Optionally specify cost basis for tax purposes (market value at receipt).
          </p>
        </div>
      </div>

      {/* Income Type Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          <Gift className="inline mr-2" size={16} />
          Income Type *
        </label>
        <div className="grid grid-cols-2 gap-3">
          {INCOME_TYPES.map(({ value, label, description }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleIncomeTypeChange(value)}
              className={`
                p-4 rounded-lg border-2 transition-all text-left
                ${incomeType === value
                  ? 'border-purple-500 bg-purple-900/30 shadow-lg'
                  : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                }
              `}
            >
              <p className={`font-medium mb-1 ${incomeType === value ? 'text-purple-300' : 'text-slate-300'}`}>
                {label}
              </p>
              <p className="text-xs text-slate-500">{description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Ticker */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Asset Ticker *
        </label>
        <input
          type="text"
          value={ticker}
          onChange={(e) => {
            setTicker(e.target.value.toUpperCase());
            if (incomeSource === getSuggestedSource(incomeType)) {
              setIncomeSource(getSuggestedSource(incomeType));
            }
          }}
          placeholder="BTC, ETH, AAPL, SOL..."
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          required
        />
        <p className="text-xs text-slate-500 mt-1">
          The asset you're receiving (can be crypto or stock)
        </p>
      </div>

      {/* Quantity */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Quantity Received *
        </label>
        <input
          type="number"
          step="any"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="0.00"
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          required
        />
      </div>

      {/* Cost Basis (Optional) */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Cost Basis (Optional)
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            >
              {CURRENCIES.map(curr => (
                <option key={curr} value={curr}>{curr}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Amount
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="number"
                step="any"
                min="0"
                value={costBasis}
                onChange={(e) => setCostBasis(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {costNum > 0
            ? `Market value at receipt: ${costNum.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currency}`
            : 'Leave empty for $0 cost basis (100% profit when sold)'}
        </p>
      </div>

      {/* Income Source */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <Building2 className="inline mr-2" size={16} />
          Income Source *
        </label>
        <input
          type="text"
          value={incomeSource}
          onChange={(e) => setIncomeSource(e.target.value)}
          placeholder={getSuggestedSource(incomeType)}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          required
        />
        <p className="text-xs text-slate-500 mt-1">
          Where this income came from (e.g., "Coinbase Staking", "AAPL Dividend")
        </p>
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <Calendar className="inline mr-2" size={16} />
          Income Date *
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          required
        />
      </div>

      {/* Tag */}
      <TagSelector
        value={tag}
        onChange={setTag}
        transactionType="INCOME"
      />

      {/* Submit Button */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !ticker.trim() || qtyNum <= 0 || !incomeSource.trim()}
          className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors"
        >
          {isSubmitting ? 'Creating...' : 'Create Income'}
        </button>
      </div>
    </form>
  );
};
