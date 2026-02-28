export interface QuoteResponse {
  /** Current price */
  c: number;
  /** Change */
  d: number;
  /** Percent change */
  dp: number;
  /** High price of the day */
  h: number;
  /** Low price of the day */
  l: number;
  /** Open price of the day */
  o: number;
  /** Previous close price */
  pc: number;
  /** Timestamp */
  t: number;
}

export interface SymbolLookupResult {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

export interface SymbolLookupResponse {
  count: number;
  result: SymbolLookupResult[];
}

export interface CompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  finnhubIndustry: string;
  ipo: string;
  logo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
}

export interface BasicFinancials {
  metric: Record<string, number>;
  metricType: string;
  series: Record<string, unknown>;
}

export class FinnhubError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "FinnhubError";
    this.statusCode = statusCode;
  }
}
