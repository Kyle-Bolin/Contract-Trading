/** A federal contract award record sourced from USAspending.gov. */
export interface ContractAward {
  awardId: string;
  awardDate: string; // ISO-8601 date
  recipientName: string;
  ticker: string | null; // mapped stock ticker, null if not publicly traded
  naicsCode: string;
  naicsDescription: string;
  awardAmount: number; // total obligation in USD
  fundingAgency: string;
  awardingAgency: string;
  description: string;
  placeOfPerformance: string;
  createdAt: string; // ISO-8601 timestamp
}

/** A company with its stock-ticker mapping, stored with normalized uppercase name. */
export interface Company {
  companyName: string; // normalized uppercase PK
  ticker: string | null;
  exchange: string | null;
  sector: string | null;
  aliases: string[]; // alternate names / DBA names
  updatedAt: string; // ISO-8601 timestamp
}

/** A single entry in a user's stock watchlist. */
export interface UserWatchlistEntry {
  userId: string;
  ticker: string;
  addedAt: string; // ISO-8601 timestamp
  notes: string | null;
}

/** A saved filter preset for a user's contract search. */
export interface UserFilter {
  userId: string;
  filterId: string;
  filterName: string;
  criteria: FilterCriteria;
  createdAt: string; // ISO-8601 timestamp
  updatedAt: string; // ISO-8601 timestamp
}

export interface FilterCriteria {
  naicsCodes?: string[];
  minAmount?: number;
  maxAmount?: number;
  agencies?: string[];
  tickers?: string[];
  keywords?: string[];
}

/** An alert delivered to a user when a contract matches their watchlist/filters. */
export interface Alert {
  userId: string;
  alertTimestamp: string; // ISO-8601 timestamp (SK)
  awardId: string;
  ticker: string;
  message: string;
  read: boolean;
  expiresAt: number; // Unix epoch seconds (TTL — 90 days from creation)
}

/** A directional trading signal generated from contract award data. */
export interface TradingSignal {
  signalId: string;
  ticker: string;
  direction: 'bullish' | 'bearish';
  confidence: number; // 0–1
  awardIds: string[]; // contributing award IDs
  reasoning: string;
  generatedAt: string; // ISO-8601 timestamp
}
