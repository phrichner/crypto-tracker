/**
 * Benchmark Service
 *
 * Fetches and caches benchmark index data from Yahoo Finance for portfolio comparison.
 * Supports SMI, S&P 500, MSCI World, Bitcoin, and custom tickers.
 *
 * For crypto benchmarks (BTC-USD, ETH-USD, etc.):
 * - Short timeframes (24H, 1W): Uses hourly data for smoother curves
 * - Longer timeframes (1M, ALL): Uses daily data
 *
 * For stocks/indices: Always uses daily data (hourly not available)
 */

import {
  BenchmarkData,
  BenchmarkConfig,
  BenchmarkSettings,
  ChartBenchmarkData,
  NormalizedBenchmarkPoint,
  DEFAULT_BENCHMARKS
} from '../types';

// Time range type for benchmark fetching
export type BenchmarkTimeRange = '24H' | '1W' | '1M' | '3M' | '1Y' | 'ALL' | 'CUSTOM';

// Cache TTL: 1 hour for short timeframes, 24 hours for longer
const CACHE_TTL_SHORT_MS = 1 * 60 * 60 * 1000;  // 1 hour
const CACHE_TTL_LONG_MS = 24 * 60 * 60 * 1000;  // 24 hours

// LocalStorage key prefix for benchmark data (includes timeRange)
const BENCHMARK_CACHE_PREFIX = 'benchmark_data_';

// Number of interpolated points for smooth chart rendering
const INTERPOLATION_POINTS = 150;

// CORS proxies (same as geminiService)
const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
];

/**
 * Determine currency based on ticker format
 */
const getCurrencyForTicker = (ticker: string): string => {
  if (ticker.endsWith('.SW')) return 'CHF';
  if (ticker.endsWith('.DE') || ticker.endsWith('.F')) return 'EUR';
  if (ticker.endsWith('.L')) return 'GBP';
  if (ticker.endsWith('.T')) return 'JPY';
  if (ticker === '^SSMI') return 'CHF';  // Swiss Market Index
  return 'USD';  // Default for US indices and most benchmarks
};

/**
 * Check if a ticker is a crypto pair (supports hourly data)
 */
const isCryptoTicker = (ticker: string): boolean => {
  const upper = ticker.toUpperCase();
  // Common crypto pairs on Yahoo Finance end with -USD, -EUR, -GBP, etc.
  return upper.includes('-USD') || upper.includes('-EUR') || upper.includes('-GBP') ||
         upper.includes('-USDT') || upper.includes('-BTC') || upper.includes('-ETH');
};

/**
 * Get Yahoo Finance API parameters based on time range and ticker type
 */
const getYahooParams = (ticker: string, timeRange: BenchmarkTimeRange): { range: string; interval: string } => {
  const isCrypto = isCryptoTicker(ticker);

  switch (timeRange) {
    case '24H':
      // For 24H: crypto gets hourly, stocks get daily (closest available)
      return isCrypto
        ? { range: '1d', interval: '15m' }  // 15min intervals for 24h gives ~96 points
        : { range: '5d', interval: '1d' };  // Stocks: get 5 days daily to have context

    case '1W':
      // For 1W: crypto gets hourly (up to 7 days available), stocks get daily
      return isCrypto
        ? { range: '7d', interval: '1h' }   // Hourly for full week
        : { range: '1mo', interval: '1d' }; // Stocks: 1 month daily for context

    case '1M':
      // For 1M: daily data for all
      return { range: '1mo', interval: '1d' };

    case '3M':
      return { range: '3mo', interval: '1d' };

    case '1Y':
      return { range: '1y', interval: '1d' };

    case 'ALL':
    case 'CUSTOM':
    default:
      // For ALL/CUSTOM: fetch max data with daily interval
      return { range: '5y', interval: '1d' };
  }
};

/**
 * Get cache key including timeRange for proper cache separation
 */
const getCacheKey = (ticker: string, timeRange: BenchmarkTimeRange): string => {
  return `${BENCHMARK_CACHE_PREFIX}${ticker}_${timeRange}`;
};

/**
 * Get appropriate cache TTL based on time range
 */
const getCacheTTL = (timeRange: BenchmarkTimeRange): number => {
  // Short timeframes need fresher data
  if (timeRange === '24H' || timeRange === '1W') {
    return CACHE_TTL_SHORT_MS;
  }
  return CACHE_TTL_LONG_MS;
};

/**
 * Load cached benchmark data from localStorage
 */
const loadCachedBenchmark = (ticker: string, timeRange: BenchmarkTimeRange): BenchmarkData | null => {
  try {
    const key = getCacheKey(ticker, timeRange);
    const cached = localStorage.getItem(key);

    if (!cached) return null;

    const data: BenchmarkData = JSON.parse(cached);

    // Check if cache is still valid (within TTL based on timeRange)
    const now = Date.now();
    const ttl = getCacheTTL(timeRange);
    if (now - data.lastUpdated > ttl) {
      console.log(`📊 Benchmark cache expired for ${ticker} (${timeRange})`);
      return null;  // Cache expired, but still return it as fallback is handled elsewhere
    }

    console.log(`📊 Loaded cached benchmark data for ${ticker} (${timeRange}, ${data.priceHistory.length} points)`);
    return data;
  } catch (error) {
    console.warn(`⚠️ Failed to load cached benchmark for ${ticker}:`, error);
    return null;
  }
};

/**
 * Save benchmark data to localStorage cache
 */
const saveBenchmarkCache = (data: BenchmarkData, timeRange: BenchmarkTimeRange): void => {
  try {
    const key = getCacheKey(data.ticker, timeRange);
    localStorage.setItem(key, JSON.stringify(data));
    console.log(`💾 Cached benchmark data for ${data.ticker} (${timeRange})`);
  } catch (error) {
    console.warn(`⚠️ Failed to cache benchmark data:`, error);
  }
};

/**
 * Fetch benchmark data from Yahoo Finance
 * Uses multiple CORS proxies with fallback
 *
 * @param ticker - Yahoo Finance ticker symbol
 * @param name - Display name for the benchmark
 * @param timeRange - Time range for the chart (affects data granularity)
 * @param forceRefresh - Skip cache and fetch fresh data
 */
export const fetchBenchmarkData = async (
  ticker: string,
  name: string,
  timeRange: BenchmarkTimeRange = 'ALL',
  forceRefresh: boolean = false
): Promise<BenchmarkData | null> => {
  console.log(`📈 Fetching benchmark: ${name} (${ticker}) for ${timeRange}`);

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = loadCachedBenchmark(ticker, timeRange);
    if (cached) {
      // Check if cache is fresh (within TTL)
      const now = Date.now();
      const ttl = getCacheTTL(timeRange);
      if (now - cached.lastUpdated <= ttl) {
        return cached;
      }
      // Cache expired but exists - we'll try to fetch fresh data
      // If fetch fails, we can still use stale cache as fallback
    }
  }

  // Get appropriate Yahoo Finance parameters based on timeRange and ticker type
  const { range, interval } = getYahooParams(ticker, timeRange);
  const yahooUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=${interval}`;

  console.log(`📊 Fetching with range=${range}, interval=${interval} (crypto: ${isCryptoTicker(ticker)})`);

  let lastError: Error | null = null;

  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxyUrl = CORS_PROXIES[i](yahooUrl);
    const proxyName = i === 0 ? 'corsproxy.io' : 'allorigins.win';

    try {
      console.log(`📡 Trying CORS proxy #${i + 1} (${proxyName}) for ${ticker}...`);

      const res = await fetch(proxyUrl);

      if (!res.ok) {
        console.warn(`⚠️ Proxy ${proxyName} returned status ${res.status}`);
        continue;
      }

      let data;

      // allorigins.win wraps response differently
      if (proxyName === 'allorigins.win') {
        const proxyData = await res.json();
        data = JSON.parse(proxyData.contents);
      } else {
        data = await res.json();
      }

      if (!data.chart?.result?.[0]) {
        console.warn(`⚠️ Invalid response from ${proxyName} for ${ticker}`);
        continue;
      }

      const result = data.chart.result[0];
      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];

      if (timestamps.length === 0 || closes.length === 0) {
        console.warn(`⚠️ No price history from ${proxyName} for ${ticker}`);
        continue;
      }

      // Build price history array
      const priceHistory: number[][] = [];

      for (let j = 0; j < timestamps.length; j++) {
        const timestamp = timestamps[j] * 1000;  // Convert to milliseconds
        const close = closes[j];

        if (close && close > 0 && !isNaN(close)) {
          priceHistory.push([timestamp, close]);
        }
      }

      if (priceHistory.length === 0) {
        console.warn(`⚠️ No valid price points from ${proxyName} for ${ticker}`);
        continue;
      }

      // Get actual name from Yahoo if available
      let benchmarkName = name;
      if (result.meta?.longName) {
        benchmarkName = result.meta.longName;
      } else if (result.meta?.shortName) {
        benchmarkName = result.meta.shortName;
      }

      const benchmarkData: BenchmarkData = {
        ticker,
        name: benchmarkName,
        priceHistory,
        lastUpdated: Date.now(),
        currency: getCurrencyForTicker(ticker),
      };

      // Cache the data with timeRange-specific key
      saveBenchmarkCache(benchmarkData, timeRange);

      console.log(`✅ Fetched ${priceHistory.length} data points for ${benchmarkName} (${ticker}, ${timeRange})`);
      return benchmarkData;

    } catch (error: any) {
      console.warn(`❌ Proxy ${proxyName} failed for ${ticker}:`, error.message);
      lastError = error;
    }
  }

  // All proxies failed - try to return stale cache as fallback
  const staleCache = loadCachedBenchmark(ticker, timeRange);
  if (staleCache) {
    console.warn(`⚠️ Using stale cache for ${ticker} (all proxies failed)`);
    return staleCache;
  }

  console.error(`❌ Failed to fetch benchmark ${ticker}: ${lastError?.message}`);
  return null;
};

/**
 * Fetch multiple benchmarks in parallel
 *
 * @param configs - Array of benchmark configurations
 * @param timeRange - Time range for data fetching
 * @param forceRefresh - Skip cache and fetch fresh data
 */
export const fetchMultipleBenchmarks = async (
  configs: BenchmarkConfig[],
  timeRange: BenchmarkTimeRange = 'ALL',
  forceRefresh: boolean = false
): Promise<Map<string, BenchmarkData>> => {
  const results = new Map<string, BenchmarkData>();

  // Fetch all benchmarks in parallel
  const promises = configs.map(async (config) => {
    const data = await fetchBenchmarkData(config.ticker, config.name, timeRange, forceRefresh);
    if (data) {
      results.set(config.ticker, data);
    }
  });

  await Promise.all(promises);

  return results;
};

/**
 * Linear interpolation helper
 * Finds the interpolated price at a given timestamp between two known points
 */
const interpolatePrice = (
  targetTimestamp: number,
  beforePoint: [number, number],
  afterPoint: [number, number]
): number => {
  const [t1, p1] = beforePoint;
  const [t2, p2] = afterPoint;

  if (t2 === t1) return p1;

  // Linear interpolation: p = p1 + (p2 - p1) * (t - t1) / (t2 - t1)
  const ratio = (targetTimestamp - t1) / (t2 - t1);
  return p1 + (p2 - p1) * ratio;
};

/**
 * Find the interpolated price at a specific timestamp using binary search
 */
const getPriceAtTimestamp = (
  timestamp: number,
  priceHistory: number[][]
): number | null => {
  if (priceHistory.length === 0) return null;

  // If before all data, return first price
  if (timestamp <= priceHistory[0][0]) {
    return priceHistory[0][1];
  }

  // If after all data, return last price
  if (timestamp >= priceHistory[priceHistory.length - 1][0]) {
    return priceHistory[priceHistory.length - 1][1];
  }

  // Binary search to find surrounding points
  let left = 0;
  let right = priceHistory.length - 1;

  while (left < right - 1) {
    const mid = Math.floor((left + right) / 2);
    if (priceHistory[mid][0] <= timestamp) {
      left = mid;
    } else {
      right = mid;
    }
  }

  // Interpolate between left and right points
  return interpolatePrice(
    timestamp,
    priceHistory[left] as [number, number],
    priceHistory[right] as [number, number]
  );
};

/**
 * Normalize benchmark data to percentage change from a starting point
 * Uses linear interpolation to create smooth curves with INTERPOLATION_POINTS data points
 *
 * @param benchmarkData - Raw benchmark price history
 * @param startTimestamp - Start timestamp for normalization (chart start)
 * @param endTimestamp - End timestamp for normalization (chart end / now)
 * @param numPoints - Number of interpolated points to generate
 */
export const normalizeBenchmarkData = (
  benchmarkData: BenchmarkData,
  startTimestamp: number,
  endTimestamp: number,
  numPoints: number = INTERPOLATION_POINTS
): NormalizedBenchmarkPoint[] => {
  if (!benchmarkData.priceHistory.length) {
    return [];
  }

  const priceHistory = benchmarkData.priceHistory;

  // Get the starting price (at or before startTimestamp)
  const startPrice = getPriceAtTimestamp(startTimestamp, priceHistory);
  if (!startPrice || startPrice <= 0) {
    console.warn(`⚠️ Could not determine start price for ${benchmarkData.ticker}`);
    return [];
  }

  // Generate evenly spaced timestamps
  const timeStep = (endTimestamp - startTimestamp) / (numPoints - 1);
  const normalizedPoints: NormalizedBenchmarkPoint[] = [];

  for (let i = 0; i < numPoints; i++) {
    const timestamp = startTimestamp + (timeStep * i);
    const price = getPriceAtTimestamp(timestamp, priceHistory);

    if (price !== null) {
      const percentChange = ((price - startPrice) / startPrice) * 100;
      normalizedPoints.push({
        timestamp,
        percentChange,
      });
    }
  }

  return normalizedPoints;
};

/**
 * Legacy normalization function that aligns with provided timestamps
 * Kept for backward compatibility
 */
export const normalizeBenchmarkDataToTimestamps = (
  benchmarkData: BenchmarkData,
  chartTimestamps: number[]
): NormalizedBenchmarkPoint[] => {
  if (!benchmarkData.priceHistory.length || !chartTimestamps.length) {
    return [];
  }

  const priceHistory = benchmarkData.priceHistory;
  const chartStart = chartTimestamps[0];

  // Get the starting price
  const startPrice = getPriceAtTimestamp(chartStart, priceHistory);
  if (!startPrice || startPrice <= 0) {
    return [];
  }

  // Create normalized points for each chart timestamp using interpolation
  const normalizedPoints: NormalizedBenchmarkPoint[] = [];

  for (const chartTimestamp of chartTimestamps) {
    const price = getPriceAtTimestamp(chartTimestamp, priceHistory);

    if (price !== null) {
      const percentChange = ((price - startPrice) / startPrice) * 100;
      normalizedPoints.push({
        timestamp: chartTimestamp,
        percentChange,
      });
    }
  }

  return normalizedPoints;
};

/**
 * Prepare benchmark data for chart rendering
 * Returns data for all visible benchmarks, normalized with interpolation
 *
 * @param benchmarkDataMap - Map of ticker to benchmark data
 * @param benchmarkConfigs - Benchmark configurations (for visibility, color, etc.)
 * @param startTimestamp - Chart start timestamp
 * @param endTimestamp - Chart end timestamp
 * @param numPoints - Number of data points to generate (default: 150)
 */
export const prepareBenchmarksForChart = (
  benchmarkDataMap: Map<string, BenchmarkData>,
  benchmarkConfigs: BenchmarkConfig[],
  startTimestamp: number,
  endTimestamp: number,
  numPoints: number = INTERPOLATION_POINTS
): ChartBenchmarkData[] => {
  const chartBenchmarks: ChartBenchmarkData[] = [];

  for (const config of benchmarkConfigs) {
    if (!config.visible) continue;

    const data = benchmarkDataMap.get(config.ticker);
    if (!data) continue;

    // Use the new interpolation-based normalization
    const normalizedData = normalizeBenchmarkData(data, startTimestamp, endTimestamp, numPoints);

    if (normalizedData.length === 0) continue;

    // Calculate total return for the period (last point's percent change)
    const returnPercent = normalizedData.length > 0
      ? normalizedData[normalizedData.length - 1].percentChange
      : 0;

    chartBenchmarks.push({
      ticker: config.ticker,
      name: config.name,
      color: config.color,
      data: normalizedData,
      returnPercent,
    });
  }

  return chartBenchmarks;
};

/**
 * Create initial benchmark settings for a portfolio
 * All benchmarks are hidden by default
 */
export const createDefaultBenchmarkSettings = (): BenchmarkSettings => {
  return {
    benchmarks: DEFAULT_BENCHMARKS.map(b => ({
      ...b,
      visible: false,  // Hidden by default per user requirement
    })),
    maxVisibleBenchmarks: 3,
  };
};

/**
 * Add a custom benchmark to settings
 */
export const addCustomBenchmark = (
  settings: BenchmarkSettings,
  ticker: string,
  name: string
): BenchmarkSettings => {
  // Check if benchmark already exists
  if (settings.benchmarks.some(b => b.ticker.toUpperCase() === ticker.toUpperCase())) {
    console.warn(`Benchmark ${ticker} already exists`);
    return settings;
  }

  // Generate a color for the custom benchmark
  const customColors = ['#EC4899', '#06B6D4', '#84CC16', '#F43F5E', '#8B5CF6'];
  const customCount = settings.benchmarks.filter(b => b.isCustom).length;
  const color = customColors[customCount % customColors.length];

  return {
    ...settings,
    benchmarks: [
      ...settings.benchmarks,
      {
        ticker: ticker.toUpperCase(),
        name,
        color,
        visible: false,  // New benchmarks start hidden
        isCustom: true,
      },
    ],
  };
};

/**
 * Remove a custom benchmark from settings
 */
export const removeCustomBenchmark = (
  settings: BenchmarkSettings,
  ticker: string
): BenchmarkSettings => {
  return {
    ...settings,
    benchmarks: settings.benchmarks.filter(
      b => !(b.ticker.toUpperCase() === ticker.toUpperCase() && b.isCustom)
    ),
  };
};

/**
 * Toggle benchmark visibility
 * Respects maxVisibleBenchmarks limit
 */
export const toggleBenchmarkVisibility = (
  settings: BenchmarkSettings,
  ticker: string
): { settings: BenchmarkSettings; error?: string } => {
  const benchmarkIndex = settings.benchmarks.findIndex(
    b => b.ticker.toUpperCase() === ticker.toUpperCase()
  );

  if (benchmarkIndex === -1) {
    return { settings, error: `Benchmark ${ticker} not found` };
  }

  const benchmark = settings.benchmarks[benchmarkIndex];
  const currentVisibleCount = settings.benchmarks.filter(b => b.visible).length;

  // If turning on and at max, return error
  if (!benchmark.visible && currentVisibleCount >= settings.maxVisibleBenchmarks) {
    return {
      settings,
      error: `Maximum ${settings.maxVisibleBenchmarks} benchmarks can be visible at once. Turn off another benchmark first.`
    };
  }

  // Toggle visibility
  const updatedBenchmarks = [...settings.benchmarks];
  updatedBenchmarks[benchmarkIndex] = {
    ...benchmark,
    visible: !benchmark.visible,
  };

  return {
    settings: {
      ...settings,
      benchmarks: updatedBenchmarks,
    },
  };
};

/**
 * Validate if a ticker is a valid Yahoo Finance symbol
 * Returns the benchmark data if valid, null if invalid
 */
export const validateBenchmarkTicker = async (ticker: string): Promise<{
  valid: boolean;
  name?: string;
  error?: string;
}> => {
  try {
    // Use ALL timeRange for validation to get maximum data
    const data = await fetchBenchmarkData(ticker, ticker, 'ALL', true);

    if (data && data.priceHistory.length > 0) {
      return {
        valid: true,
        name: data.name,
      };
    }

    return {
      valid: false,
      error: `No data found for ticker "${ticker}". Make sure it's a valid Yahoo Finance symbol.`,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: `Failed to validate ticker: ${error.message}`,
    };
  }
};

/**
 * Clear all benchmark caches
 */
export const clearBenchmarkCache = (): void => {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(BENCHMARK_CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
  console.log(`🗑️ Cleared ${keysToRemove.length} benchmark caches`);
};
