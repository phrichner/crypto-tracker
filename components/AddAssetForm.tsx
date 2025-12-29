import React, { useState } from 'react';
import { Plus, Loader2, Calendar, DollarSign, Tag } from 'lucide-react';
import { Currency } from '../types';
import { SUPPORTED_CURRENCIES } from '../services/currencyService';

interface AddAssetFormProps {
  onAdd: (ticker: string, quantity: number, pricePerCoin: number, date: string, currency: Currency, tag?: string) => Promise<void>;
  isGlobalLoading: boolean;
}

const PRESET_TAGS = ['DCA', 'FOMO', 'Strategic', 'Rebalance', 'Emergency', 'Profit-Taking', 'Research'];

export const AddAssetForm: React.FC<AddAssetFormProps> = ({ onAdd, isGlobalLoading }) => {
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [totalPaid, setTotalPaid] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [tag, setTag] = useState('DCA');
  const [customTag, setCustomTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !quantity || !totalPaid) return;

    const qtyNum = parseFloat(quantity);
    const totalPaidNum = parseFloat(totalPaid);
    
    // Calculate price per coin derived from total paid
    const calculatedPricePerCoin = qtyNum > 0 ? totalPaidNum / qtyNum : 0;

    // Use custom tag if "Custom" is selected and custom tag is filled
    const finalTag = tag === 'Custom' && customTag.trim() ? customTag.trim() : tag;

    setIsSubmitting(true);
    await onAdd(
      ticker, 
      qtyNum, 
      calculatedPricePerCoin,
      date,
      currency,
      finalTag
    );
    
    // Reset form but keep date, currency, and tag
    setTicker('');
    setQuantity('');
    setTotalPaid('');
    setCustomTag('');
    setIsSubmitting(false);
  };

  return (
    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl mb-8">
      <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <Plus className="text-indigo-500" size={20} />
        Add Transaction
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="flex-1 w-full">
            <label htmlFor="ticker" className="block text-xs font-medium text-slate-400 mb-1">
              Ticker Symbol
            </label>
            <input
              id="ticker"
              type="text"
              value={ticker}
              onChange={(e) => {
                const value = e.target.value;
                // Only uppercase if it's NOT a contract address
                setTicker(value.startsWith('0x') && value.length > 10 ? value : value.toUpperCase());
              }}
              placeholder="BTC or 0x"
              title="Examples: BTC, ETH, AAPL, NESN.SW (Swiss), SAP.DE (German), 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-slate-600 uppercase"
              required
            />
          </div>
          <div className="flex-1 w-full">
            <label htmlFor="quantity" className="block text-xs font-medium text-slate-400 mb-1">
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-slate-600"
              required
            />
          </div>
          <div className="flex-1 w-full">
            <label htmlFor="totalPaid" className="block text-xs font-medium text-slate-400 mb-1">
              Total Paid
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500">
                <DollarSign size={16} />
              </span>
              <input
                id="totalPaid"
                type="number"
                step="any"
                value={totalPaid}
                onChange={(e) => setTotalPaid(e.target.value)}
                placeholder="1000.00"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 pr-4 py-2.5 text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-slate-600"
                required
              />
            </div>
          </div>
          <div className="flex-1 w-full">
            <label htmlFor="currency" className="block text-xs font-medium text-slate-400 mb-1">
              Currency
            </label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
            >
              {SUPPORTED_CURRENCIES.map(curr => (
                <option key={curr.code} value={curr.code}>
                  {curr.flag} {curr.code}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 w-full">
            <label htmlFor="tag" className="block text-xs font-medium text-slate-400 mb-1">
              Tag
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500 pointer-events-none">
                <Tag size={16} />
              </span>
              <select
                id="tag"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 pr-4 py-2.5 text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer appearance-none"
              >
                {PRESET_TAGS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value="Custom">Custom...</option>
              </select>
              <div className="absolute right-3 top-3 pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          <div className="flex-1 w-full">
            <label htmlFor="date" className="block text-xs font-medium text-slate-400 mb-1">
              Date
            </label>
            <div className="relative">
               <span className="absolute left-3 top-2.5 text-slate-500">
                <Calendar size={16} />
              </span>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 pr-4 py-2.5 text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-slate-600 [color-scheme:dark]"
                required
              />
            </div>
          </div>
        </div>
        
        {/* Custom tag input - shows only when "Custom" is selected */}
        {tag === 'Custom' && (
          <div className="w-full md:w-1/3">
            <label htmlFor="customTag" className="block text-xs font-medium text-slate-400 mb-1">
              Custom Tag Name
            </label>
            <input
              id="customTag"
              type="text"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              placeholder="Enter custom tag..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-slate-600"
            />
          </div>
        )}
        
        <button
          type="submit"
          disabled={isSubmitting || isGlobalLoading}
          className="w-full md:w-auto self-end bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 min-w-[120px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Processing...
            </>
          ) : (
            'Add Transaction'
          )}
        </button>
      </form>
    </div>
  );
};