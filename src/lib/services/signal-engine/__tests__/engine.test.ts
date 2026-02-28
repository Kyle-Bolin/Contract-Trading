import { describe, it, expect } from 'vitest';
import { generateSignal } from '../engine';
import type { CompanyProfile } from '@/lib/clients/finnhub/types';
import type { AwardInput, SignalConfig } from '../types';

const DISCLAIMER =
  'This is an informational signal only and does not constitute financial advice. ' +
  'Past contract awards do not guarantee future stock performance. ' +
  'Always conduct your own research before making investment decisions.';

function makeProfile(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    country: 'US',
    currency: 'USD',
    exchange: 'NYSE',
    finnhubIndustry: 'Aerospace & Defense',
    ipo: '2000-01-01',
    logo: '',
    marketCapitalization: 5000, // $5B (in millions)
    name: 'Test Corp',
    phone: '',
    shareOutstanding: 100,
    ticker: 'TEST',
    weburl: '',
    ...overrides,
  };
}

function makeAward(overrides: Partial<AwardInput> = {}): AwardInput {
  return {
    awardAmount: 100_000_000, // $100M
    recipientName: 'Test Corp',
    awardDate: new Date().toISOString(),
    ...overrides,
  };
}

function makeRecentAwards(count: number, amountEach: number, daysAgo: number): AwardInput[] {
  const awards: AwardInput[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo + i);
    awards.push({
      awardAmount: amountEach,
      recipientName: 'Test Corp',
      awardDate: date.toISOString(),
    });
  }
  return awards;
}

const defaultConfig: SignalConfig = {
  strongRatioThreshold: 0.05,
  moderateRatioThreshold: 0.01,
  momentumWindow: 30,
};

describe('generateSignal', () => {
  it('should return buy + strong for large award to small-cap company', () => {
    // $500M award to $2B market cap company → ratio = 0.25 (25%) > 5% threshold
    const award = makeAward({ awardAmount: 500_000_000 });
    const profile = makeProfile({ marketCapitalization: 2000, ticker: 'SMCAP' });

    const result = generateSignal(award, profile, [], defaultConfig);

    expect(result.signal).toBe('buy');
    expect(result.confidence).toBe('strong');
    expect(result.ticker).toBe('SMCAP');
    expect(result.factors.awardToMarketCapRatio).toBeCloseTo(0.25);
    expect(result.disclaimer).toBe(DISCLAIMER);
  });

  it('should return neutral + weak for small award to mega-cap company', () => {
    // $10M award to $2T market cap company → ratio = 0.000005 (0.0005%) < 1% threshold
    const award = makeAward({ awardAmount: 10_000_000 });
    const profile = makeProfile({ marketCapitalization: 2_000_000, ticker: 'MEGA' });

    const result = generateSignal(award, profile, [], defaultConfig);

    expect(result.signal).toBe('neutral');
    expect(result.confidence).toBe('weak');
    expect(result.ticker).toBe('MEGA');
    expect(result.factors.awardToMarketCapRatio).toBeLessThan(0.01);
  });

  it('should return buy + moderate with strong pipeline momentum upgrading to strong', () => {
    // $100M award to $5B market cap → ratio = 0.02 (2%) → moderate buy
    // With increasing momentum → upgrades to strong
    const award = makeAward({ awardAmount: 100_000_000 });
    const profile = makeProfile({ marketCapitalization: 5000, ticker: 'MID' });

    // Recent 30d: many awards; prior 30d: none → increasing momentum
    const recentAwards = makeRecentAwards(5, 50_000_000, 15);

    const result = generateSignal(award, profile, recentAwards, defaultConfig);

    expect(result.signal).toBe('buy');
    expect(result.confidence).toBe('strong');
    expect(result.factors.pipelineMomentum).toBe('increasing');
    expect(result.factors.recentAwardCount30d).toBe(5);
  });

  it('should return neutral + weak for private company (null profile)', () => {
    const award = makeAward({ awardAmount: 100_000_000 });

    const result = generateSignal(award, null, [], defaultConfig);

    expect(result.signal).toBe('neutral');
    expect(result.confidence).toBe('weak');
    expect(result.ticker).toBe('N/A');
    expect(result.factors.marketCap).toBe(0);
    expect(result.factors.awardToMarketCapRatio).toBe(0);
  });

  it('should return neutral + weak for zero market cap edge case', () => {
    const award = makeAward({ awardAmount: 100_000_000 });
    const profile = makeProfile({ marketCapitalization: 0, ticker: 'ZERO' });

    const result = generateSignal(award, profile, [], defaultConfig);

    expect(result.signal).toBe('neutral');
    expect(result.confidence).toBe('weak');
    expect(result.factors.marketCap).toBe(0);
    expect(result.factors.awardToMarketCapRatio).toBe(0);
  });

  it('should always include the disclaimer', () => {
    const award = makeAward();
    const profile = makeProfile();

    const result1 = generateSignal(award, profile, [], defaultConfig);
    expect(result1.disclaimer).toBe(DISCLAIMER);

    const result2 = generateSignal(award, null, [], defaultConfig);
    expect(result2.disclaimer).toBe(DISCLAIMER);
  });

  it('should calculate decreasing momentum when prior period had more awards', () => {
    const award = makeAward({ awardAmount: 100_000_000 });
    const profile = makeProfile({ marketCapitalization: 5000, ticker: 'DEC' });

    // Awards only in the prior 30d window (31-60 days ago), none in recent 30d
    const priorAwards = makeRecentAwards(5, 50_000_000, 45);

    const result = generateSignal(award, profile, priorAwards, defaultConfig);

    expect(result.factors.pipelineMomentum).toBe('decreasing');
  });

  it('should downgrade strong confidence to moderate when momentum is decreasing', () => {
    // $500M award to $2B market cap → ratio = 0.25 (25%) > 5% → strong buy
    // But with decreasing momentum → downgrade to moderate
    const award = makeAward({ awardAmount: 500_000_000 });
    const profile = makeProfile({ marketCapitalization: 2000, ticker: 'DOWN' });

    // Awards only in prior period, none in recent → decreasing momentum
    const priorAwards = makeRecentAwards(5, 100_000_000, 45);

    const result = generateSignal(award, profile, priorAwards, defaultConfig);

    expect(result.signal).toBe('buy');
    expect(result.confidence).toBe('moderate');
    expect(result.factors.pipelineMomentum).toBe('decreasing');
  });

  it('should handle negative market cap as not publicly traded', () => {
    const award = makeAward({ awardAmount: 100_000_000 });
    const profile = makeProfile({ marketCapitalization: -100, ticker: 'NEG' });

    const result = generateSignal(award, profile, [], defaultConfig);

    expect(result.signal).toBe('neutral');
    expect(result.confidence).toBe('weak');
  });
});
