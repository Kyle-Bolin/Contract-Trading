import type { CompanyProfile } from '@/lib/clients/finnhub/types';

export interface TradingSignal {
  ticker: string;
  signal: 'buy' | 'hold' | 'neutral';
  confidence: 'strong' | 'moderate' | 'weak';
  factors: SignalFactors;
  disclaimer: string;
}

export interface SignalFactors {
  awardToMarketCapRatio: number;
  awardAmount: number;
  marketCap: number;
  recentAwardCount30d: number;
  recentAwardTotal30d: number;
  pipelineMomentum: 'increasing' | 'stable' | 'decreasing';
}

export interface SignalConfig {
  /** Ratio threshold for a strong buy signal (default: 0.05 = 5%) */
  strongRatioThreshold: number;
  /** Ratio threshold for a moderate buy signal (default: 0.01 = 1%) */
  moderateRatioThreshold: number;
  /** Window in days for momentum calculation (default: 30) */
  momentumWindow: number;
}

export interface AwardInput {
  awardAmount: number;
  recipientName: string;
  awardDate: string;
}

export { CompanyProfile };
