import type {
  AwardDetail,
  AutocompleteRequest,
  AutocompleteResponse,
  RecipientProfile,
  RecipientSearchRequest,
  RecipientSearchResponse,
  SearchAwardsByDateRangeOptions,
  SpendingByAwardRequest,
  SpendingByAwardResponse,
  USAspendingClientOptions,
} from "./types";
import {
  USAspendingApiError,
  USAspendingNetworkError,
  USAspendingRateLimitError,
} from "./types";

const DEFAULT_BASE_URL = "https://api.usaspending.gov/api/v2/";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MAX_REQUESTS_PER_SECOND = 2;

const DEFAULT_AWARD_FIELDS = [
  "Award ID",
  "Recipient Name",
  "Start Date",
  "End Date",
  "Award Amount",
  "Total Outlays",
  "Description",
  "Awarding Agency",
  "Awarding Sub Agency",
  "Contract Award Type",
  "recipient_id",
  "prime_award_recipient_id",
  "internal_id",
  "def_codes",
  "COVID-19 Obligations",
  "COVID-19 Outlays",
  "Infrastructure Obligations",
  "Infrastructure Outlays",
];

export class USAspendingClient {
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly maxRequestsPerSecond: number;
  private lastRequestTimestamps: number[] = [];

  constructor(options: USAspendingClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.maxRequestsPerSecond =
      options.maxRequestsPerSecond ?? DEFAULT_MAX_REQUESTS_PER_SECOND;
  }

  // ---------------------------------------------------------------------------
  // Public methods
  // ---------------------------------------------------------------------------

  async searchAwardsByDateRange(
    startDate: string,
    endDate: string,
    options: SearchAwardsByDateRangeOptions = {},
  ): Promise<SpendingByAwardResponse> {
    const body: SpendingByAwardRequest = {
      filters: {
        time_period: [{ start_date: startDate, end_date: endDate }],
        award_type_codes: options.awardTypeCodes ?? ["A", "B", "C", "D"],
        ...(options.keywords && { keywords: options.keywords }),
      },
      fields: options.fields ?? DEFAULT_AWARD_FIELDS,
      page: options.page ?? 1,
      limit: options.limit ?? 25,
      sort: options.sort ?? "Start Date",
      order: options.order ?? "desc",
    };

    return this.post<SpendingByAwardResponse>(
      "search/spending_by_award/",
      body,
    );
  }

  async *searchAwardsByDateRangePaginated(
    startDate: string,
    endDate: string,
    options: Omit<SearchAwardsByDateRangeOptions, "page"> = {},
  ): AsyncGenerator<SpendingByAwardResponse> {
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const response = await this.searchAwardsByDateRange(
        startDate,
        endDate,
        { ...options, page },
      );
      yield response;
      hasNext = response.page_metadata.hasNext;
      page++;
    }
  }

  async getAwardDetails(generatedInternalId: string): Promise<AwardDetail> {
    return this.get<AwardDetail>(`awards/${generatedInternalId}/`);
  }

  async getRecipientProfile(recipientHash: string): Promise<RecipientProfile> {
    return this.get<RecipientProfile>(`recipient/${recipientHash}/`);
  }

  async searchRecipients(
    keyword: string,
    options: Partial<
      Pick<RecipientSearchRequest, "order" | "sort" | "page" | "limit" | "award_type">
    > = {},
  ): Promise<RecipientSearchResponse> {
    const body: RecipientSearchRequest = {
      keyword,
      order: options.order ?? "desc",
      sort: options.sort ?? "amount",
      page: options.page ?? 1,
      limit: options.limit ?? 50,
      ...(options.award_type && { award_type: options.award_type }),
    };

    return this.post<RecipientSearchResponse>("recipient/", body);
  }

  async autocompleteRecipient(
    searchText: string,
    limit?: number,
  ): Promise<AutocompleteResponse> {
    const body: AutocompleteRequest = {
      search_text: searchText,
      ...(limit !== undefined && { limit }),
    };

    return this.post<AutocompleteResponse>("autocomplete/recipient/", body);
  }

  // ---------------------------------------------------------------------------
  // Internal HTTP helpers
  // ---------------------------------------------------------------------------

  private async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    attempt = 0,
  ): Promise<T> {
    await this.throttle();

    const url = new URL(path, this.baseUrl).toString();

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (err) {
      if (attempt < this.maxRetries) {
        await this.backoff(attempt);
        return this.request<T>(path, init, attempt + 1);
      }
      throw new USAspendingNetworkError(
        `Network error requesting ${url}: ${(err as Error).message}`,
        err as Error,
      );
    }

    if (response.status === 429) {
      if (attempt < this.maxRetries) {
        await this.backoff(attempt);
        return this.request<T>(path, init, attempt + 1);
      }
      const body = await this.safeJson(response);
      throw new USAspendingRateLimitError(body);
    }

    if (!response.ok) {
      const body = await this.safeJson(response);
      if (response.status >= 500 && attempt < this.maxRetries) {
        await this.backoff(attempt);
        return this.request<T>(path, init, attempt + 1);
      }
      throw new USAspendingApiError(
        `USAspending API error: ${response.status} ${response.statusText}`,
        response.status,
        body,
      );
    }

    return (await response.json()) as T;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const windowStart = now - 1000;

    // Remove timestamps outside the 1-second window
    this.lastRequestTimestamps = this.lastRequestTimestamps.filter(
      (t) => t > windowStart,
    );

    if (this.lastRequestTimestamps.length >= this.maxRequestsPerSecond) {
      const oldest = this.lastRequestTimestamps[0];
      const waitMs = oldest + 1000 - now;
      if (waitMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      }
      // Clean up again after waiting
      const afterWait = Date.now();
      this.lastRequestTimestamps = this.lastRequestTimestamps.filter(
        (t) => t > afterWait - 1000,
      );
    }

    this.lastRequestTimestamps.push(Date.now());
  }

  private async backoff(attempt: number): Promise<void> {
    const delayMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  }

  private async safeJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
}
