import { distance } from 'fastest-levenshtein';
import { normalizeName } from './edgar-loader';

const FUZZY_THRESHOLD = 0.9;

export interface FuzzyMatch {
  name: string;
  ticker: string;
  similarity: number;
}

/** Calculate similarity ratio between two strings (0 to 1) */
export function similarity(a: string, b: string): number {
  const normA = normalizeName(a);
  const normB = normalizeName(b);
  if (normA === normB) return 1;
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;
  return 1 - distance(normA, normB) / maxLen;
}

/** Find the best fuzzy match from a map of normalized names to entries */
export function findBestFuzzyMatch(
  query: string,
  candidates: Map<string, { ticker: string }>,
): FuzzyMatch | null {
  const normalizedQuery = normalizeName(query);
  let best: FuzzyMatch | null = null;

  for (const [name, entry] of candidates) {
    const maxLen = Math.max(normalizedQuery.length, name.length);
    if (maxLen === 0) continue;
    const sim = 1 - distance(normalizedQuery, name) / maxLen;

    if (sim >= FUZZY_THRESHOLD && (best === null || sim > best.similarity)) {
      best = { name, ticker: entry.ticker, similarity: sim };
    }
  }

  return best;
}
