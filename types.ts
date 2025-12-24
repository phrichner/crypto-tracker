export interface SourceLink {
  title: string;
  url: string;
}

export interface Transaction {
  id: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  pricePerCoin: number;
  date: string;
  totalCost: number;
  tag?: string; // NEW: Transaction tags for analytics
}

export interface Asset {
  id: string;
  ticker: string;
  name?: string;
  quantity: number;
  currentPrice: number;
  lastUpdated: string;
  sources: SourceLink[];
  isUpdating: boolean;
  error?: string;
  transactions: Transaction[];
  avgBuyPrice: number;
  totalCostBasis: number;
  coinGeckoId?: string;
  priceHistory?: number[][];
  targetAllocation?: number;
}

export interface HistorySnapshot {
  timestamp: number;
  totalValue: number;
  assetValues: Record<string, number>;
}

export interface Portfolio {
  id: string;
  name: string;
  color: string; // For visual distinction
  assets: Asset[];
  history: HistorySnapshot[];
  settings: {
    // Future settings can go here
  };
  createdAt: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCostBasis: number;
  totalPnL: number;
  totalPnLPercent: number;
  assetCount: number;
  lastGlobalUpdate: string | null;
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}