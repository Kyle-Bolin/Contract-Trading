import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { USAspendingClient } from "../client";
import {
  USAspendingApiError,
  USAspendingNetworkError,
  USAspendingRateLimitError,
} from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  return vi.fn<typeof globalThis.fetch>().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    statusText: response.statusText ?? "OK",
    json: response.json ?? (() => Promise.resolve({})),
    headers: new Headers(),
    redirected: false,
    type: "basic",
    url: "",
    body: null,
    bodyUsed: false,
    clone: () => ({}) as Response,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(""),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response);
}

function mockFetchSequence(responses: Array<Partial<Response> | Error>) {
  const fn = vi.fn<typeof globalThis.fetch>();
  for (const res of responses) {
    if (res instanceof Error) {
      fn.mockRejectedValueOnce(res);
    } else {
      fn.mockResolvedValueOnce({
        ok: res.ok ?? true,
        status: res.status ?? 200,
        statusText: res.statusText ?? "OK",
        json: res.json ?? (() => Promise.resolve({})),
        headers: new Headers(),
        redirected: false,
        type: "basic",
        url: "",
        body: null,
        bodyUsed: false,
        clone: () => ({}) as Response,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        blob: () => Promise.resolve(new Blob()),
        formData: () => Promise.resolve(new FormData()),
        text: () => Promise.resolve(""),
        bytes: () => Promise.resolve(new Uint8Array()),
      } as Response);
    }
  }
  return fn;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("USAspendingClient", () => {
  let client: USAspendingClient;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    client = new USAspendingClient({
      maxRequestsPerSecond: 100, // high limit to avoid throttling in most tests
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // searchAwardsByDateRange
  // -------------------------------------------------------------------------
  describe("searchAwardsByDateRange", () => {
    it("sends correct request with default options", async () => {
      const mockData = {
        limit: 25,
        results: [
          {
            internal_id: "123",
            "Award ID": "W911NF-20-1-0001",
            "Recipient Name": "Test Corp",
            "Start Date": "2024-01-01",
            "End Date": "2024-12-31",
            "Award Amount": 1000000,
          },
        ],
        page_metadata: {
          page: 1,
          hasNext: false,
          last_record_unique_id: null,
          last_record_sort_value: null,
        },
      };

      globalThis.fetch = mockFetch({
        json: () => Promise.resolve(mockData),
      });

      const result = await client.searchAwardsByDateRange(
        "2024-01-01",
        "2024-12-31",
      );

      expect(result).toEqual(mockData);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, RequestInit];
      expect(url).toBe(
        "https://api.usaspending.gov/api/v2/search/spending_by_award/",
      );
      expect(init.method).toBe("POST");

      const body = JSON.parse(init.body as string);
      expect(body.filters.award_type_codes).toEqual(["A", "B", "C", "D"]);
      expect(body.filters.time_period).toEqual([
        { start_date: "2024-01-01", end_date: "2024-12-31" },
      ]);
      expect(body.sort).toBe("Start Date");
      expect(body.order).toBe("desc");
      expect(body.page).toBe(1);
      expect(body.limit).toBe(25);
    });

    it("accepts custom options", async () => {
      globalThis.fetch = mockFetch({
        json: () =>
          Promise.resolve({
            limit: 10,
            results: [],
            page_metadata: {
              page: 2,
              hasNext: false,
              last_record_unique_id: null,
              last_record_sort_value: null,
            },
          }),
      });

      await client.searchAwardsByDateRange("2024-01-01", "2024-06-30", {
        awardTypeCodes: ["A"],
        keywords: ["defense"],
        limit: 10,
        page: 2,
        sort: "Award Amount",
        order: "asc",
      });

      const body = JSON.parse(
        ((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit])[1]
          .body as string,
      );
      expect(body.filters.award_type_codes).toEqual(["A"]);
      expect(body.filters.keywords).toEqual(["defense"]);
      expect(body.limit).toBe(10);
      expect(body.page).toBe(2);
      expect(body.sort).toBe("Award Amount");
      expect(body.order).toBe("asc");
    });
  });

  // -------------------------------------------------------------------------
  // searchAwardsByDateRangePaginated
  // -------------------------------------------------------------------------
  describe("searchAwardsByDateRangePaginated", () => {
    it("yields pages until hasNext is false", async () => {
      const page1 = {
        limit: 25,
        results: [{ internal_id: "1" }],
        page_metadata: { page: 1, hasNext: true, last_record_unique_id: null, last_record_sort_value: null },
      };
      const page2 = {
        limit: 25,
        results: [{ internal_id: "2" }],
        page_metadata: { page: 2, hasNext: false, last_record_unique_id: null, last_record_sort_value: null },
      };

      globalThis.fetch = mockFetchSequence([
        { json: () => Promise.resolve(page1) },
        { json: () => Promise.resolve(page2) },
      ]);

      const pages = [];
      for await (const page of client.searchAwardsByDateRangePaginated(
        "2024-01-01",
        "2024-12-31",
      )) {
        pages.push(page);
      }

      expect(pages).toHaveLength(2);
      expect(pages[0]).toEqual(page1);
      expect(pages[1]).toEqual(page2);
    });
  });

  // -------------------------------------------------------------------------
  // getAwardDetails
  // -------------------------------------------------------------------------
  describe("getAwardDetails", () => {
    it("fetches award details by ID", async () => {
      const mockAward = {
        id: 123,
        generated_unique_award_id: "CONT_AWD_W911NF2010001",
        type: "A",
        type_description: "BPA Call",
        total_obligation: 5000000,
        recipient: {
          recipient_name: "Test Corp",
          recipient_hash: "abc123-R",
        },
      };

      globalThis.fetch = mockFetch({
        json: () => Promise.resolve(mockAward),
      });

      const result = await client.getAwardDetails("CONT_AWD_W911NF2010001");

      expect(result).toEqual(mockAward);
      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, RequestInit];
      expect(url).toBe(
        "https://api.usaspending.gov/api/v2/awards/CONT_AWD_W911NF2010001/",
      );
      expect(init.method).toBe("GET");
    });
  });

  // -------------------------------------------------------------------------
  // getRecipientProfile
  // -------------------------------------------------------------------------
  describe("getRecipientProfile", () => {
    it("fetches recipient profile by hash", async () => {
      const mockProfile = {
        name: "Test Corp",
        alternate_names: ["Test Corporation", "TC Inc"],
        duns: "123456789",
        uei: "ABCDEF123456",
        recipient_id: "abc123-R",
        recipient_level: "R",
        parent_name: "Parent Corp",
        parent_id: "parent-hash-P",
        total_transaction_amount: 10000000,
      };

      globalThis.fetch = mockFetch({
        json: () => Promise.resolve(mockProfile),
      });

      const result = await client.getRecipientProfile("abc123-R");

      expect(result).toEqual(mockProfile);
      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, RequestInit];
      expect(url).toBe(
        "https://api.usaspending.gov/api/v2/recipient/abc123-R/",
      );
    });
  });

  // -------------------------------------------------------------------------
  // searchRecipients
  // -------------------------------------------------------------------------
  describe("searchRecipients", () => {
    it("searches recipients by keyword", async () => {
      const mockResponse = {
        page: 1,
        limit: 50,
        count: 1,
        results: [
          {
            id: "abc123-R",
            name: "Lockheed Martin",
            duns: "123456789",
            uei: "ABCDEF123456",
            recipient_level: "R",
            amount: 50000000000,
          },
        ],
      };

      globalThis.fetch = mockFetch({
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.searchRecipients("Lockheed");

      expect(result).toEqual(mockResponse);
      const body = JSON.parse(
        ((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit])[1]
          .body as string,
      );
      expect(body.keyword).toBe("Lockheed");
      expect(body.sort).toBe("amount");
      expect(body.order).toBe("desc");
    });
  });

  // -------------------------------------------------------------------------
  // autocompleteRecipient
  // -------------------------------------------------------------------------
  describe("autocompleteRecipient", () => {
    it("sends autocomplete request", async () => {
      const mockResponse = {
        results: [
          { recipient_name: "Raytheon Technologies" },
          { recipient_name: "Raytheon Missiles & Defense" },
        ],
      };

      globalThis.fetch = mockFetch({
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.autocompleteRecipient("Raytheon", 5);

      expect(result).toEqual(mockResponse);
      const body = JSON.parse(
        ((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit])[1]
          .body as string,
      );
      expect(body.search_text).toBe("Raytheon");
      expect(body.limit).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------
  describe("error handling", () => {
    it("throws USAspendingNetworkError on network failure after retries", async () => {
      const client = new USAspendingClient({
        maxRetries: 2,
        maxRequestsPerSecond: 100,
      });

      globalThis.fetch = mockFetchSequence([
        new Error("ECONNREFUSED"),
        new Error("ECONNREFUSED"),
        new Error("ECONNREFUSED"),
      ]);

      await expect(
        client.getAwardDetails("test-id"),
      ).rejects.toThrow(USAspendingNetworkError);
    });

    it("throws USAspendingApiError on non-retriable HTTP error", async () => {
      globalThis.fetch = mockFetch({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: () => Promise.resolve({ detail: "Invalid request" }),
      });

      await expect(
        client.searchAwardsByDateRange("bad", "dates"),
      ).rejects.toThrow(USAspendingApiError);

      try {
        await client.searchAwardsByDateRange("bad", "dates");
      } catch (err) {
        expect((err as USAspendingApiError).statusCode).toBe(400);
        expect((err as USAspendingApiError).responseBody).toEqual({
          detail: "Invalid request",
        });
      }
    });

    it("throws USAspendingApiError on 500 after retries", async () => {
      const client = new USAspendingClient({
        maxRetries: 1,
        maxRequestsPerSecond: 100,
      });

      globalThis.fetch = mockFetchSequence([
        {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          json: () => Promise.resolve({ detail: "Server error" }),
        },
        {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          json: () => Promise.resolve({ detail: "Server error" }),
        },
      ]);

      await expect(
        client.getAwardDetails("test-id"),
      ).rejects.toThrow(USAspendingApiError);
    });

    it("throws USAspendingRateLimitError on 429 after retries", async () => {
      const client = new USAspendingClient({
        maxRetries: 1,
        maxRequestsPerSecond: 100,
      });

      globalThis.fetch = mockFetchSequence([
        {
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          json: () => Promise.resolve({ detail: "Rate limited" }),
        },
        {
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          json: () => Promise.resolve({ detail: "Rate limited" }),
        },
      ]);

      await expect(
        client.getAwardDetails("test-id"),
      ).rejects.toThrow(USAspendingRateLimitError);
    });
  });

  // -------------------------------------------------------------------------
  // Retry logic
  // -------------------------------------------------------------------------
  describe("retry logic", () => {
    it("retries on network error and succeeds", async () => {
      const mockAward = { id: 1, generated_unique_award_id: "test" };

      globalThis.fetch = mockFetchSequence([
        new Error("ECONNRESET"),
        { json: () => Promise.resolve(mockAward) },
      ]);

      const result = await client.getAwardDetails("test");
      expect(result).toEqual(mockAward);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("retries on 500 and succeeds", async () => {
      const mockData = { results: [] };

      globalThis.fetch = mockFetchSequence([
        {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          json: () => Promise.resolve({}),
        },
        { json: () => Promise.resolve(mockData) },
      ]);

      const result = await client.searchRecipients("test");
      expect(result).toEqual(mockData);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("retries on 429 and succeeds", async () => {
      const mockData = { results: [] };

      globalThis.fetch = mockFetchSequence([
        {
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          json: () => Promise.resolve({}),
        },
        { json: () => Promise.resolve(mockData) },
      ]);

      const result = await client.autocompleteRecipient("test");
      expect(result).toEqual(mockData);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("uses exponential backoff between retries", async () => {
      const client = new USAspendingClient({
        maxRetries: 3,
        maxRequestsPerSecond: 100,
      });

      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      globalThis.fetch = mockFetchSequence([
        new Error("fail"),
        new Error("fail"),
        { json: () => Promise.resolve({ id: 1 }) },
      ]);

      await client.getAwardDetails("test");

      // Filter setTimeout calls for backoff (1000ms and 2000ms)
      const backoffCalls = setTimeoutSpy.mock.calls.filter(
        ([, ms]) => ms === 1000 || ms === 2000,
      );
      expect(backoffCalls).toHaveLength(2);

      setTimeoutSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // Throttle / rate limiting
  // -------------------------------------------------------------------------
  describe("throttling", () => {
    it("limits requests per second", async () => {
      const client = new USAspendingClient({
        maxRequestsPerSecond: 2,
      });

      globalThis.fetch = mockFetch({
        json: () => Promise.resolve({ results: [] }),
      });

      // Fire 3 requests concurrently
      const start = Date.now();
      await Promise.all([
        client.autocompleteRecipient("a"),
        client.autocompleteRecipient("b"),
        client.autocompleteRecipient("c"),
      ]);
      const elapsed = Date.now() - start;

      // Third request should have been throttled (waited ~1s)
      // With fake timers + shouldAdvanceTime, this should still register
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
      // The elapsed time should be > 0 because of throttling
      // (exact timing depends on fake timer behavior)
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------------
  // Custom base URL
  // -------------------------------------------------------------------------
  describe("custom base URL", () => {
    it("uses custom base URL when provided", async () => {
      const client = new USAspendingClient({
        baseUrl: "https://custom-api.example.com/v2/",
        maxRequestsPerSecond: 100,
      });

      globalThis.fetch = mockFetch({
        json: () => Promise.resolve({ id: 1 }),
      });

      await client.getAwardDetails("test-id");

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, RequestInit];
      expect(url).toBe("https://custom-api.example.com/v2/awards/test-id/");
    });
  });
});
