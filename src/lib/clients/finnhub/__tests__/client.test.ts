import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FinnhubClient } from "../client";
import { TokenBucketRateLimiter } from "../rate-limiter";
import { FinnhubError } from "../types";

const mockQuote = {
  c: 150.25,
  d: 2.5,
  dp: 1.69,
  h: 151.0,
  l: 148.5,
  o: 149.0,
  pc: 147.75,
  t: 1700000000,
};

const mockSymbolLookup = {
  count: 2,
  result: [
    { description: "Apple Inc", displaySymbol: "AAPL", symbol: "AAPL", type: "Common Stock" },
    { description: "Apple Hospitality REIT", displaySymbol: "APLE", symbol: "APLE", type: "REIT" },
  ],
};

const mockCompanyProfile = {
  country: "US",
  currency: "USD",
  exchange: "NASDAQ",
  finnhubIndustry: "Technology",
  ipo: "1980-12-12",
  logo: "https://example.com/logo.png",
  marketCapitalization: 2500000,
  name: "Apple Inc",
  phone: "1234567890",
  shareOutstanding: 15000,
  ticker: "AAPL",
  weburl: "https://apple.com",
};

const mockBasicFinancials = {
  metric: { "52WeekHigh": 180, "52WeekLow": 120, peBasicExclExtraTTM: 28.5 },
  metricType: "all",
  series: {},
};

describe("FinnhubClient", () => {
  let client: FinnhubClient;

  beforeEach(() => {
    client = new FinnhubClient("test-api-key");
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws if no API key is provided", () => {
    expect(() => new FinnhubClient("")).toThrow("Finnhub API key is required");
  });

  describe("getQuote", () => {
    it("returns quote data for a valid ticker", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockQuote), { status: 200 }),
      );

      const result = await client.getQuote("AAPL");

      expect(result).toEqual(mockQuote);
      expect(fetch).toHaveBeenCalledOnce();
      const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
      expect(url.pathname).toBe("/api/v1/quote");
      expect(url.searchParams.get("symbol")).toBe("AAPL");
      expect(url.searchParams.get("token")).toBe("test-api-key");
    });
  });

  describe("symbolLookup", () => {
    it("returns symbol lookup results", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockSymbolLookup), { status: 200 }),
      );

      const result = await client.symbolLookup("apple");

      expect(result).toEqual(mockSymbolLookup);
      expect(result.count).toBe(2);
      expect(result.result).toHaveLength(2);
      const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
      expect(url.pathname).toBe("/api/v1/search");
      expect(url.searchParams.get("q")).toBe("apple");
    });
  });

  describe("getCompanyProfile", () => {
    it("returns company profile data", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockCompanyProfile), { status: 200 }),
      );

      const result = await client.getCompanyProfile("AAPL");

      expect(result).toEqual(mockCompanyProfile);
      const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
      expect(url.pathname).toBe("/api/v1/stock/profile2");
      expect(url.searchParams.get("symbol")).toBe("AAPL");
    });
  });

  describe("getBasicFinancials", () => {
    it("returns basic financials data", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockBasicFinancials), { status: 200 }),
      );

      const result = await client.getBasicFinancials("AAPL");

      expect(result).toEqual(mockBasicFinancials);
      const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
      expect(url.pathname).toBe("/api/v1/stock/metric");
      expect(url.searchParams.get("symbol")).toBe("AAPL");
      expect(url.searchParams.get("metric")).toBe("all");
    });
  });

  describe("error handling", () => {
    it("throws FinnhubError on 401 unauthorized", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 }),
      );

      await expect(client.getQuote("AAPL")).rejects.toThrow(FinnhubError);
      await expect(
        client.getQuote("AAPL").catch((e: FinnhubError) => {
          throw e;
        }),
      ).rejects.toMatchObject({ statusCode: 401, message: "Invalid API key" });
    });

    it("does not retry on 401 errors", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response("Unauthorized", { status: 401 }),
      );

      await expect(client.getQuote("AAPL")).rejects.toThrow(FinnhubError);
      expect(fetch).toHaveBeenCalledOnce();
    });

    it("throws FinnhubError on non-OK response", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response("Not Found", { status: 404, statusText: "Not Found" }),
      );

      await expect(client.getQuote("INVALID")).rejects.toThrow(FinnhubError);
    });
  });

  describe("retry logic", () => {
    it("retries on 429 rate limit with exponential backoff", async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response("", { status: 429 }))
        .mockResolvedValueOnce(new Response("", { status: 429 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockQuote), { status: 200 }));

      const result = await client.getQuote("AAPL");

      expect(result).toEqual(mockQuote);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("throws after exhausting all retries on 429", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("", { status: 429 }));

      await expect(client.getQuote("AAPL")).rejects.toThrow(FinnhubError);
      // 1 initial + 3 retries = 4 total calls
      expect(fetch).toHaveBeenCalledTimes(4);
    });

    it("retries on network errors", async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockQuote), { status: 200 }));

      const result = await client.getQuote("AAPL");

      expect(result).toEqual(mockQuote);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});

describe("TokenBucketRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the token limit", async () => {
    const limiter = new TokenBucketRateLimiter(3, 1);

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    // All three should resolve immediately without waiting
  });

  it("blocks when tokens are exhausted", async () => {
    const limiter = new TokenBucketRateLimiter(1, 1);

    await limiter.acquire(); // Uses the 1 token

    const acquirePromise = limiter.acquire();
    // Advance time by 1 second to refill
    vi.advanceTimersByTime(1000);
    await acquirePromise;
  });

  it("refills tokens over time", async () => {
    const limiter = new TokenBucketRateLimiter(2, 1);

    await limiter.acquire();
    await limiter.acquire();
    // All tokens used

    // Advance time so tokens refill
    vi.advanceTimersByTime(2000);

    // Should be able to acquire again
    await limiter.acquire();
    await limiter.acquire();
  });

  it("does not exceed max tokens on refill", async () => {
    const limiter = new TokenBucketRateLimiter(2, 1);

    // Wait a long time - should not accumulate more than maxTokens
    vi.advanceTimersByTime(10000);

    await limiter.acquire();
    await limiter.acquire();
    // Third acquire should block since max is 2
    const acquirePromise = limiter.acquire();
    vi.advanceTimersByTime(1000);
    await acquirePromise;
  });
});
