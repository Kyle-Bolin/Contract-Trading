export interface TickerResult {
  ticker: string | null;
  exchange: string | null;
  confidence: number;
  source: 'edgar' | 'finnhub' | 'manual' | 'fuzzy';
  isPubliclyTraded: boolean;
}

export interface EdgarCompanyEntry {
  cik_str: string;
  ticker: string;
  title: string;
}

export interface ManualOverrideEntry {
  companyName: string;
  ticker: string;
  exchange: string;
}
