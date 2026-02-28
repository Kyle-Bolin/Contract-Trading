// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginationRequest {
  page: number;
  limit: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface PaginationResponse {
  page: number;
  limit: number;
  hasNext: boolean;
  total?: number;
}

// ---------------------------------------------------------------------------
// Time Period Filter
// ---------------------------------------------------------------------------

export interface TimePeriod {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Spending By Award (POST /search/spending_by_award/)
// ---------------------------------------------------------------------------

export type AwardTypeCode =
  | "A"
  | "B"
  | "C"
  | "D"
  | "IDV_A"
  | "IDV_B"
  | "IDV_B_A"
  | "IDV_B_B"
  | "IDV_B_C"
  | "IDV_C"
  | "IDV_D"
  | "IDV_E"
  | "02"
  | "03"
  | "04"
  | "05"
  | "06"
  | "07"
  | "08"
  | "09"
  | "10"
  | "11";

export interface SpendingByAwardFilters {
  time_period: TimePeriod[];
  award_type_codes: AwardTypeCode[];
  keywords?: string[];
  recipient_search_text?: string[];
}

export interface SpendingByAwardRequest {
  filters: SpendingByAwardFilters;
  fields: string[];
  page: number;
  limit: number;
  sort: string;
  order: "asc" | "desc";
  subawards?: boolean;
}

export interface SpendingByAwardResult {
  internal_id: string;
  "Award ID": string;
  "Recipient Name": string;
  "Start Date": string;
  "End Date": string;
  "Award Amount": number;
  "Total Outlays": number;
  "Description": string;
  "def_codes": string[];
  "COVID-19 Obligations": number;
  "COVID-19 Outlays": number;
  "Infrastructure Obligations": number;
  "Infrastructure Outlays": number;
  "Awarding Agency": string;
  "Awarding Sub Agency": string;
  "Contract Award Type": string;
  "recipient_id": string;
  "prime_award_recipient_id": string;
  [key: string]: unknown;
}

export interface SpendingByAwardResponse {
  limit: number;
  results: SpendingByAwardResult[];
  page_metadata: {
    page: number;
    hasNext: boolean;
    last_record_unique_id: number | null;
    last_record_sort_value: string | null;
  };
  messages?: string[];
}

// ---------------------------------------------------------------------------
// Award Detail (GET /awards/{id}/)
// ---------------------------------------------------------------------------

export interface AwardRecipient {
  recipient_name: string;
  recipient_hash: string;
  recipient_unique_id: string; // DUNS
  parent_recipient_name: string | null;
  parent_recipient_hash: string | null;
  parent_recipient_unique_id: string | null;
  business_categories: string[];
  location: {
    address_line1: string | null;
    address_line2: string | null;
    city_name: string | null;
    state_code: string | null;
    zip5: string | null;
    congressional_code: string | null;
    country_name: string | null;
  };
}

export interface AwardDetail {
  id: number;
  generated_unique_award_id: string;
  type: string;
  type_description: string;
  category: string;
  description: string;
  piid: string | null;
  fain: string | null;
  uri: string | null;
  total_obligation: number;
  base_and_all_options_value: number;
  base_exercised_options_val: number;
  date_signed: string | null;
  period_of_performance_start_date: string | null;
  period_of_performance_current_end_date: string | null;
  recipient: AwardRecipient;
  awarding_agency: {
    id: number;
    toptier_agency: { name: string; abbreviation: string; code: string };
    subtier_agency: { name: string; abbreviation: string; code: string };
  };
  funding_agency: {
    id: number;
    toptier_agency: { name: string; abbreviation: string; code: string };
    subtier_agency: { name: string; abbreviation: string; code: string };
  } | null;
  executive_details: {
    officers: Array<{
      name: string;
      amount: number;
    }>;
  };
  subaward_count: number;
  total_subaward_amount: number;
  naics_hierarchy: Record<
    string,
    { code: string; description: string }
  >;
  psc_hierarchy: Record<
    string,
    { code: string; description: string }
  >;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Recipient Search (POST /recipient/)
// ---------------------------------------------------------------------------

export interface RecipientSearchRequest {
  keyword: string;
  order: "asc" | "desc";
  sort: "name" | "duns" | "amount";
  page: number;
  limit: number;
  award_type?: "all" | "contracts" | "grants" | "loans" | "direct_payments" | "other";
}

export interface RecipientSearchResult {
  id: string;
  name: string;
  duns: string | null;
  uei: string | null;
  recipient_level: "R" | "P" | "C";
  amount: number;
}

export interface RecipientSearchResponse {
  page: number;
  limit: number;
  count: number;
  results: RecipientSearchResult[];
}

// ---------------------------------------------------------------------------
// Recipient Profile (GET /recipient/{hash}/)
// ---------------------------------------------------------------------------

export interface RecipientProfile {
  name: string;
  alternate_names: string[];
  duns: string | null;
  uei: string | null;
  recipient_id: string;
  recipient_level: "R" | "P" | "C";
  parent_name: string | null;
  parent_duns: string | null;
  parent_uei: string | null;
  parent_id: string | null;
  parents: Array<{
    parent_name: string;
    parent_duns: string | null;
    parent_uei: string | null;
    parent_id: string;
  }>;
  business_types: string[];
  location: {
    address_line1: string | null;
    address_line2: string | null;
    city_name: string | null;
    state_code: string | null;
    zip5: string | null;
    congressional_code: string | null;
    country_name: string | null;
  };
  total_transaction_amount: number;
  total_transactions: number;
  total_face_value_loan_amount: number;
  total_face_value_loan_transactions: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Autocomplete (POST /autocomplete/recipient/)
// ---------------------------------------------------------------------------

export interface AutocompleteRequest {
  search_text: string;
  limit?: number;
}

export interface AutocompleteResponse {
  results: {
    recipient_name: string;
    [key: string]: unknown;
  }[];
}

// ---------------------------------------------------------------------------
// Client Options
// ---------------------------------------------------------------------------

export interface USAspendingClientOptions {
  baseUrl?: string;
  maxRetries?: number;
  maxRequestsPerSecond?: number;
}

export interface SearchAwardsByDateRangeOptions {
  awardTypeCodes?: AwardTypeCode[];
  keywords?: string[];
  fields?: string[];
  sort?: string;
  order?: "asc" | "desc";
  limit?: number;
  page?: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class USAspendingApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = "USAspendingApiError";
  }
}

export class USAspendingNetworkError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "USAspendingNetworkError";
  }
}

export class USAspendingRateLimitError extends USAspendingApiError {
  constructor(responseBody?: unknown) {
    super("Rate limited by USAspending API", 429, responseBody);
    this.name = "USAspendingRateLimitError";
  }
}
