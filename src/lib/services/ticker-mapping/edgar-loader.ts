import type { EdgarCompanyEntry } from './types';

export interface EdgarEntry {
  ticker: string;
  cik: string;
}

/** Normalize a company name for matching: uppercase, strip suffixes, punctuation, extra spaces */
export function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\b(INC|CORP|CORPORATION|LLC|LTD|LIMITED|CO|COMPANY|GROUP|HOLDINGS|PLC|LP|NV|SA|AG)\b/g, '')
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

let edgarMap: Map<string, EdgarEntry> | null = null;

/** Fetch and parse SEC EDGAR company tickers into a normalized name -> {ticker, cik} map */
export async function loadEdgarData(): Promise<Map<string, EdgarEntry>> {
  if (edgarMap) return edgarMap;

  const response = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': 'ContractTrading/1.0' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch EDGAR data: ${response.status} ${response.statusText}`);
  }

  const data: Record<string, EdgarCompanyEntry> = await response.json();

  edgarMap = new Map<string, EdgarEntry>();

  for (const entry of Object.values(data)) {
    const normalized = normalizeName(entry.title);
    edgarMap.set(normalized, {
      ticker: entry.ticker.toUpperCase(),
      cik: String(entry.cik_str),
    });
  }

  return edgarMap;
}

/** Reset cached EDGAR data (useful for testing) */
export function resetEdgarCache(): void {
  edgarMap = null;
}
