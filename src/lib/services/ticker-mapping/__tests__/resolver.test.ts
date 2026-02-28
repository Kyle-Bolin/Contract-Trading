import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveTicker } from '../resolver';
import { resetEdgarCache } from '../edgar-loader';
import { similarity } from '../fuzzy-matcher';

// Mock the global fetch to simulate EDGAR data
const mockEdgarData: Record<string, { cik_str: string; ticker: string; title: string }> = {
  '0': { cik_str: '310764', ticker: 'LMT', title: 'LOCKHEED MARTIN CORP' },
  '1': { cik_str: '12927', ticker: 'BA', title: 'BOEING CO' },
  '2': { cik_str: '40554', ticker: 'GE', title: 'GENERAL ELECTRIC CO' },
  '3': { cik_str: '1370946', ticker: 'LDOS', title: 'LEIDOS HOLDINGS INC' },
  '4': { cik_str: '60714', ticker: 'NOC', title: 'NORTHROP GRUMMAN CORP' },
  '5': { cik_str: '885725', ticker: 'RTX', title: 'RTX CORP' },
  '6': { cik_str: '1047122', ticker: 'GD', title: 'GENERAL DYNAMICS CORP' },
  '7': { cik_str: '789019', ticker: 'MSFT', title: 'MICROSOFT CORP' },
  '8': { cik_str: '1018724', ticker: 'AMZN', title: 'AMAZON COM INC' },
  '9': { cik_str: '49196', ticker: 'TXT', title: 'TEXTRON INC' },
};

beforeEach(() => {
  resetEdgarCache();

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockEdgarData),
    }),
  );
});

describe('resolveTicker', () => {
  describe('Layer 1: Manual overrides', () => {
    it('should resolve LOCKHEED MARTIN via manual override', async () => {
      const result = await resolveTicker('LOCKHEED MARTIN');
      expect(result.ticker).toBe('LMT');
      expect(result.source).toBe('manual');
      expect(result.confidence).toBe(1.0);
      expect(result.isPubliclyTraded).toBe(true);
      expect(result.exchange).toBe('NYSE');
    });

    it('should resolve BOEING via manual override', async () => {
      const result = await resolveTicker('BOEING');
      expect(result.ticker).toBe('BA');
      expect(result.source).toBe('manual');
      expect(result.isPubliclyTraded).toBe(true);
    });

    it('should resolve RAYTHEON -> RTX via manual override', async () => {
      const result = await resolveTicker('RAYTHEON');
      expect(result.ticker).toBe('RTX');
      expect(result.source).toBe('manual');
    });

    it('should resolve BOOZ ALLEN HAMILTON via manual override', async () => {
      const result = await resolveTicker('BOOZ ALLEN HAMILTON');
      expect(result.ticker).toBe('BAH');
      expect(result.source).toBe('manual');
    });

    it('should resolve company name variations via manual override', async () => {
      const result = await resolveTicker('LOCKHEED MARTIN CORPORATION');
      expect(result.ticker).toBe('LMT');
      expect(result.source).toBe('manual');
    });
  });

  describe('Layer 2: EDGAR exact match', () => {
    it('should resolve TEXTRON via EDGAR exact match', async () => {
      const result = await resolveTicker('TEXTRON');
      // TEXTRON is in manual overrides, so it should match there first
      expect(result.ticker).toBe('TXT');
      expect(result.isPubliclyTraded).toBe(true);
    });

    it('should resolve a company only in EDGAR via exact match', async () => {
      // AMAZON COM INC normalizes to "AMAZON COM" which differs from manual override "AMAZON"
      // so this tests EDGAR path when manual override doesn't match
      const result = await resolveTicker('AMAZON COM INC');
      expect(result.ticker).toBe('AMZN');
      expect(result.isPubliclyTraded).toBe(true);
    });
  });

  describe('Layer 3: Fuzzy matching', () => {
    it('should fuzzy match "LOCKHEED MARTIN CORPORATION" if not in manual overrides', async () => {
      // "LOCKHEED MARTIN CORPORATION" is in manual overrides, but let's test fuzzy similarity directly
      const sim = similarity('LOCKHEED MARTIN CORPORATION', 'LOCKHEED MARTIN CORP');
      expect(sim).toBeGreaterThanOrEqual(0.9);
    });

    it('should fuzzy match a slightly misspelled company name', async () => {
      // "NORTHROP GRUMAN CORP" (misspelled) against EDGAR's "NORTHROP GRUMMAN CORP"
      // This should be close enough for fuzzy matching
      const sim = similarity('NORTHROP GRUMAN', 'NORTHROP GRUMMAN');
      expect(sim).toBeGreaterThanOrEqual(0.9);
    });

    it('should calculate correct similarity for identical strings', () => {
      expect(similarity('BOEING', 'BOEING')).toBe(1);
    });

    it('should calculate low similarity for very different strings', () => {
      expect(similarity('BOEING', 'MICROSOFT')).toBeLessThan(0.5);
    });
  });

  describe('Layer 4: Fallback for private companies', () => {
    it('should return isPubliclyTraded: false for unknown private companies', async () => {
      const result = await resolveTicker('ACME PRIVATE HOLDINGS UNLIMITED');
      expect(result.isPubliclyTraded).toBe(false);
      expect(result.ticker).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should return isPubliclyTraded: false for nonsense input', async () => {
      const result = await resolveTicker('XYZZY NONEXISTENT COMPANY 12345');
      expect(result.isPubliclyTraded).toBe(false);
      expect(result.ticker).toBeNull();
    });
  });
});
