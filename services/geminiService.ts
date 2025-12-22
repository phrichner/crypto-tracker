import { GoogleGenAI } from "@google/genai";
import { SourceLink } from "../types";

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface PriceResult {
  price: number;
  sources: SourceLink[];
  rawText: string;
  name?: string;
  symbol?: string;
}

const isContractAddress = (input: string): boolean => {
  return input.startsWith('0x') && input.length >= 40;
};

export const fetchTokenPriceFromDex = async (contractAddress: string): Promise<PriceResult> => {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`);
    if (!res.ok) throw new Error('DEXScreener API failed');
    
    const data = await res.json();
    
    console.log('DEXScreener response:', data); // Debug log
    
    if (!data.pairs || data.pairs.length === 0) {
      throw new Error('No trading pairs found for this token');
    }
    
    // Sort by FDV (fully diluted valuation) and liquidity - prefer higher values
    const sortedPairs = data.pairs
      .filter((pair: any) => {
        const hasPrice = pair.priceUsd && parseFloat(pair.priceUsd) > 0;
        console.log('Pair:', pair.baseToken?.symbol, 'Price:', pair.priceUsd, 'Liquidity:', pair.liquidity, 'FDV:', pair.fdv);
        return hasPrice;
      })
      .sort((a: any, b: any) => {
        // Prefer pairs with higher liquidity
        const liquidityA = parseFloat(a.liquidity?.usd || 0);
        const liquidityB = parseFloat(b.liquidity?.usd || 0);
        return liquidityB - liquidityA;
      });
    
    if (sortedPairs.length === 0) {
      throw new Error('No valid trading pairs with price data found');
    }
    
    const bestPair = sortedPairs[0];
    const price = parseFloat(bestPair.priceUsd);
    
    console.log('Selected pair:', bestPair.baseToken?.symbol, 'on', bestPair.dexId, 'Price:', price);
    
    if (isNaN(price) || price <= 0) {
      throw new Error('Invalid price data from DEXScreener');
    }
    
    const tokenName = bestPair.baseToken?.name || 'Unknown Token';
    const tokenSymbol = bestPair.baseToken?.symbol || contractAddress.slice(0, 8);
    
    return {
      price,
      name: tokenName,
      symbol: tokenSymbol,
      sources: [{
        title: `${bestPair.dexId} (${bestPair.chainId}) - Liquidity: $${(parseFloat(bestPair.liquidity?.usd || 0) / 1000000).toFixed(2)}M`,
        url: bestPair.url || `https://dexscreener.com/${bestPair.chainId}/${bestPair.pairAddress}`
      }],
      rawText: `${tokenName} (${tokenSymbol}) - $${price.toFixed(8)} from ${bestPair.dexId} on ${bestPair.chainId}`
    };
  } catch (error: any) {
    console.error('DEXScreener error:', error);
    throw new Error(error.message || "Failed to fetch price from DEXScreener");
  }
};

export const fetchCryptoPrice = async (ticker: string): Promise<PriceResult> => {
  if (isContractAddress(ticker)) {
    return fetchTokenPriceFromDex(ticker);
  }
  
  try {
    const apiKey = localStorage.getItem('gemini_api_key') || '';
    
    if (!apiKey) {
      throw new Error("API key not configured. Please add your API key in settings.");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `Find the current live market price of the '${ticker}' cryptocurrency token in USD from a reliable source like CoinGecko, CoinMarketCap, or DEXScreener. 
For tokens on Ethereum, verify the contract address if needed.
Return ONLY the current numeric price value in USD. No symbols, no explanations.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    const cleanText = text.replace(/[$,]/g, '').trim();
    const priceMatch = cleanText.match(/[\d]*[.]{0,1}[\d]+/);
    
    let price = priceMatch ? parseFloat(priceMatch[0]) : 0;
    
    if (price <= 0) {
      throw new Error("Could not extract valid price from AI response");
    }
    
    const sources: SourceLink[] = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
      .filter(c => c.web && c.web.uri)
      .map(c => ({ title: c.web.title || 'Source', url: c.web.uri }));

    return { price, sources, rawText: text };
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch price");
  }
};

export const fetchAssetHistory = async (ticker: string): Promise<number[][] | undefined> => {
  if (isContractAddress(ticker)) {
    return undefined;
  }
  
  try {
     const res = await fetch(`https://min-api.cryptocompare.com/data/v2/histoday?fsym=${ticker.toUpperCase()}&tsym=USD&limit=2000`);
     if (res.ok) {
        const json = await res.json();
        if (json.Response === 'Success') {
           return json.Data.Data.map((d: any) => [d.time * 1000, d.close]).filter((p: any) => p[1] > 0);
        }
     }
  } catch (e) { console.warn(e); }
  return undefined;
};