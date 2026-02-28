import type { TickerResult } from './types';
import { loadEdgarData, normalizeName } from './edgar-loader';
import { findBestFuzzyMatch } from './fuzzy-matcher';
import { getManualOverride } from './manual-overrides';

/** Resolve a company name to a stock ticker using layered lookup */
export async function resolveTicker(companyName: string): Promise<TickerResult> {
  // Layer 1: Manual overrides (exact match on normalized name)
  const manual = getManualOverride(companyName);
  if (manual) {
    return {
      ticker: manual.ticker,
      exchange: manual.exchange,
      confidence: 1.0,
      source: 'manual',
      isPubliclyTraded: true,
    };
  }

  // Layer 2: SEC EDGAR exact match
  const edgarData = await loadEdgarData();
  const normalized = normalizeName(companyName);
  const edgarMatch = edgarData.get(normalized);
  if (edgarMatch) {
    return {
      ticker: edgarMatch.ticker,
      exchange: null,
      confidence: 0.95,
      source: 'edgar',
      isPubliclyTraded: true,
    };
  }

  // Layer 3: Fuzzy match against EDGAR data (>= 90% similarity)
  const fuzzyMatch = findBestFuzzyMatch(companyName, edgarData);
  if (fuzzyMatch) {
    return {
      ticker: fuzzyMatch.ticker,
      exchange: null,
      confidence: fuzzyMatch.similarity,
      source: 'fuzzy',
      isPubliclyTraded: true,
    };
  }

  // Layer 4: Finnhub search fallback
  try {
    const finnhubResult = await finnhubSearch(companyName);
    if (finnhubResult) {
      return finnhubResult;
    }
  } catch {
    // Finnhub unavailable, continue to fallback
  }

  // No match found
  return {
    ticker: null,
    exchange: null,
    confidence: 0,
    source: 'manual',
    isPubliclyTraded: false,
  };
}

/** Attempt Finnhub symbol search. Returns null if client is unavailable or no match found. */
async function finnhubSearch(companyName: string): Promise<TickerResult | null> {
  try {
    // Try to dynamically import the Finnhub client if available
    const { searchSymbols } = await import('@/lib/clients/finnhub');
    const results = await searchSymbols(companyName);
    if (results && results.length > 0) {
      const top = results[0];
      return {
        ticker: top.symbol,
        exchange: top.exchange ?? null,
        confidence: 0.8,
        source: 'finnhub',
        isPubliclyTraded: true,
      };
    }
  } catch {
    // Finnhub client not available yet
  }
  return null;
}
