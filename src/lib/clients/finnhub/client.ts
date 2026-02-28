import {
  QuoteResponse,
  SymbolLookupResponse,
  CompanyProfile,
  BasicFinancials,
  FinnhubError,
} from "./types";
import { TokenBucketRateLimiter } from "./rate-limiter";

const BASE_URL = "https://finnhub.io/api/v1";
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

export class FinnhubClient {
  private readonly apiKey: string;
  private readonly rateLimiter: TokenBucketRateLimiter;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Finnhub API key is required");
    }
    this.apiKey = apiKey;
    this.rateLimiter = new TokenBucketRateLimiter();
  }

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    await this.rateLimiter.acquire();

    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.set("token", this.apiKey);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }

      try {
        const response = await fetch(url.toString());

        if (response.status === 401) {
          throw new FinnhubError(401, "Invalid API key");
        }

        if (response.status === 429) {
          lastError = new FinnhubError(429, "Rate limit exceeded");
          continue;
        }

        if (!response.ok) {
          throw new FinnhubError(response.status, `Finnhub API error: ${response.statusText}`);
        }

        const data = (await response.json()) as T;
        return data;
      } catch (error) {
        if (error instanceof FinnhubError && error.statusCode !== 429) {
          throw error;
        }
        lastError = error as Error;
      }
    }

    throw lastError ?? new FinnhubError(500, "Request failed after retries");
  }

  async getQuote(ticker: string): Promise<QuoteResponse> {
    return this.request<QuoteResponse>("/quote", { symbol: ticker });
  }

  async symbolLookup(query: string): Promise<SymbolLookupResponse> {
    return this.request<SymbolLookupResponse>("/search", { q: query });
  }

  async getCompanyProfile(ticker: string): Promise<CompanyProfile> {
    return this.request<CompanyProfile>("/stock/profile2", { symbol: ticker });
  }

  async getBasicFinancials(ticker: string): Promise<BasicFinancials> {
    return this.request<BasicFinancials>("/stock/metric", {
      symbol: ticker,
      metric: "all",
    });
  }
}
